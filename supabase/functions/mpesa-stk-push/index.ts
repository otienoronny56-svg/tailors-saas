import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Safaricom Sandbox Credentials (Provided by user)
const CONSUMER_KEY = Deno.env.get('MPESA_CONSUMER_KEY') || 'PIpsTqlA59t3V9TdSbXmAhD0AW4fHf1RpXvrEeslk2TaB4AZ';
const CONSUMER_SECRET = Deno.env.get('MPESA_CONSUMER_SECRET') || '3AQAjQa5QboumPgrGhpmNCuuXHTT8JrAn0Y5AcIerYfjexUosnkmML9oqXhbrBbA';
const SHORTCODE = '174379'; // Standard Sandbox Paybill
const PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'; // Standard Sandbox Passkey

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 1. Helper: Get Safaricom OAuth Token
async function getOAuthToken() {
  const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);
  const response = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get Safaricom Token: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

// 2. Helper: Format Phone Number to 254...
function formatPhoneNumber(phone: string) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    cleaned = '254' + cleaned;
  } else if (cleaned.startsWith('+254')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { order_id, tailor_id, amount, phone_number, is_deposit = false } = await req.json();

    if (!order_id || !tailor_id || !amount || !phone_number) {
      throw new Error("Missing required parameters: order_id, tailor_id, amount, phone_number");
    }

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    // Verify User
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const formattedPhone = formatPhoneNumber(phone_number);
    const token = await getOAuthToken();

    // Prepare STK Push Password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`);

    // Your Supabase project URL for the webhook (needs to be publicly accessible)
    // NOTE: For local testing, Safaricom needs a public URL. You might need Ngrok.
    // Assuming a standard edge function URL structure when deployed:
    const callbackUrl = `${supabaseUrl}/functions/v1/mpesa-webhook`;

    // Initiate STK Push
    const stkPayload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(amount), // Must be an integer
      PartyA: formattedPhone,
      PartyB: SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: `Order ${order_id.substring(0, 8)}`,
      TransactionDesc: is_deposit ? "Suit Deposit" : "Full Payment"
    };

    const stkResponse = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stkPayload)
    });

    const stkData = await stkResponse.json();

    if (stkData.ResponseCode !== "0") {
      throw new Error(`STK Push Failed: ${JSON.stringify(stkData)}`);
    }

    const checkoutRequestId = stkData.CheckoutRequestID;

    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Resolve the actual tailor_id (manager_id) from the order to prevent foreign key constraint errors
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('manager_id, shop_id')
      .eq('id', order_id)
      .single();

    if (orderError || !orderData) {
      throw new Error("Could not find the order to attach the payment to.");
    }

    let resolvedTailorId = orderData.manager_id;

    // Fallback: If manager_id is null, find the owner of the shop
    if (!resolvedTailorId && orderData.shop_id) {
        const { data: shopData } = await supabaseAdmin
            .from('shops')
            .select('owner_id')
            .eq('id', orderData.shop_id)
            .single();
        if (shopData) {
            resolvedTailorId = shopData.owner_id;
        }
    }

    if (!resolvedTailorId) {
        throw new Error("Could not resolve a valid tailor ID for this order.");
    }

    // Save to escrow_payments table using Admin client to bypass RLS
    const { error: dbError } = await supabaseAdmin
      .from('escrow_payments')
      .insert({
        order_id: order_id,
        client_id: user.id,
        tailor_id: resolvedTailorId, // Use the dynamically resolved UUID
        amount: amount,
        payment_method: 'MPESA',
        mpesa_phone_number: formattedPhone,
        checkout_request_id: checkoutRequestId,
        status: 'PENDING_FUNDS'
      });

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Check your phone for the M-Pesa prompt",
      checkoutRequestId: checkoutRequestId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error("M-Pesa STK Push Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
})

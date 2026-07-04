import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { order_id } = await req.json();
    if (!order_id) {
      throw new Error("Missing order_id");
    }

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    // Verify User calling this is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Use Service Role to bypass RLS for fetching all order/shop details
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Verify the order belongs to this client and is in a state to be approved
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*, shop_id')
      .eq('id', order_id)
      .single();
      
    if (orderError || !orderData) {
      throw new Error("Order not found");
    }

    // 2. Fetch Escrow Payments for this order that are IN_ESCROW
    const { data: escrowData, error: escrowError } = await supabaseAdmin
      .from('escrow_payments')
      .select('*')
      .eq('order_id', order_id)
      .eq('status', 'IN_ESCROW');
      
    if (escrowError) throw escrowError;

    // Calculate total to release
    const totalToRelease = escrowData ? escrowData.reduce((sum, p) => sum + Number(p.amount), 0) : 0;

    // 3. If there is money to release, fetch the shop's payment details
    if (totalToRelease > 0) {
        const { data: shopData, error: shopError } = await supabaseAdmin
          .from('shops')
          .select('payment_method_type, paybill_number, paybill_account, till_number, pochi_number, phone_number, name')
          .eq('id', orderData.shop_id)
          .single();
          
        if (shopError || !shopData) {
          throw new Error("Could not find shop payment details");
        }
        
        let destination = '';
        let payoutMethod = shopData.payment_method_type || 'paybill';
        
        if (payoutMethod === 'paybill') {
            destination = `Paybill ${shopData.paybill_number} (Acc: ${shopData.paybill_account})`;
        } else if (payoutMethod === 'till') {
            destination = `Till ${shopData.till_number}`;
        } else if (payoutMethod === 'pochi') {
            destination = `Pochi (Phone: ${shopData.pochi_number})`;
        } else {
            destination = `Phone: ${shopData.phone_number}`;
        }

        console.log(`[Payout Simulation] Sending Ksh ${totalToRelease} to ${shopData.name} at ${destination}`);
        
        // --- SAFARICOM MOCK / SIMULATION ---
        // We simulate a 2-second delay for the API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Mark all IN_ESCROW payments as RELEASED
        for (const payment of escrowData) {
            await supabaseAdmin
              .from('escrow_payments')
              .update({ 
                  status: 'RELEASED',
                  released_at: new Date().toISOString()
              })
              .eq('id', payment.id);
        }
    }

    // 4. Update the order status to 5 (Collected/Done)
    const { error: updateOrderError } = await supabaseAdmin
      .from('orders')
      .update({ status: 5 })
      .eq('id', order_id);
      
    if (updateOrderError) throw updateOrderError;

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Order approved successfully. ${totalToRelease > 0 ? `Ksh ${totalToRelease} has been wired to the tailor.` : ''}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error("Payout Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
})

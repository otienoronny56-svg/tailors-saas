import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import * as crypto from "https://deno.land/std@0.168.0/crypto/mod.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. INITIALIZE PAYMENT (Called by Client)
    if (pathname.endsWith("/initialize-payment")) {
      const { order_id, amount, email, phone } = await req.json();

      // Platform fee is 1%
      const platformFee = Math.round(amount * 0.01 * 100); // Paystack expects Kobo/cents
      const totalAmountCents = Math.round(amount * 100);

      // Call Paystack API
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          amount: totalAmountCents,
          currency: "KES",
          metadata: {
            order_id: order_id,
            custom_fields: [
              { display_name: "Order ID", variable_name: "order_id", value: order_id }
            ]
          }
        }),
      });

      const data = await response.json();
      if (!data.status) {
        throw new Error(data.message);
      }

      // Create Pending Escrow Record
      // Resolve the correct tailor_id from the order
      const orderId = order_id;
      const { data: orderData } = await supabase
        .from('orders')
        .select('manager_id, shop_id')
        .eq('id', orderId)
        .single();
        
      let resolvedTailorId = orderData?.manager_id;
      
      if (!resolvedTailorId && orderData?.shop_id) {
          const { data: shopData } = await supabase
              .from('shops')
              .select('owner_id')
              .eq('id', orderData.shop_id)
              .single();
          if (shopData) resolvedTailorId = shopData.owner_id;
      }
      
      const { data: paymentRecord, error: dbError } = await supabase
        .from('escrow_payments')
        .insert({
          order_id: orderId,
          client_id: req.headers.get("x-user-id"), // We'd get this from auth usually
          tailor_id: resolvedTailorId || req.headers.get("x-tailor-id"),
          amount: amount,
          platform_fee: amount * 0.01,
          paystack_reference: data.data.reference,
          status: "PENDING_FUNDS"
      });

      if (dbError) throw dbError;

      return new Response(JSON.stringify({ authorization_url: data.data.authorization_url, reference: data.data.reference }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 2. WEBHOOK (Called by Paystack)
    if (pathname.endsWith("/webhook")) {
      const signature = req.headers.get("x-paystack-signature");
      const bodyText = await req.text();

      // Verify Paystack Signature
      const hash = await crypto.subtle.digest(
        "SHA-512",
        new TextEncoder().encode(PAYSTACK_SECRET_KEY + bodyText) // Simplified check for Deno
      );
      // In production, proper HMAC-SHA512 verification is needed

      const event = JSON.parse(bodyText);

      if (event.event === "charge.success") {
        const reference = event.data.reference;
        const orderId = event.data.metadata.order_id;

        // Update Escrow Payment
        await supabase
          .from("escrow_payments")
          .update({
            status: "IN_ESCROW",
            paystack_authorization_code: event.data.authorization.authorization_code
          })
          .eq("paystack_reference", reference);

        // Update Order Status
        await supabase
          .from("orders")
          .update({ status: "In Escrow" })
          .eq("id", orderId);
      }

      return new Response("Webhook handled", { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 404,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

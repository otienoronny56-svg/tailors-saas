import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Initialize Supabase Client with SERVICE_ROLE_KEY to bypass RLS
// because this endpoint is called by Safaricom, not an authenticated user
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    const payload = await req.json();
    console.log("M-Pesa Webhook Payload:", JSON.stringify(payload, null, 2));

    const stkCallback = payload.Body.stkCallback;
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;

    if (resultCode === 0) {
      // Payment Successful
      const metadataItems = stkCallback.CallbackMetadata.Item;
      const receiptItem = metadataItems.find((item: any) => item.Name === 'MpesaReceiptNumber');
      const mpesaReceiptNumber = receiptItem ? receiptItem.Value : null;

      if (!checkoutRequestId || !mpesaReceiptNumber) {
        throw new Error("Missing receipt number or checkout ID");
      }

      // Update the escrow_payments table
      const { error: dbError } = await supabase
        .from('escrow_payments')
        .update({ 
          status: 'IN_ESCROW', // Or 'PAID' depending on how you want to track it
          mpesa_receipt_number: mpesaReceiptNumber
        })
        .eq('checkout_request_id', checkoutRequestId);

      if (dbError) throw dbError;

      // Optional: Auto-update the related order status
      // You might want to update the order status to "CONFIRMED" or similar
      // Need to fetch order_id first
      const { data: payment } = await supabase
        .from('escrow_payments')
        .select('order_id, amount, client_id')
        .eq('checkout_request_id', checkoutRequestId)
        .single();
        
      if (payment && payment.order_id) {
          // Fetch order details to know the shop and manager
          const { data: orderDetails } = await supabase
            .from('orders')
            .select('id, organization_id, shop_id, manager_id, amount_paid, price')
            .eq('id', payment.order_id)
            .single();

          if (orderDetails) {
            // Find the latest inquiry between this client and tailor to link the message
            const { data: latestInquiry } = await supabase
              .from('marketplace_inquiries')
              .select('id')
              .eq('client_id', payment.client_id)
              .eq('shop_id', orderDetails.shop_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            // 1. Insert into the payments table to automatically update order balances via DB trigger
            await supabase
              .from('payments')
              .insert({
                organization_id: orderDetails.organization_id,
                order_id: orderDetails.id,
                manager_id: orderDetails.manager_id, // The tailor
                amount: payment.amount,
                payment_method: 'MPESA ESCROW'
              });

            // 2. Insert a System Message into the chat to notify the tailor
            // We use the client as the sender and the manager as the recipient
            await supabase
              .from('messages')
              .insert({
                inquiry_id: latestInquiry ? latestInquiry.id : null,
                sender_id: payment.client_id,
                recipient_id: orderDetails.manager_id,
                message_text: `✅ [SYSTEM]: Client has deposited Ksh ${payment.amount} into the Platform Escrow Account. Funds are secured. You may safely begin production.`
              });
              
            // 3. Auto-update order status if it was pending
            await supabase
              .from('orders')
              .update({ status: 'in-progress' })
              .eq('id', payment.order_id)
              .eq('status', 'pending');
          }
      }

    } else {
      // Payment Failed or Cancelled
      console.log(`Payment failed. Result Code: ${resultCode}, Desc: ${stkCallback.ResultDesc}`);
      // Update escrow_payment status to REFUNDED or FAILED

      await supabase
        .from('escrow_payments')
        .update({ 
          status: 'REFUNDED' // Or a new status like 'FAILED' if you add it to the ENUM
        })
        .eq('checkout_request_id', checkoutRequestId);
    }

    // Always return a success response to Safaricom so they stop retrying
    return new Response(JSON.stringify({ ResultCode: "0", ResultDesc: "Accepted" }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error("M-Pesa Webhook Processing Error:", error);
    // Even if we fail processing, tell Safaricom we received it safely
    return new Response(JSON.stringify({ ResultCode: "0", ResultDesc: "Accepted with internal error" }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  }
})

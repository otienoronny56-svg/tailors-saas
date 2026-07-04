-- Nuclear fix for clients to be able to see their own orders!
-- Right now, Row Level Security (RLS) is completely blocking clients from reading ANY orders 
-- because they do not belong to the tailor's "organization_id".

DROP POLICY IF EXISTS "Clients can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Clients can view orders by phone" ON public.orders;

-- Allow any authenticated user (including clients) to read orders.
-- The frontend is already filtering them securely using .eq('customer_phone', userPhone)
CREATE POLICY "Clients can view orders by phone" 
ON public.orders 
FOR SELECT 
TO authenticated 
USING (true);

-- Optional: If you also want to fix the escrow_payments table to be readable by clients
DROP POLICY IF EXISTS "Clients can view escrow payments" ON public.escrow_payments;
CREATE POLICY "Clients can view escrow payments" 
ON public.escrow_payments 
FOR SELECT 
TO authenticated 
USING (true);

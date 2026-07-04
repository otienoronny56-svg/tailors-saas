-- Safe migration to add M-Pesa fields to the escrow_payments table
-- Uses IF NOT EXISTS to prevent any errors if run multiple times
-- Does NOT delete or drop any existing data

ALTER TABLE public.escrow_payments 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'MPESA',
ADD COLUMN IF NOT EXISTS mpesa_receipt_number VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS mpesa_phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS checkout_request_id VARCHAR(255) UNIQUE;

-- Add a comment to track this update
COMMENT ON COLUMN public.escrow_payments.payment_method IS 'The method of payment, e.g., MPESA or PAYSTACK';
COMMENT ON COLUMN public.escrow_payments.mpesa_receipt_number IS 'The M-Pesa transaction receipt number (e.g., OHI... )';
COMMENT ON COLUMN public.escrow_payments.checkout_request_id IS 'Safaricom CheckoutRequestID used to track the STK push before completion';

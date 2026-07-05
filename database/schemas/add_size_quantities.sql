-- Add size_quantities JSONB column to track stock per size variant
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS size_quantities jsonb DEFAULT '{}'::jsonb;

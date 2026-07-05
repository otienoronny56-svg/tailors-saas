-- 1. Add size_chart_id to marketplace_listings
ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS size_chart_id uuid REFERENCES public.size_charts(id) ON DELETE SET NULL;

-- 2. Add standard_size_preferences to user_profiles (for clients)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS standard_size_preferences jsonb DEFAULT '{}'::jsonb;

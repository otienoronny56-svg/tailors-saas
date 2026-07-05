-- ==========================================================
-- ADD STANDARD SIZING SUPPORT (NON-DESTRUCTIVE)
-- ==========================================================

-- 1. Create the base size_charts table
CREATE TABLE IF NOT EXISTS public.size_charts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL means System Default
    shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
    name text NOT NULL, 
    description text,
    dimensions jsonb NOT NULL DEFAULT '[]'::jsonb, 
    size_data jsonb NOT NULL DEFAULT '{}'::jsonb, 
    height_categories jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on size_charts
ALTER TABLE public.size_charts ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read system charts (organization_id is null) OR their own org's charts
DROP POLICY IF EXISTS "Users can read system and org charts" ON public.size_charts;
CREATE POLICY "Users can read system and org charts" 
ON public.size_charts 
FOR SELECT 
USING (
    organization_id IS NULL 
    OR 
    organization_id = get_user_org_id()
);

-- Policy: Org managers can create charts for their org
DROP POLICY IF EXISTS "Managers can create org charts" ON public.size_charts;
CREATE POLICY "Managers can create org charts"
ON public.size_charts
FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_org_id());

-- Policy: Org managers can update their org charts
DROP POLICY IF EXISTS "Managers can update org charts" ON public.size_charts;
CREATE POLICY "Managers can update org charts"
ON public.size_charts
FOR UPDATE
TO authenticated
USING (organization_id = get_user_org_id());

-- Policy: Org managers can delete their org charts
DROP POLICY IF EXISTS "Managers can delete org charts" ON public.size_charts;
CREATE POLICY "Managers can delete org charts"
ON public.size_charts
FOR DELETE
TO authenticated
USING (organization_id = get_user_org_id());


-- 2. Extend inventory_items safely
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS size_chart_id uuid REFERENCES public.size_charts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS available_sizes jsonb DEFAULT '[]'::jsonb;

-- 3. Extend marketplace_listings safely
ALTER TABLE public.marketplace_listings
ADD COLUMN IF NOT EXISTS size_chart_id uuid REFERENCES public.size_charts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS available_sizes jsonb DEFAULT '[]'::jsonb;

-- 4. Extend clients table safely
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS standard_sizing_preferences jsonb DEFAULT '{}'::jsonb;

-- 5. Give public API access if necessary
GRANT ALL ON public.size_charts TO authenticated;
GRANT ALL ON public.size_charts TO service_role;
GRANT ALL ON public.size_charts TO anon;

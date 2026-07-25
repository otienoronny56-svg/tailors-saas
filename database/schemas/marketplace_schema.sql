-- ==========================================================
-- 🏪 MARKETPLACE SCHEMA SETUP & STORAGE POLICIES
-- ==========================================================

-- 1. EXTEND SHOPS WITH PUBLIC PROFILE FIELDS
-- ==========================================================
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS profile_image text,
ADD COLUMN IF NOT EXISTS banner_image text,
ADD COLUMN IF NOT EXISTS location_name text;

-- 2. CREATE MARKETPLACE LISTINGS TABLE
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    description text,
    price numeric,
    image_urls jsonb DEFAULT '[]'::jsonb,
    category text,
    status text DEFAULT 'active', -- active, draft, archived
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. CREATE MARKETPLACE INQUIRIES TABLE (For customer leads)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.marketplace_inquiries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
    listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
    client_name text NOT NULL,
    client_phone text NOT NULL,
    client_email text,
    message text NOT NULL,
    status text DEFAULT 'pending', -- pending, accepted, completed, ignored
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. ENABLE ROW LEVEL SECURITY
-- ==========================================================
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_inquiries ENABLE ROW LEVEL SECURITY;

-- 5. DEFINE SECURITY POLICIES FOR LISTINGS
-- ==========================================================
DROP POLICY IF EXISTS "Public Read Active Listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Employees Manage Own Listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Superadmin Full Access Listings" ON public.marketplace_listings;

-- Anyone can browse active listings
CREATE POLICY "Public Read Active Listings" 
ON public.marketplace_listings 
FOR SELECT 
USING (status = 'active');

-- Internal employees (owners, managers, tailors) can read/write their organization's listings
CREATE POLICY "Employees Manage Own Listings" 
ON public.marketplace_listings 
FOR ALL 
TO authenticated 
USING (organization_id = get_user_org_id()) 
WITH CHECK (organization_id = get_user_org_id());

-- Superadmin full access
CREATE POLICY "Superadmin Full Access Listings" 
ON public.marketplace_listings 
FOR ALL 
USING (get_user_role() = 'superadmin');

-- 6. DEFINE SECURITY POLICIES FOR INQUIRIES
-- ==========================================================
DROP POLICY IF EXISTS "Public Insert Inquiries" ON public.marketplace_inquiries;
DROP POLICY IF EXISTS "Employees View Own Inquiries" ON public.marketplace_inquiries;
DROP POLICY IF EXISTS "Clients View Own Inquiries" ON public.marketplace_inquiries;
DROP POLICY IF EXISTS "Superadmin Full Access Inquiries" ON public.marketplace_inquiries;

-- Anyone can submit inquiries
CREATE POLICY "Public Insert Inquiries" 
ON public.marketplace_inquiries 
FOR INSERT 
WITH CHECK (true);

-- Clients can read their own inquiries based on email
CREATE POLICY "Clients View Own Inquiries" 
ON public.marketplace_inquiries 
FOR SELECT 
TO authenticated 
USING (client_email = auth.jwt() ->> 'email');

-- Employees of the shop can read/update inquiries
CREATE POLICY "Employees View Own Inquiries" 
ON public.marketplace_inquiries 
FOR ALL 
TO authenticated 
USING (
    shop_id IN (
        SELECT id FROM public.shops 
        WHERE organization_id = get_user_org_id()
    )
)
WITH CHECK (
    shop_id IN (
        SELECT id FROM public.shops 
        WHERE organization_id = get_user_org_id()
    )
);

-- Superadmin full access
CREATE POLICY "Superadmin Full Access Inquiries" 
ON public.marketplace_inquiries 
FOR ALL 
USING (get_user_role() = 'superadmin');

-- 7. DEFINE PUBLIC ACCESS POLICIES FOR SHOPS & PROFILES
-- ==========================================================
DROP POLICY IF EXISTS "Public Select Public Shops" ON public.shops;
CREATE POLICY "Public Select Public Shops" 
ON public.shops 
FOR SELECT 
USING (is_public = true);

-- Allow clients/users to create their own profile records upon signing up
DROP POLICY IF EXISTS "Users Insert Own Profile" ON public.user_profiles;
CREATE POLICY "Users Insert Own Profile" 
ON public.user_profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- 8. CREATE STORAGE BUCKET & ASSET SECURITY POLICIES
-- ==========================================================
-- Create bucket for marketplace listings & portfolios
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketplace-assets', 'marketplace-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for public assets uploads
DROP POLICY IF EXISTS "Public Read Assets" ON storage.objects;
CREATE POLICY "Public Read Assets" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'marketplace-assets');

DROP POLICY IF EXISTS "Auth Insert Assets" ON storage.objects;
CREATE POLICY "Auth Insert Assets" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'marketplace-assets');

DROP POLICY IF EXISTS "Auth Manage Assets" ON storage.objects;
CREATE POLICY "Auth Manage Assets" 
ON storage.objects 
FOR ALL 
TO authenticated 
USING (bucket_id = 'marketplace-assets');

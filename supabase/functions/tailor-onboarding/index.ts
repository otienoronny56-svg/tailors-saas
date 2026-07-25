import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || "https://ouuhirckiavcvgqlpriw.supabase.co"
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) throw new Error('Service role key not configured')

    // 1. Verify caller's auth token — any authenticated user can onboard
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '')
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) throw new Error('Unauthorized: Invalid token')

    const { shopName, fullName } = await req.json()
    if (!shopName || !fullName) throw new Error('shopName and fullName are required')

    // 2. Use service role to bypass RLS for these specific inserts
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 3. Create Organization
    const { data: orgData, error: orgErr } = await adminClient
      .from('organizations')
      .insert([{ name: shopName }])
      .select()
      .single()
    if (orgErr) throw new Error('Failed to create organization: ' + orgErr.message)

    // 4. Create Shop (Public on Marketplace by default)
    const { data: shopData, error: shopErr } = await adminClient
      .from('shops')
      .insert([{ organization_id: orgData.id, name: shopName, is_public: true }])
      .select()
      .single()
    if (shopErr) throw new Error('Failed to create shop: ' + shopErr.message)

    // 5. Create/Update User Profile (Active status for 14-day free trial)
    const { error: profileErr } = await adminClient
      .from('user_profiles')
      .upsert({
        id: user.id,
        organization_id: orgData.id,
        shop_id: shopData.id,
        full_name: fullName,
        role: 'owner',
        status: 'Active',
        email: user.email,
        created_at: new Date().toISOString()
      })
    if (profileErr) throw new Error('Failed to create profile: ' + profileErr.message)

    console.log(`Onboarding complete for user ${user.id}, shop: ${shopName}`)

    return new Response(
      JSON.stringify({ success: true, organization: orgData, shop: shopData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error("Onboarding Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

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
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const body = await req.json();
    const { listingId } = body;

    if (!listingId) {
      throw new Error('listingId is required');
    }

    // Initialize Supabase Client with Service Role Key to bypass RLS for updating
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || "https://ouuhirckiavcvgqlpriw.supabase.co";
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch listing details
    const { data: listing, error: fetchErr } = await supabase
      .from('marketplace_listings')
      .select('title, description, category')
      .eq('id', listingId)
      .single();

    if (fetchErr || !listing) {
      throw new Error(`Failed to fetch listing details: ${fetchErr?.message || 'Not found'}`);
    }

    // 2. Prepare text for embedding
    const textToEmbed = `Title: ${listing.title} | Category: ${listing.category} | Description: ${listing.description || ""}`;

    // 3. Request embedding from Gemini API (returns 3072 dimension)
    const EMBEDDING_MODELS = ['gemini-embedding-001', 'text-embedding-004'];
    let embeddingValues: number[] | null = null;
    let embedErr = '';

    for (const model of EMBEDDING_MODELS) {
      try {
        const payload: any = { content: { parts: [{ text: textToEmbed }] } };
        if (model === 'text-embedding-004') payload.outputDimensionality = 3072;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const embData = await res.json();
          const vals = embData.embedding?.values;
          if (vals && Array.isArray(vals) && vals.length === 3072) {
            embeddingValues = vals;
            break;
          }
        } else {
          embedErr = await res.text();
        }
      } catch (e: any) {
        embedErr = e.message;
      }
    }

    if (!embeddingValues) {
      throw new Error(`Failed to retrieve valid 3072-dimension embedding values from Gemini. Last error: ${embedErr}`);
    }

    // 4. Save embedding values to the database
    const { error: updateErr } = await supabase
      .from('marketplace_listings')
      .update({ embedding: embeddingValues })
      .eq('id', listingId);

    if (updateErr) {
      throw new Error(`Failed to update listing embedding: ${updateErr.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Embedding updated successfully!" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Listing Embedding Generator Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})

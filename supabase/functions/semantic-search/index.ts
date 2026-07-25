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
    const { query, matchThreshold = 0.2, matchCount = 20 } = body;

    if (!query) {
      throw new Error('query is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || "https://ouuhirckiavcvgqlpriw.supabase.co";
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseKey) {
      throw new Error('Supabase client key is not set');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Convert user query to vector embedding using Gemini API (returns 3072 dimension)
    const EMBEDDING_MODELS = ['gemini-embedding-001', 'text-embedding-004'];
    let queryEmbedding: number[] | null = null;
    let embedErr = '';

    for (const model of EMBEDDING_MODELS) {
      try {
        const payload: any = { content: { parts: [{ text: query }] } };
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
            queryEmbedding = vals;
            break;
          }
        } else {
          embedErr = await res.text();
        }
      } catch (e: any) {
        embedErr = e.message;
      }
    }

    if (!queryEmbedding) {
      throw new Error(`Failed to retrieve valid 3072-dimension embedding values from Gemini. Last error: ${embedErr}`);
    }

    // 2. Query Postgres pgvector RPC function match_listings
    const { data: matchedListings, error: searchErr } = await supabase.rpc('match_listings', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount
    });

    if (searchErr) {
      throw new Error(`Postgres similarity query failed: ${searchErr.message}`);
    }

    return new Response(
      JSON.stringify({ listings: matchedListings || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Semantic Search Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})

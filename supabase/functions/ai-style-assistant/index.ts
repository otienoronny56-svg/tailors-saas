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
    const { history, message, userName, userGender, userPreferences } = body;

    if (!message) {
      throw new Error('message is required');
    }

    // Initialize Supabase to fetch inventory
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || "https://ouuhirckiavcvgqlpriw.supabase.co";
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseKey) {
        throw new Error('Supabase client key is not set');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Generate Embedding for the user's message using candidate models
    const GEMINI_TEXT_MODELS = [
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-2.5-flash',
      'gemini-1.5-flash-001',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash'
    ];

    const EMBEDDING_MODELS = ['gemini-embedding-001', 'text-embedding-004'];

    let queryEmbedding: number[] | null = null;
    let embedErr = '';

    for (const model of EMBEDDING_MODELS) {
      try {
        const payload: any = { content: { parts: [{ text: message }] } };
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
        match_threshold: 0.1, // lower threshold to ensure we get *some* context if they are just chatting, though the model will ignore it if irrelevant
        match_count: 5 // Get top 5 most relevant items
    });

    if (searchErr) {
        throw new Error(`Postgres similarity query failed: ${searchErr.message}`);
    }

    let inventoryContext = "";
    if (matchedListings && matchedListings.length > 0) {
        inventoryContext = `\n\nCURRENT AVAILABLE INVENTORY IN THE DB:\n` +
            matchedListings.map((l: any) => {
                return `- ID: ${l.id} | Title: ${l.title} | Category: ${l.category} | Price: Ksh ${l.price} | Target: ${l.target_audience}`;
            }).join('\n');
    } else {
        inventoryContext = `\n\nCURRENT AVAILABLE INVENTORY IN THE DB:\n(No relevant items found for this query.)`;
    }

    const systemInstruction = `
      You are an expert fashion stylist for a high-end tailored clothing marketplace in Kenya.
      ${userName ? `The client you are advising is named "${userName}". Address them naturally and warmly by name (e.g., "Hello ${userName}", "Sure ${userName}").` : ''}
      ${userGender ? `Client style category preference: ${userGender}.` : ''}
      ${userPreferences ? `Client measurement/sizing context: ${JSON.stringify(userPreferences)}.` : ''}

      CRITICAL INSTRUCTIONS:
      1. Keep your responses conversational, friendly, and short.
      2. If you recommend items, you MUST ONLY USE the items listed in the "CURRENT AVAILABLE INVENTORY" below.
      3. NEVER invent, guess, or make up items. If the inventory below does not match what the user is asking for, politely inform them that we don't have exactly that, but you can suggest something else or they can request a custom tailored order.
      4. To recommend an item, you MUST output a markdown link pointing to its ID. Format the link exactly like this:
         [Exact Item Title](#listing-ID_HERE)
         For example, if the ID is 123 and Title is Red Dress, output: [Red Dress](#listing-123).
      5. Max 3 recommendations per response.
      ${inventoryContext}
    `;

    // Format chat history for Gemini
    const contents = [];
    
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === 'user') {
          contents.push({ role: 'user', parts: [{ text: msg.text }] });
        } else if (msg.role === 'model' || msg.role === 'assistant') {
          contents.push({ role: 'model', parts: [{ text: msg.text }] });
        }
      }
    }

    // Add current message
    contents.push({ role: 'user', parts: [{ text: message }] });

    const payload = {
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: contents,
      generationConfig: {
          temperature: 0.1,
      }
    };

    let data: any = null;
    let genErr = '';

    for (const model of GEMINI_TEXT_MODELS) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          data = await res.json();
          break;
        } else {
          genErr = await res.text();
          console.warn(`Gemini model ${model} failed (${res.status}): ${genErr}`);
        }
      } catch (e: any) {
        genErr = e.message;
      }
    }

    if (!data) {
      throw new Error(`Gemini API call failed across all candidate models. Last error: ${genErr}`);
    }

    let textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
    
    console.log("Raw AI response:", textResult);

    return new Response(
      JSON.stringify({ reply: textResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Style Assistant Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})

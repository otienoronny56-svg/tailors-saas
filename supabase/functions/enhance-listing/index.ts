// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const body = await req.json();
    const { imageBase64, mimeType, currentTitle, currentDesc } = body;

    if (!imageBase64) {
      throw new Error('imageBase64 is required');
    }

    const prompt = `
      You are an expert fashion consultant and copywriter for a high-end tailored clothing marketplace in Kenya.
      Analyze the provided image of a garment.
      ${currentTitle ? `The user provided this title hint: "${currentTitle}"` : ''}
      ${currentDesc ? `The user provided this description hint: "${currentDesc}"` : ''}

      Generate a JSON object with the following fields:
      - title: A catchy, elegant, and descriptive title for this garment. (Max 6 words)
      - description: A rich, professional, and alluring description detailing the material, style, and fit. Highlight the craftsmanship. (2-3 sentences)
      - category: Choose ONLY ONE from: "Suits", "Senator Wear", "African Attire", "Dresses", "Shirts", "Trousers", "Coats", "Jumpsuits & Rompers", "Hoodies & Sweatshirts", "T-Shirts & Polos", "Jeans & Denim", "Jackets & Cardigans", "Ready-to-Wear Dresses", "Activewear", "Watches", "Glasses & Shades", "Ties & Bowties", "Scarves & Capes", "Belts", "Hats & Caps", "Bags & Clutches", "Jewellery", "Walking Sticks & Canes", "Shoes", "Sandals & Slippers", "Boots".
      - target_audience: Choose ONLY ONE from: "Unisex", "Men", "Ladies", "Children".

      Return strictly the raw JSON without any markdown formatting like \`\`\`json.
    `;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType || "image/jpeg",
              data: imageBase64
            }
          }
        ]
      }],
      generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
      }
    };

    const GEMINI_TEXT_MODELS = [
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-2.5-flash',
      'gemini-1.5-flash-001',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash'
    ];

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

    let textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Clean up potential markdown formatting just in case
    textResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedData = JSON.parse(textResult);

    return new Response(
      JSON.stringify(parsedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})

// ============================================================
//  Cloudflare Worker — OpenRouter API Proxy
//  Deploy this at: Cloudflare Dashboard > Workers > Create
//  Then add your secret: Settings > Variables > OPENROUTER_API_KEY
// ============================================================

export default {
  async fetch(request, env) {

    // Allow your frontend to talk to this worker (CORS)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",   // Replace * with your Cloudflare Pages URL for more security
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Browser sends an OPTIONS request first — just say yes
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST requests
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      // Get the chat messages sent from your frontend
      const body = await request.json();

      // Forward the request to OpenRouter
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,  // Secret key, never exposed
          "Content-Type": "application/json",
          "HTTP-Referer": "https://devmind.ai.pages.dev",        // Change to your Cloudflare Pages URL
          "X-Title": "My AI Coding Assistant",
        },
        body: JSON.stringify({
          model: body.model || "meta-llama/llama-3.1-8b-instruct:free",
          messages: body.messages,
          stream: false,
        }),
      });

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: "Worker error: " + error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  },
};
export default async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set in Netlify environment variables" }), {
      status: 500, headers: corsHeaders,
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400, headers: corsHeaders });
  }

  let anthropicRes;
  let rawText;

  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify(body),
    });

    rawText = await anthropicRes.text();
  } catch (e) {
    return new Response(JSON.stringify({ error: `Upstream fetch failed: ${e.message}` }), {
      status: 502, headers: corsHeaders,
    });
  }

  // Try to parse as JSON, fall back to returning raw text wrapped in error
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    return new Response(JSON.stringify({ error: `Anthropic returned non-JSON (status ${anthropicRes.status}): ${rawText.slice(0, 300)}` }), {
      status: 502, headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify(data), {
    status: anthropicRes.status,
    headers: corsHeaders,
  });
};

export const config = { path: "/api/search" };

// Fetches median house price from homeswatch.netlify.app/api/prices
// (pre-processed NSW VG data, cached weekly)

const cache = {};
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

export default async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST")   return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers: cors }); }

  const { suburb, propType = "house" } = body;
  if (!suburb) return new Response(JSON.stringify({ error: "suburb required" }), { status: 400, headers: cors });

  const key = `prices_${propType}`;

  if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) {
    const price = cache[key].data[suburb.toUpperCase()];
    console.log(`Cache hit: ${suburb} = ${price}, total: ${Object.keys(cache[key].data).length}`);
    return new Response(JSON.stringify({ suburb, price: price || null, source: "NSW VG (cached)", cached: true }), { status: 200, headers: cors });
  }

  // Try multiple endpoints
  const endpoints = [
    "https://homeswatch.netlify.app/api/prices",
    "https://homes.ml/.netlify/functions/prices",
  ];

  let prices = null;
  let updatedAt = null;

  for (const url of endpoints) {
    try {
      console.log(`Trying: ${url}`);
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      console.log(`${url} → ${res.status}`);
      if (!res.ok) continue;
      const data = await res.json();
      const p = propType === "unit" ? (data.unit || {}) : (data.house || {});
      if (Object.keys(p).length > 10) {
        prices = p;
        updatedAt = data.updatedAt || null;
        console.log(`Got ${Object.keys(p).length} suburbs from ${url}`);
        break;
      }
    } catch (e) {
      console.log(`${url} failed: ${e.message}`);
    }
  }

  if (!prices) {
    return new Response(JSON.stringify({ suburb, price: null, error: "All price endpoints failed" }), { status: 200, headers: cors });
  }

  cache[key] = { data: prices, ts: Date.now() };

  const price = prices[suburb.toUpperCase()];
  console.log(`${suburb.toUpperCase()} = ${price}`);

  const month = updatedAt
    ? new Date(updatedAt).toLocaleString("en-AU", { month: "short", year: "numeric" })
    : new Date().toLocaleString("en-AU", { month: "short", year: "numeric" });

  return new Response(JSON.stringify({
    suburb,
    price: price || null,
    source: `NSW VG · ${month}`,
    totalSuburbs: Object.keys(prices).length,
  }), { status: 200, headers: cors });
};

export const config = { path: "/api/median" };

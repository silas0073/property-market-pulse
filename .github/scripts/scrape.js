const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.SCRAPINGBEE_API_KEY;
if (!API_KEY) { console.error('Missing SCRAPINGBEE_API_KEY'); process.exit(1); }

const TARGETS = [
  {
    label: 'Muswellbrook',
    postcode: '2333',
    forSaleUrl: 'https://www.realestate.com.au/buy/property-house-in-muswellbrook,+nsw+2333/list-1?maxBeds=3&includeSurrounding=false&activeSort=list-date',
    soldUrl:    'https://www.realestate.com.au/sold/property-house-in-muswellbrook,+nsw+2333/list-1?maxBeds=3&includeSurrounding=false&maxSoldAge=1-month',
  },
  {
    label: 'Lalor Park',
    postcode: '2147',
    forSaleUrl: 'https://www.realestate.com.au/buy/property-house-in-lalor-park,+nsw+2147/list-1?maxBeds=3&includeSurrounding=false&activeSort=list-date',
    soldUrl:    'https://www.realestate.com.au/sold/property-house-in-lalor-park,+nsw+2147/list-1?maxBeds=3&includeSurrounding=false&maxSoldAge=1-month',
  },
];

// ScrapingBee renders JS — we need render_js=true for REA (React SPA)
async function scrape(url) {
  console.log('Fetching:', url);
  const resp = await axios.get('https://app.scrapingbee.com/api/v1/', {
    params: {
      api_key: API_KEY,
      url,
      render_js: true,
      wait: 3000,           // wait 3s for React to render
      block_ads: true,
      block_resources: true, // faster — skip images/fonts
    },
    timeout: 60000,
  });
  return resp.data;
}

function parseListingCount(html) {
  const $ = cheerio.load(html);

  // REA renders count in several places — try each selector
  const selectors = [
    '[data-testid="results-count"]',
    '.results-count',
    'h1[data-testid]',
    '[class*="resultsCount"]',
    '[class*="results-count"]',
  ];

  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    if (text) {
      const num = text.match(/[\d,]+/);
      if (num) {
        const count = parseInt(num[0].replace(/,/g, ''), 10);
        console.log(`  Found via "${sel}": "${text}" → ${count}`);
        return count;
      }
    }
  }

  // Fallback: scan all text for "X properties" or "X results" pattern
  const bodyText = $('body').text();
  const patterns = [
    /(\d[\d,]*)\s+(?:properties?|results?|homes?)\s+(?:for sale|sold)/i,
    /(\d[\d,]*)\s+(?:properties?|results?)/i,
  ];
  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match) {
      const count = parseInt(match[1].replace(/,/g, ''), 10);
      console.log(`  Found via regex: ${count}`);
      return count;
    }
  }

  console.warn('  Could not parse count from page');
  return null;
}

function formatDate(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function calcMetrics(forSale, sold30d) {
  if (forSale === null || sold30d === null) return null;
  let absorptionRate = 0, monthsSupply = null;
  if (forSale > 0 && sold30d > 0) {
    absorptionRate = Math.round(sold30d / forSale * 1000) / 10;
    monthsSupply   = Math.round(forSale / sold30d * 10) / 10;
  } else if (sold30d > 0 && forSale === 0) {
    absorptionRate = 100;
    monthsSupply   = 0;
  }
  const signal = monthsSupply <= 2 ? 'hot' : monthsSupply <= 4 ? 'warm' : 'cold';
  return { absorptionRate, monthsSupply, signal };
}

async function main() {
  const now   = new Date();
  const date  = formatDate(now);
  const time  = now.toTimeString().slice(0,5);

  // Load existing history
  const dataPath = path.join(process.cwd(), 'data', 'history.json');
  let history = [];
  try { history = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch {}

  const newEntries = [];

  for (const target of TARGETS) {
    console.log(`\n=== ${target.label} (${target.postcode}) ===`);

    try {
      const [forSaleHtml, soldHtml] = await Promise.all([
        scrape(target.forSaleUrl),
        scrape(target.soldUrl),
      ]);

      const forSale = parseListingCount(forSaleHtml);
      const sold30d = parseListingCount(soldHtml);

      console.log(`  For Sale: ${forSale} | Sold 30d: ${sold30d}`);

      const metrics = calcMetrics(forSale, sold30d);
      if (!metrics) { console.warn('  Skipping — could not calculate metrics'); continue; }

      const entry = {
        id:              now.getTime() + Math.random(),
        date,
        time,
        location:        `${target.label} · ${target.postcode}`,
        type:            'House',
        beds:            '3',
        for_sale:        forSale,
        sold_30d:        sold30d,
        absorption_rate: metrics.absorptionRate,
        months_supply:   metrics.monthsSupply,
        median_price:    null,
        median_dom:      null,
        signal:          metrics.signal,
        source:          'auto',
      };

      newEntries.push(entry);
      console.log(`  ✅ ${metrics.absorptionRate}% absorption | ${metrics.monthsSupply}mo supply | ${metrics.signal.toUpperCase()}`);

    } catch (err) {
      console.error(`  ❌ Failed for ${target.label}:`, err.message);
    }
  }

  if (newEntries.length === 0) {
    console.log('\nNo new entries — nothing to save.');
    process.exit(0);
  }

  // Prepend new entries, keep last 52 weeks (104 entries max)
  const updated = [...newEntries, ...history].slice(0, 104);
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(updated, null, 2));
  console.log(`\nSaved ${newEntries.length} new entries. Total: ${updated.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });

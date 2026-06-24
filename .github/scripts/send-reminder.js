const https = require('https');

const MUSWELLBROOK_FOR_SALE = 'https://www.realestate.com.au/buy/property-house-in-muswellbrook,+nsw+2333/list-1?maxBeds=3&includeSurrounding=false&activeSort=list-date';
const MUSWELLBROOK_SOLD     = 'https://www.realestate.com.au/sold/property-house-in-muswellbrook,+nsw+2333/list-1?maxBeds=3&includeSurrounding=false&maxSoldAge=1-month&source=refinement';
const LALOR_FOR_SALE        = 'https://www.realestate.com.au/buy/property-house-in-lalor-park,+nsw+2147/list-1?maxBeds=3&includeSurrounding=false&activeSort=list-date';
const LALOR_SOLD            = 'https://www.realestate.com.au/sold/property-house-in-lalor-park,+nsw+2147/list-1?maxBeds=3&includeSurrounding=false&maxSoldAge=1-month&source=refinement';
const CALCULATOR_URL        = 'https://propcheckpost.netlify.app';

const now     = new Date();
const dateStr = now.toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: -apple-system, 'Inter', sans-serif; background: #f0ede8; margin: 0; padding: 32px; color: #0d0d0d; }
  .card { background: #fff; border: 1px solid #ccc8be; border-radius: 3px; max-width: 600px; margin: 0 auto; overflow: hidden; }
  .header { background: #f5f3ef; border-bottom: 1px solid #ccc8be; padding: 20px 28px; }
  .title { font-size: 13px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: #a07800; }
  .date  { font-size: 11px; color: #888880; margin-top: 4px; letter-spacing: .08em; }
  .body  { padding: 24px 28px; }
  .step  { margin-bottom: 24px; }
  .step-label { font-size: 10px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; color: #888880; margin-bottom: 8px; }
  .location { font-size: 13px; font-weight: 700; color: #0d0d0d; margin-bottom: 8px; }
  .btn { display: inline-block; padding: 8px 16px; border-radius: 2px; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-decoration: none; margin-right: 8px; margin-bottom: 6px; }
  .btn-sale { background: #fdf0c0; border: 1px solid rgba(196,154,0,.4); color: #a07800; }
  .btn-sold { background: #d4f0e0; border: 1px solid rgba(26,122,74,.3); color: #155c38; }
  .btn-calc { background: #a07800; color: #fff; border: 1px solid #a07800; }
  .divider { border: none; border-top: 1px solid #e8e4de; margin: 20px 0; }
  .footer { font-size: 10px; color: #aaa898; letter-spacing: .08em; padding: 14px 28px; background: #f5f3ef; border-top: 1px solid #ccc8be; }
  .instructions { font-size: 12px; color: #555550; line-height: 1.8; background: #f5f3ef; border: 1px solid #e8e4de; border-radius: 2px; padding: 12px 16px; margin-bottom: 20px; }
  .instructions ol { padding-left: 18px; margin: 0; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="title">Property Market Pulse</div>
    <div class="date">Weekly snapshot — ${dateStr}</div>
  </div>
  <div class="body">
    <div class="instructions">
      <ol>
        <li>Click each REA link below and note the <strong>listing count</strong></li>
        <li>Open the calculator and enter the numbers</li>
        <li>Hit <strong>Calculate</strong> then <strong>Save Entry</strong></li>
      </ol>
    </div>
    <div class="step">
      <div class="step-label">Step 1 — Muswellbrook · 2333 · House · 3bd</div>
      <div class="location">Muswellbrook</div>
      <a class="btn btn-sale" href="${MUSWELLBROOK_FOR_SALE}">For Sale →</a>
      <a class="btn btn-sold" href="${MUSWELLBROOK_SOLD}">Sold 30d →</a>
    </div>
    <hr class="divider"/>
    <div class="step">
      <div class="step-label">Step 2 — Lalor Park · 2147 · House · 3bd</div>
      <div class="location">Lalor Park</div>
      <a class="btn btn-sale" href="${LALOR_FOR_SALE}">For Sale →</a>
      <a class="btn btn-sold" href="${LALOR_SOLD}">Sold 30d →</a>
    </div>
    <hr class="divider"/>
    <div class="step">
      <div class="step-label">Step 3 — Enter &amp; save</div>
      <a class="btn btn-calc" href="${CALCULATOR_URL}">Open Calculator →</a>
    </div>
  </div>
  <div class="footer">Sent automatically every Monday · Property Market Pulse · propcheckpost.netlify.app</div>
</div>
</body>
</html>`;

function sendEmail() {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      from: 'Property Market Pulse <onboarding@resend.dev>',
      to:   ['silas007@gmail.com'],
      subject: `📊 Weekly Market Snapshot — ${dateStr}`,
      html,
    });

    const req = https.request({
      hostname: 'api.resend.com',
      path:     '/emails',
      method:   'POST',
      headers:  {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Email sent:', body);
          resolve();
        } else {
          reject(new Error(`Resend API error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

sendEmail().catch(e => { console.error('❌', e.message); process.exit(1); });

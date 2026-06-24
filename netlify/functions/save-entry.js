const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER   = 'silas0073';
const REPO_NAME    = 'property-market-pulse';
const FILE_PATH    = 'data/history.json';

function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent':    'property-market-pulse',
        'Content-Type':  'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  try {
    const { entry } = await req.json();
    if (!entry) return new Response(JSON.stringify({ error: 'No entry provided' }), { status: 400, headers });

    // Get current file from GitHub
    const filePath = `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const getRes = await githubRequest('GET', filePath);

    let history = [];
    let sha = null;

    if (getRes.status === 200) {
      sha = getRes.body.sha;
      history = JSON.parse(Buffer.from(getRes.body.content, 'base64').toString('utf8'));
    }

    // Add new entry, avoid duplicates by id
    const exists = history.some(e => e.id === entry.id);
    if (!exists) {
      history.unshift({ ...entry, source: 'manual' });
      history = history.slice(0, 200); // cap at 200 entries
    }

    // Write back to GitHub
    const content = Buffer.from(JSON.stringify(history, null, 2)).toString('base64');
    const putBody = {
      message: `data: save entry ${entry.date} ${entry.location}`,
      content,
      ...(sha ? { sha } : {}),
    };

    const putRes = await githubRequest('PUT', filePath, putBody);
    if (putRes.status !== 200 && putRes.status !== 201) {
      throw new Error(`GitHub write failed: ${putRes.status}`);
    }

    return new Response(JSON.stringify({ ok: true, total: history.length }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

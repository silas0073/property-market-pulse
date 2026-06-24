const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER   = 'silas0073';
const REPO_NAME    = 'property-market-pulse';
const FILE_PATH    = 'data/history.json';

export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };

  try {
    const data = await new Promise((resolve, reject) => {
      https.get({
        hostname: 'api.github.com',
        path: `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'User-Agent': 'property-market-pulse',
        },
      }, res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve(JSON.parse(body)));
      }).on('error', reject);
    });

    if (!data.content) return new Response(JSON.stringify([]), { status: 200, headers });

    const history = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
    return new Response(JSON.stringify(history), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify([]), { status: 200, headers }); // fail silently
  }
};

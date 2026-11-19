// TradeFlow quote proxy — Cloudflare Worker. Keeps your EODHD token off the phone.
// Deploy:  npx wrangler deploy        (in this folder)
// Token:   npx wrangler secret put EODHD_TOKEN
// Then in config.js set  proxyUrl: 'https://<your-worker>.workers.dev'  and clear eodhdKey.
const ALLOWED_ORIGINS = ['*'];      // tighten to your app's origin once hosted, e.g. ['https://app.example.com']
const MAX_SYMBOLS = 25;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes('*') ? '*' : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname === '/health') return new Response('ok', { headers: cors });
    if (url.pathname !== '/quotes') return new Response('Not found', { status: 404, headers: cors });
    if (!env.EODHD_TOKEN) return new Response('EODHD_TOKEN not set', { status: 500, headers: cors });

    // symbols look like AAPL.US, EURUSD.FOREX, BTC-USD.CC, GSPC.INDX
    const symbols = [...new Set((url.searchParams.get('symbols') || '').toUpperCase().split(',').filter(s => /^[A-Z0-9.\-_]{1,20}$/.test(s)))].slice(0, MAX_SYMBOLS);
    if (!symbols.length) return new Response('No symbols', { status: 400, headers: cors });

    // cache for 20s so many phones share one upstream call
    const cache = caches.default, key = new Request('https://cache.local/quotes?s=' + symbols.join(','));
    const hit = await cache.match(key);
    if (hit) return new Response(hit.body, { headers: { 'Content-Type': 'application/json', ...cors } });

    const up = `https://eodhd.com/api/real-time/${symbols[0]}?api_token=${env.EODHD_TOKEN}&fmt=json` + (symbols.length > 1 ? '&s=' + symbols.slice(1).join(',') : '');
    const r = await fetch(up);
    const body = await r.text();
    if (!r.ok) return new Response(body, { status: r.status, headers: cors });   // pass 401/402/429 through so the app can say why
    const res = new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=20' } });
    ctx.waitUntil(cache.put(key, res.clone()));
    return new Response(body, { headers: { 'Content-Type': 'application/json', ...cors } });
  },
};

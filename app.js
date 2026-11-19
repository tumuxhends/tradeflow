/* TradeFlow — mobile web app (PWA).
   Pages: Home · Stocks · Referral · Profile · Finance.  Dark + light theme.  Live market feed.
   Everything is local (no backend): wallet, holdings and transactions persist in localStorage. */
(() => {
'use strict';

/* ───────────── config ───────────── */
const BRAND = 'TradeFlow';
/* ── DATA SOURCES ─────────────────────────────────────────────────────────
   The API token lives in config.js (next to this file), not here.
   Exchange rate: live with no key (open.er-api.com); falls back to fallbackRate if offline.
   Prices: with no token the app runs a demo feed. With one of these set it uses real quotes from EODHD:
     proxyUrl – recommended: your own proxy (see /worker) that holds the token.
     eodhdKey – quick start: the token is sent from the app, so anyone who opens the app can read it. */
const CONFIG = {
  proxyUrl: '',
  eodhdKey: '',
  eodhdUrl: 'https://eodhd.com/api/real-time/',
  pollMs: 30000,                          // each quote costs API calls on EODHD, so poll gently
  maxPerPoll: 20,                         // symbols per refresh; longer lists are refreshed in rotation
  fxUrl: 'https://open.er-api.com/v6/latest/USD',
  fxRefreshMs: 60 * 60 * 1000,
  fallbackRate: 3700,                     // used until the first live rate arrives
};
Object.assign(CONFIG, window.TRADEFLOW_CONFIG || {});
const LIVE_DATA = !!(CONFIG.proxyUrl || CONFIG.eodhdKey);
let RATE = CONFIG.fallbackRate, RATE_AT = 0, RATE_LIVE = false;   // 1 USD = RATE UGX
try { const c = JSON.parse(localStorage.getItem('tradeflow.rate') || 'null'); if (c && c.rate > 0) { RATE = c.rate; RATE_AT = c.at; RATE_LIVE = true; } } catch (e) {}
const STORE_KEY = 'tradeflow.v2';
const TICK_MS = 2000;                    // live feed interval
const REF_BASE = 'https://cryptocash.com/register?ref=';
const MIN_DEPOSIT = 5000, MIN_WITHDRAW = 10000;

/* ───────────── icons ───────────── */
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  stocks: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.2c2.7.2 4.5 2 4.5 4.8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14" r="1.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20.4 14.6A8.5 8.5 0 0 1 9.4 3.6a8.5 8.5 0 1 0 11 11z"/>',
  down: '<path d="M12 4v14M6 12l6 6 6-6"/>',
  up: '<path d="M12 20V6M6 12l6-6 6 6"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  out: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M7.5 8a2.5 2.5 0 1 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 1 1 0 5"/>',
  bolt: '<path d="M13 3 4 14h7l-1 7 9-11h-7z"/>',
  chat: '<path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  fb: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2"/>',
  pie: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.4-.9-1.4-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2.1-.6-2.5-1.5M12 6.5V8M12 16v1.5"/>',
};
const ic = (n, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[n]}</svg>`;

/* ───────────── helpers ───────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fUSD = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fNum = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fUGX = n => 'UGX ' + Math.round(n).toLocaleString('en-US');
const sUGX = n => (n >= 0 ? '+' : '−') + fUGX(Math.abs(n));
const sPct = n => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2) + '%';
const pad2 = n => String(n).padStart(2, '0');
const hms = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const hm = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const shortDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const uid = () => Math.random().toString(36).slice(2, 9);
const initials = n => (n.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase();
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const rng = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

/* ───────────── state ───────────── */
const DAY = 864e5;
const now0 = Date.now();
const defaults = () => ({
  theme: 'dark', live: true,
  profile: { name: 'Rita Smith', phone: '+256 771 717 171', email: 'rita@gmail.com', since: 'Nov 2026' },
  funds: 0,
  refBal: 0, refEarned: 0,
  holdings: {},
  orders: [],
  tx: [],
});
let S = defaults();
try { const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (raw) S = Object.assign(defaults(), raw, { profile: Object.assign(defaults().profile, raw.profile || {}) }); } catch (e) {}
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {} };

const REFS = { all: 0, today: 0, recent: [] };

/* ───────────── market engine (live feed) ─────────────
   Swap `tick()` for a WebSocket/REST provider: just write new prices into A[sym].price
   and call afterTick(). The UI only reads from A[...]. */
const STOCK_DEF = [
  ['AAPL', 'Apple Inc.', 173.50, 2.35, '#3b82f6,#6366f1'],
  ['MSFT', 'Microsoft Corp.', 378.91, -1.24, '#0ea5e9,#22d3ee'],
  ['GOOGL', 'Alphabet Inc.', 141.80, 0.95, '#ef4444,#f59e0b'],
  ['AMZN', 'Amazon.com', 178.35, 3.12, '#f59e0b,#d97706'],
  ['TSLA', 'Tesla Inc.', 248.50, -5.20, '#ef4444,#f97316'],
  ['NVDA', 'NVIDIA Corp.', 495.22, 8.45, '#10b981,#059669'],
  ['META', 'Meta Platforms', 505.68, 1.80, '#3b82f6,#8b5cf6'],
  ['NFLX', 'Netflix Inc.', 628.90, -2.15, '#e11d48,#be123c'],
  ['AMD', 'AMD Inc.', 164.32, 4.21, '#10b981,#14b8a6'],
  ['INTC', 'Intel Corp.', 31.45, -0.85, '#64748b,#475569'],
];
const EXTRA_COL = { majors: '#3b82f6,#06b6d4', minors: '#8b5cf6,#6366f1', exotic: '#ec4899,#f43f5e', metals: '#eab308,#f59e0b', crypto: '#f97316,#ea580c' };
const EXTRA_DEF = [   // [category, symbol, name, demo price, % change]  — placeholder numbers for the demo feed
  ['majors', 'EUR/USD', 'Euro / US Dollar', 1.0842, .12], ['majors', 'GBP/USD', 'Pound / US Dollar', 1.2931, -.08], ['majors', 'USD/JPY', 'US Dollar / Yen', 151.42, .35],
  ['majors', 'USD/CHF', 'US Dollar / Franc', .8814, -.05], ['majors', 'AUD/USD', 'Aussie / US Dollar', .6523, .21], ['majors', 'USD/CAD', 'US Dollar / Canadian', 1.3715, .09], ['majors', 'NZD/USD', 'Kiwi / US Dollar', .5987, -.14],
  ['minors', 'EUR/GBP', 'Euro / Pound', .8386, .04], ['minors', 'EUR/JPY', 'Euro / Yen', 164.17, .46], ['minors', 'GBP/JPY', 'Pound / Yen', 195.8, .27], ['minors', 'AUD/JPY', 'Aussie / Yen', 98.78, .55], ['minors', 'EUR/CHF', 'Euro / Franc', .9556, -.11], ['minors', 'CAD/JPY', 'Canadian / Yen', 110.41, -.02],
  ['exotic', 'USD/ZAR', 'US Dollar / Rand', 18.62, .62], ['exotic', 'USD/TRY', 'US Dollar / Lira', 32.41, .18], ['exotic', 'USD/MXN', 'US Dollar / Peso', 17.08, -.33], ['exotic', 'USD/SEK', 'US Dollar / Krona', 10.64, .14], ['exotic', 'USD/NOK', 'US Dollar / Krone', 10.82, .09], ['exotic', 'USD/UGX', 'US Dollar / Ugandan Shilling', 3700, .05],
  ['metals', 'XAU/USD', 'Gold', 2038.4, .52], ['metals', 'XAG/USD', 'Silver', 23.15, .88], ['metals', 'XPT/USD', 'Platinum', 912.6, -.41], ['metals', 'XPD/USD', 'Palladium', 968.3, -1.05],
  ['crypto', 'BTC/USD', 'Bitcoin', 43250, 1.9], ['crypto', 'ETH/USD', 'Ethereum', 2310, 2.4], ['crypto', 'SOL/USD', 'Solana', 98.4, 3.8], ['crypto', 'BNB/USD', 'BNB', 312.5, .7], ['crypto', 'XRP/USD', 'XRP', .62, -.9], ['crypto', 'ADA/USD', 'Cardano', .54, 1.2],
];
const IDX_DEF = [['SPX', 'S&P 500', 5847.32, 1.24], ['IXIC', 'NASDAQ', 18342.91, -0.58], ['DJI', 'Dow Jones', 42156.78, 0.89]];
const A = {};              // all assets by symbol
const STOCKS = [], INDICES = [];
/* symbol used by EODHD: AAPL.US · GSPC.INDX · EURUSD.FOREX · XAUUSD.FOREX · BTC-USD.CC */
function eodSym(a) {
  if (a.cat === 'stocks') return a.sym + '.US';
  if (a.cat === 'indices') return ({ SPX: 'GSPC', IXIC: 'IXIC', DJI: 'DJI' }[a.sym] || a.sym) + '.INDX';
  const [b, q] = a.sym.split('/');
  return a.cat === 'crypto' ? `${b}-${q}.CC` : `${b}${q}.FOREX`;
}
const TF = { LIVE: 'Live', '1D': '1D', '1W': '1W', '1M': '1M', '1Y': '1Y' };
const TF_N = { '1D': 78, '1W': 70, '1M': 60, '1Y': 90 }, TF_SPAN = { '1W': 7 * DAY, '1M': 30 * DAY, '1Y': 365 * DAY }, TF_DRIFT = { '1W': .05, '1M': .12, '1Y': .4 };

function bridge(r, start, end) { const n = r.length, tail = r[n - 1]; return r.map((x, i) => start + x - (i / (n - 1)) * (tail - (end - start))); }
function makeHist(a, tf) {
  const R = rng(hash(a.sym + tf)), n = TF_N[tf], end = a.price;
  const start = tf === '1D' ? a.open : end / (1 + (R() - .42) * TF_DRIFT[tf] * a.vs);
  const vol = Math.abs(end - start) * .3 + end * (tf === '1D' ? .0035 : .012) * a.vs;
  const r = [0]; for (let i = 1; i < n; i++) r.push(r[i - 1] + (R() - .5) * vol * 2);
  const vals = bridge(r, start, end).map(v => Math.max(v, end * .2));
  return vals.map((v, i) => {
    let l;
    if (tf === '1D') { const m = 570 + i * (390 / (n - 1)); l = `${pad2(Math.floor(m / 60))}:${pad2(Math.round(m % 60) % 60)}`; }
    else { const t = new Date(now0 - (n - 1 - i) * TF_SPAN[tf] / (n - 1)); l = tf === '1Y' ? t.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : shortDate(t); }
    return { v, l };
  });
}
function makeLive(a) {
  const R = rng(hash(a.sym + 'live')), n = 60, end = a.price, vol = end * a.vk * 1.3;
  const r = [0]; for (let i = 1; i < n; i++) r.push(r[i - 1] + (R() - .5) * vol * 2);
  return bridge(r, end - (R() - .5) * vol * 3, end).map((v, i) => ({ v, l: hms(new Date(now0 - (n - 1 - i) * TICK_MS)) }));
}
function initMarket() {
  const add = (sym, name, price, chg, idx, colors, o = {}) => {
    const cat = o.cat || (idx ? 'indices' : 'stocks'), pctMode = idx || o.pct;
    const a = { sym, name, price, prev: price, idx, cat, colors, trade: cat === 'stocks', cur: o.cur ?? (idx || cat === 'majors' || cat === 'minors' || cat === 'exotic' ? '' : '$'),
      dec: o.dec ?? 2, vs: o.vs ?? 1, vk: o.vk ?? (idx ? .00022 : .0007),
      vol: (hash(sym) % 90 + 10) * ({ majors: 50, minors: 30, exotic: 12, metals: 10, crypto: 30, indices: 5, stocks: 20 }[cat]),
      open: pctMode ? price / (1 + chg / 100) : price - chg, dir: 0, series: {} };
    a.eod = eodSym(a);
    a.series.LIVE = makeLive(a);
    Object.keys(TF_N).forEach(tf => a.series[tf] = makeHist(a, tf));
    A[sym] = a; if (idx) INDICES.push(a); else if (cat === 'stocks') STOCKS.push(a);
  };
  STOCK_DEF.forEach(([s, n, p, c, col]) => add(s, n, p, c, false, col));
  IDX_DEF.forEach(([s, n, p, c]) => add(s, n, p, c, true, '#f59e0b,#f97316'));
  // Other markets (watch-only). Demo numbers are placeholders; in live mode they show '—' until a real quote arrives.
  EXTRA_DEF.forEach(([cat, sym, name, price, pct]) => {
    const fx = cat === 'majors' || cat === 'minors' || cat === 'exotic';
    add(sym, name, price, pct, false, EXTRA_COL[cat], { cat, pct: true, dec: fx ? (price > 50 ? 3 : 4) : (price < 1 ? 4 : 2), vs: fx ? .15 : cat === 'metals' ? .6 : 1.6, vk: fx ? .00008 : cat === 'metals' ? .0003 : .0012 });
  });
}
const tfKeys = () => LIVE_DATA ? ['LIVE'] : Object.keys(TF);   // no history source on free plans
const chgPct = a => (a.price - a.open) / a.open * 100;
const fmtPx = (a, v) => a.cur + v.toLocaleString('en-US', { minimumFractionDigits: a.dec, maximumFractionDigits: a.dec });
const live0 = a => LIVE_DATA && !a.real;          // live mode and no real quote yet
const fPx = a => live0(a) ? '—' : fmtPx(a, a.price);
const fChg = a => live0(a) ? '—' : sPct(chgPct(a));
const logoTxt = a => a.cat === 'stocks' || a.cat === 'indices' ? a.sym[0] : a.sym.replace('/', '').slice(0, 3);

function tick() {
  const t = new Date();
  Object.values(A).forEach(a => {
    const vol = a.price * a.vk, p10 = 10 ** a.dec;
    const np = Math.max(a.price * .5, a.price + (Math.random() - .5) * 2 * vol + (a.open - a.price) * .0006);
    a.prev = a.price; a.price = Math.round(np * p10) / p10; a.dir = Math.sign(a.price - a.prev);
    a.series.LIVE.push({ v: a.price, l: hms(t) }); if (a.series.LIVE.length > 90) a.series.LIVE.shift();
    Object.keys(TF_N).forEach(tf => { a.series[tf][TF_N[tf] - 1].v = a.price; });
  });
}

/* ───────────── portfolio maths ───────────── */
function portfolio() {
  let mv = 0, pl = 0, cost = 0;
  for (const sym in S.holdings) { const h = S.holdings[sym], a = A[sym]; if (!a) continue; if (live0(a)) { mv += h.qty * h.avg * RATE; cost += h.qty * h.avg * RATE; continue; } mv += h.qty * a.price * RATE; pl += h.qty * (a.price - a.open) * RATE; cost += h.qty * h.avg * RATE; }
  const pending = S.tx.filter(t => t.status === 'pending').reduce((s, t) => s + Math.abs(t.amt), 0);
  return { mv, pl, cost, unreal: mv - cost, total: S.funds + mv + S.refBal, assets: S.funds + mv, pending, plPct: mv - pl > 0 ? pl / (mv - pl) * 100 : 0 };
}
function bindings() {
  const p = portfolio();
  return {
    total: { t: fUGX(p.total) }, funds: { t: fUGX(S.funds) }, mv: { t: fUGX(p.mv) }, assets: { t: fUGX(p.assets) },
    pl: { t: sUGX(p.pl), s: p.pl }, plPct: { t: sPct(p.plPct) + ' today', s: p.pl }, refBal: { t: fUGX(S.refBal) },
    unreal: { t: sUGX(p.unreal), s: p.unreal }, pending: { t: fUGX(p.pending) },
    heroPl: { t: `${p.pl >= 0 ? '▲' : '▼'} ${sUGX(p.pl)} today`, s: p.pl },
  };
}

/* ───────────── charts ───────────── */
function sparkSVG(series, up) {
  const vals = series.map(p => p.v), n = vals.length; let min = Math.min(...vals), max = Math.max(...vals); const sp = (max - min) || max * .001;
  const X = i => i / (n - 1) * 100, Y = v => 4 + 32 * (1 - (v - min) / sp);
  let d = ''; vals.forEach((v, i) => d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1));
  return `<svg viewBox="0 0 100 40" preserveAspectRatio="none" style="color:var(${up ? '--up' : '--down'})"><path d="${d}L100 40L0 40Z" fill="currentColor" fill-opacity=".13"/><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}
const CH = { w: 340, h: 210, padL: 4, padR: 44, padT: 12, padB: 8, series: [], scrub: false };
function chartSVG(series, up, dec) {
  const { w, h, padL, padR, padT, padB } = CH, n = series.length;
  let min = Infinity, max = -Infinity; series.forEach(p => { if (p.v < min) min = p.v; if (p.v > max) max = p.v; });
  const sp = (max - min) || max * .002; min -= sp * .12; max += sp * .12;
  const X = i => padL + (w - padL - padR) * i / (n - 1), Y = v => padT + (h - padT - padB) * (1 - (v - min) / (max - min));
  let d = ''; series.forEach((p, i) => d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1));
  const col = up ? 'var(--up)' : 'var(--down)';
  let grid = ''; for (let k = 0; k < 4; k++) { const v = max - (max - min) * k / 3, y = Y(v); grid += `<line x1="${padL}" x2="${w - padR + 4}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-dasharray="3 4" opacity=".7"/><text x="${w - padR + 8}" y="${y + 3.5}" font-size="10" fill="var(--text-3)">${v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}</text>`; }
  const lx = X(n - 1), ly = Y(series[n - 1].v);
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".32"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${d}L${lx} ${h - padB}L${X(0)} ${h - padB}Z" fill="url(#cg)"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${lx}" cy="${ly}" r="9" fill="${col}" opacity=".18" class="end-dot"/><circle cx="${lx}" cy="${ly}" r="3.8" fill="${col}" stroke="var(--card)" stroke-width="2"/></svg>`;
}

/* ───────────── theme ───────────── */
const resolveTheme = () => S.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : S.theme;
function applyTheme() {
  const t = resolveTheme(); document.documentElement.setAttribute('data-theme', t);
  const m = $('#themeColor'); if (m) m.content = t === 'light' ? '#f8fafc' : '#0f172a';
  $$('[data-themeicon]').forEach(el => el.innerHTML = ic(t === 'dark' ? 'sun' : 'moon'));
}
function setTheme(p) { S.theme = p; save(); applyTheme(); if (page === 'profile') renderProfile(); }
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (S.theme === 'system') applyTheme(); });

/* ───────────── toast + sheet ───────────── */
let toastT;
function toast(title, msg, err) {
  const t = $('#toast'); t.classList.toggle('error', !!err); $('.ti', t).innerHTML = ic(err ? 'x' : 'check');
  $('#toastTitle').textContent = title; $('#toastMsg').textContent = msg || '';
  t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200);
}
let sheetOpen = null;
function openSheet(html) { $('#sheet').innerHTML = `<div class="grab"></div>${html}`; $('#overlay').classList.add('open'); }
function closeSheet() { $('#overlay').classList.remove('open'); sheetOpen = null; }
$('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeSheet(); });

/* ───────────── shared fragments ───────────── */
const livePill = () => `<span class="live-pill" data-livepill><span class="dot"></span><span data-clock>${hms(new Date())}</span></span>`;
const themeBtn = () => `<button class="icon-btn" data-act="theme" aria-label="Toggle theme" data-themeicon>${ic(resolveTheme() === 'dark' ? 'sun' : 'moon')}</button>`;
const head = (title, sub) => `<div class="top"><div><h1>${title}</h1><div class="sub">${sub}</div></div><div class="top-actions">${livePill()}${themeBtn()}</div></div>`;
const colorsBg = a => { const [c1, c2] = a.colors.split(','); return `linear-gradient(135deg,${c1},${c2})`; };
const chgCls = a => chgPct(a) >= 0 ? 'up' : 'down';

function stockRow(a, sel) {
  return `<div class="row ${sel ? 'sel' : ''}" data-act="open" data-sym="${a.sym}">
    <div class="sym-logo" style="background:${colorsBg(a)};${logoTxt(a).length > 1 ? 'font-size:11px' : ''}">${logoTxt(a)}</div>
    <div class="meta"><b>${a.sym}</b><span>${a.name}</span></div>
    <div class="spark" data-spark="${a.sym}"></div>
    <div class="px"><b class="num" data-px="${a.sym}">${fPx(a)}</b><span class="pill ${chgCls(a)} num" data-chg="${a.sym}">${fChg(a)}</span></div></div>`;
}
const idxCard = a => `<div class="idx" data-act="open" data-sym="${a.sym}"><div class="n">${a.cat === 'indices' ? a.name : a.sym}</div><div class="p num" data-px="${a.sym}">${fPx(a)}</div><span class="pill ${chgCls(a)} num" data-chg="${a.sym}">${fChg(a)}</span><div class="spark" data-spark="${a.sym}"></div></div>`;
const txIcon = { deposit: 'down', withdraw: 'up', buy: 'stocks', sell: 'swap', commission: 'gift' };
function txRow(t) {
  const d = new Date(t.ts), pend = t.status === 'pending';
  return `<div class="tx"><div class="tx-ic ${t.type}">${ic(txIcon[t.type] || 'coin')}</div>
    <div class="mid"><b>${esc(t.title)}</b><span>${esc(t.sub)} · ${hm(d)}</span></div>
    <div class="amt num"><span class="${t.amt >= 0 ? 'up' : ''}">${sUGX(t.amt)}</span><span class="status ${pend ? 'pending' : 'done'}">${pend ? '● Pending' : 'Completed'}</span></div></div>`;
}
const dayLabel = ts => { const d = new Date(ts), n = new Date(); if (d.toDateString() === n.toDateString()) return 'Today'; if (d.toDateString() === new Date(n - DAY).toDateString()) return 'Yesterday'; return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
function txGroups(list) {
  if (!list.length) return '<div class="empty">No transactions here yet.</div>';
  let last = '', out = '';
  list.forEach(t => { const l = dayLabel(t.ts); if (l !== last) { out += `<div class="tx-group">${l}</div>`; last = l; } out += txRow(t); });
  return out;
}
const sortedTx = () => [...S.tx].sort((a, b) => b.ts - a.ts);

/* ───────────── pages ───────────── */
const feed = { state: LIVE_DATA ? 'connecting' : 'sim', at: 0, msg: '' };
let page = 'home', cat = 'stocks', selSym = 'AAPL', tf = 'LIVE', stockTab = 'market', moverTab = 'gain', finFilter = 'all', q = '';

/* category bar on the Stocks page */
const CATS = [['stocks', 'Stocks'], ['most', 'Most traded'], ['movers', 'Top movers'], ['majors', 'Majors'], ['metals', 'Metals'], ['crypto', 'Crypto'], ['indices', 'Indices'], ['exotic', 'Exotic'], ['minors', 'Minors'], ['all', 'All']];
const MOST = ['EUR/USD', 'XAU/USD', 'BTC/USD', 'GBP/USD', 'USD/JPY', 'NVDA', 'TSLA', 'AAPL', 'SPX', 'ETH/USD'];   // a fixed list of widely traded markets
function catList(k) {
  const all = Object.values(A);
  if (k === 'stocks') return STOCKS;
  if (k === 'most') return MOST.map(s => A[s]).filter(Boolean);
  if (k === 'movers') return all.filter(a => !live0(a)).sort((x, y) => Math.abs(chgPct(y)) - Math.abs(chgPct(x))).slice(0, 10);
  if (k === 'all') return all;
  return all.filter(a => a.cat === k);
}
const catVisible = () => CATS;
const catBar = () => catVisible().map(([k, l]) => `<button class="${k === 'stocks' ? 'cat cat-main' : 'cat'} ${k === cat ? 'on' : ''}" data-act="cat" data-v="${k}">${l}</button>`).join('');
const catNote = () => catList(cat).some(a => !a.trade) ? (LIVE_DATA ? 'Watch-only: trading is available for stocks.' : 'Demo prices. Trading is available for stocks only.') : '';
function renderCat() {
  $('#catBar').innerHTML = catBar(); $('#catCards').innerHTML = catList(cat).slice(0, 8).map(idxCard).join(''); $('#catNote').textContent = catNote();
  if (stockTab === 'market') renderStockList(); patchLive(true);
}
function renderHome() {
  const hr = new Date().getHours(), g = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const movers = [...STOCKS].sort((a, b) => moverTab === 'gain' ? chgPct(b) - chgPct(a) : chgPct(a) - chgPct(b)).slice(0, 4);
  $('#page-home').innerHTML = `
  <div class="top"><div class="brand"><div class="logo">${ic('stocks')}</div><div><h1 style="font-size:19px">${g}, ${esc(S.profile.name.split(' ')[0])}</h1><div class="sub">${BRAND} · live markets</div></div></div>
    <div class="top-actions">${themeBtn()}</div></div>
  <div class="hero card">
    <div class="label">Total balance</div>
    <div class="amount num" data-bind="total">${fUGX(portfolio().total)}</div>
    <span class="delta num" data-bind="heroPl" data-signed>—</span>
    <div class="hero-actions">
      <button class="hero-btn" data-act="deposit">${ic('down')}Deposit</button>
      <button class="hero-btn" data-act="withdraw">${ic('up')}Withdraw</button>
      <button class="hero-btn" data-act="gostocks">${ic('swap')}Trade</button>
    </div>
  </div>
  <div class="grid2 block" style="margin-top:14px">
    <div class="stat"><div class="k">Available cash</div><div class="v num" data-bind="funds"></div></div>
    <div class="stat"><div class="k">Invested</div><div class="v num" data-bind="mv"></div></div>
  </div>
  <div class="block"><div class="sec-head"><h2>Markets</h2>${livePill()}</div><div class="hscroll">${INDICES.map(idxCard).join('')}</div></div>
  <div class="block"><div class="sec-head"><h2>Top movers</h2><button class="link-btn" data-act="gostocks">See all</button></div>
    <div class="seg"><button class="${moverTab === 'gain' ? 'on' : ''}" data-act="movers" data-v="gain">Gainers</button><button class="${moverTab === 'lose' ? 'on' : ''}" data-act="movers" data-v="lose">Losers</button></div>
    <div class="rows">${movers.map(a => stockRow(a)).join('')}</div></div>
  <div class="block"><div class="sec-head"><h2>Recent transactions</h2><button class="link-btn" data-act="gofinance">View all</button></div>
    ${sortedTx().slice(0, 4).map(txRow).join('') || '<div class="empty">No transactions yet. Make a deposit to get started.</div>'}</div>
  <div class="card block" style="display:flex;gap:14px;align-items:center">
    <div class="logo" style="flex:none">${ic('gift')}</div>
    <div style="flex:1"><b style="font-size:14px">Invite friends, earn up to 10%</b><div class="small muted" style="margin-top:2px">3 levels of commissions on every referral.</div></div>
    <button class="btn sm" data-act="goreferral">Invite</button></div>`;
}

function renderStocks() {
  const a = A[selSym], p = portfolio();
  $('#page-stocks').innerHTML = `
  ${head('Markets', 'Real-time quotes & trading')}
  <div class="grid2">
    <div class="stat"><div class="k">Available funds</div><div class="v num" data-bind="funds"></div></div>
    <div class="stat"><div class="k">Total assets</div><div class="v num" data-bind="assets"></div></div>
    <div class="stat"><div class="k">Market value</div><div class="v num" data-bind="mv"></div></div>
    <div class="stat"><div class="k">Daily P/L</div><div class="v num" data-bind="pl" data-signed></div></div>
  </div>
  <div class="block"><div class="cat-bar" id="catBar">${catBar()}</div><div class="hscroll" id="catCards">${catList(cat).slice(0, 8).map(idxCard).join('')}</div><div class="small muted" id="catNote" style="margin-top:6px">${catNote()}</div></div>
  <div class="card block" id="chartCard">
    <div style="display:flex;align-items:center;gap:12px">
      <div class="sym-logo" style="background:${colorsBg(a)};width:46px;height:46px;${logoTxt(a).length > 1 ? 'font-size:12px' : ''}">${logoTxt(a)}</div>
      <div style="flex:1;min-width:0"><b style="font-size:16px">${a.sym}</b> <span class="muted small">${a.name}</span>
        <div><span class="num" data-px="${a.sym}" style="font-size:22px;font-weight:800">${fPx(a)}</span> <span class="pill ${chgCls(a)} num" data-chg="${a.sym}">${fChg(a)}</span></div></div>
    </div>
    <div class="tf" id="tfBar">${tfKeys().map(k => `<button class="${k === tf ? 'on' : ''}" data-act="tf" data-v="${k}">${TF[k]}</button>`).join('')}</div>
    <div class="chart-wrap" id="chartWrap"><div class="chart-svg" id="chartSvg"></div><div class="chart-line" id="chartLine"></div><div class="chart-tip" id="chartTip"></div></div>
    <div class="axis-x" id="axisX"></div>
    ${a.trade ? `<div class="btn-row" style="margin-top:14px"><button class="btn green" data-act="trade" data-side="buy" data-sym="${a.sym}">Buy</button><button class="btn red" data-act="trade" data-side="sell" data-sym="${a.sym}">Sell</button></div>` : '<div class="small muted" style="margin-top:12px;text-align:center">Watch-only market. Trading is available for stocks.</div>'}
  </div>
  <div class="block">
    <div class="seg"><button class="${stockTab === 'market' ? 'on' : ''}" data-act="stab" data-v="market">Market quotes</button><button class="${stockTab === 'holdings' ? 'on' : ''}" data-act="stab" data-v="holdings">My holdings</button></div>
    <div id="stockList"></div>
  </div>`;
  renderStockList(); bindChart(); drawChart(); patchLive(true);
}
function renderStockList() {
  const el = $('#stockList'); if (!el) return;
  if (stockTab === 'market') {
    const f = q.trim().toUpperCase(), list = catList(cat).filter(s => s.sym.includes(f) || s.name.toUpperCase().includes(f));
    el.innerHTML = `<label class="search">${ic('search')}<input id="search" placeholder="Search ticker or company" value="${esc(q)}" autocomplete="off"></label><div class="rows" id="quoteRows">${list.map(s => stockRow(s, s.sym === selSym)).join('') || '<div class="empty">No matches</div>'}</div>`;
  } else {
    const hs = Object.keys(S.holdings);
    el.innerHTML = `<div class="rows">${hs.length ? hs.map(sym => {
      const h = S.holdings[sym], a = A[sym], val = h.qty * a.price * RATE, pl = h.qty * (a.price - h.avg) * RATE, pc = (a.price - h.avg) / h.avg * 100;
      return `<div class="row" data-act="trade" data-side="sell" data-sym="${sym}"><div class="sym-logo" style="background:${colorsBg(a)}">${sym[0]}</div>
        <div class="meta"><b>${sym}</b><span>${h.qty} sh · avg ${fUSD(h.avg)}</span></div>
        <div class="px" style="min-width:110px"><b class="num">${fUGX(val)}</b><span class="small num ${pl >= 0 ? 'up' : 'down'}" style="font-weight:700">${sUGX(pl)} (${sPct(pc)})</span></div></div>`;
    }).join('') : '<div class="empty">No holdings yet. Pick a stock and tap Buy.</div>'}</div>
    ${S.orders.length ? `<div class="sec-title" style="margin:18px 0 8px">Open limit orders</div><div class="rows">${S.orders.map(o => `<div class="row" style="cursor:default"><div class="sym-logo" style="background:${colorsBg(A[o.sym])}">${o.sym[0]}</div><div class="meta"><b>${o.side === 'buy' ? 'Buy' : 'Sell'} ${o.qty} ${o.sym}</b><span>Limit ${fUSD(o.limit)}</span></div><button class="mini-btn" data-act="cancelorder" data-id="${o.id}">Cancel</button></div>`).join('')}</div>` : ''}`;
  }
  patchLive(true);
}

/* chart interaction */
let chartBound = false;
function bindChart() {
  const wrap = $('#chartWrap'); if (!wrap) return;
  const move = e => {
    const r = wrap.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * CH.w, n = CH.series.length; if (!n) return;
    const i = Math.max(0, Math.min(n - 1, Math.round((x - CH.padL) / (CH.w - CH.padL - CH.padR) * (n - 1)))), px = (CH.padL + (CH.w - CH.padL - CH.padR) * i / (n - 1)) / CH.w * r.width;
    CH.scrub = true; const line = $('#chartLine'), tip = $('#chartTip'), pt = CH.series[i], a = A[selSym];
    line.style.display = tip.style.display = 'block'; line.style.left = px + 'px';
    tip.textContent = `${fmtPx(a, pt.v)} · ${pt.l}`; tip.style.left = Math.max(70, Math.min(r.width - 70, px)) + 'px';
  };
  const end = () => { CH.scrub = false; const l = $('#chartLine'), t = $('#chartTip'); if (l) l.style.display = t.style.display = 'none'; };
  wrap.addEventListener('pointerdown', move); wrap.addEventListener('pointermove', move);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => wrap.addEventListener(ev, end));
}
function drawChart() {
  const box = $('#chartSvg'); if (!box || CH.scrub) return;
  const a = A[selSym]; if (live0(a)) { box.innerHTML = '<div class="empty">Loading live prices…</div>'; $('#axisX').innerHTML = ''; return; } CH.w = Math.max(240, box.clientWidth || 340); CH.series = a.series[tf];
  const s = CH.series; box.innerHTML = chartSVG(s, s[s.length - 1].v >= s[0].v, a.idx ? 0 : a.dec);
  const ax = $('#axisX'); if (ax) ax.innerHTML = [0, .25, .5, .75, 1].map(k => `<span>${s[Math.round(k * (s.length - 1))].l}</span>`).join('');
}

function renderReferral() {
  const code = (S.profile.name.split(' ')[0] || 'USER').toUpperCase() + '123', link = REF_BASE + code;
  $('#page-referral').innerHTML = `
  <div class="top"><div></div><div class="top-actions">${themeBtn()}</div></div>
  <div class="ref-hero"><div class="ic">${ic('coin')}</div><h1>Referral Program</h1><p>Earn commissions on 3 levels of referrals. Share your link and start earning passive income today!</p></div>
  <div class="stats3">
    <div class="stat"><div class="v num">${REFS.all}</div><div class="k" style="margin:2px 0 0">All referrals</div></div>
    <div class="stat"><div class="v num">${pad2(REFS.today)}</div><div class="k" style="margin:2px 0 0">Today</div></div>
    <div class="stat"><div class="v num">${fUGX(S.refEarned)}</div><div class="k" style="margin:2px 0 0">Total earnings</div></div>
  </div>
  <div class="card"><div class="sec-head" style="margin:0"><h2>Your referral link</h2><span class="badge-active">Active</span></div>
    <div class="link-box"><input class="input" id="refLink" value="${link}" readonly><button class="btn sm" data-act="copy">${ic('copy')}Copy</button></div></div>
  <div class="card"><div style="display:flex;align-items:center;gap:12px"><div style="flex:1"><div class="k small muted">Unclaimed commissions</div><div style="font-size:20px;font-weight:800" class="num" data-bind="refBal">${fUGX(S.refBal)}</div></div>
    <button class="btn sm green" data-act="claim">Move to wallet</button></div></div>
  <div class="block"><div class="sec-head"><h2>Share via</h2></div><div class="social">
    <button data-act="share" data-v="whatsapp" style="--c:#25d366">${ic('chat')}WhatsApp</button>
    <button data-act="share" data-v="telegram" style="--c:#229ed9">${ic('send')}Telegram</button>
    <button data-act="share" data-v="facebook" style="--c:#1877f2">${ic('fb')}Facebook</button>
    <button data-act="share" data-v="x" style="--c:var(--text)">${ic('x')}X</button>
    <button data-act="share" data-v="email" style="--c:#ea4335">${ic('mail')}Email</button></div></div>
  <div class="block"><div class="sec-head"><h2>How it works</h2></div><div class="card steps">
    <div class="step"><div class="no">1</div><div><b>Share your link</b><p>Copy your unique link and send it via social media, email or messaging apps.</p></div></div>
    <div class="step"><div class="no">2</div><div><b>Friends sign up</b><p>Anyone who registers with your link becomes your direct referral.</p></div></div>
    <div class="step"><div class="no">3</div><div><b>Earn commissions</b><p>Get paid on 3 levels. The more active your network, the more you earn.</p></div></div></div></div>
  <div class="block"><div class="sec-head"><h2>Reward levels</h2></div><div class="levels">
    <div class="level l1"><div class="pc">10%</div><b style="font-size:12px">Level A</b><small>Direct</small></div>
    <div class="level l2"><div class="pc">5%</div><b style="font-size:12px">Level B</b><small>Team</small></div>
    <div class="level l3"><div class="pc">2%</div><b style="font-size:12px">Level C</b><small>Network</small></div></div></div>
  <div class="block"><div class="sec-head"><h2>Recent commissions</h2></div>
    ${REFS.recent.length ? REFS.recent.map(r => `<div class="tx"><div class="avatar" style="background:${r.c}">${initials(r.name.replace(/[._\d]/g, ' '))}</div><div class="mid"><b>${esc(r.name)}</b><span>Level ${r.lv} (${r.pct}%) · ${r.d}</span></div><div class="amt up num">+${fUGX(r.amt)}</div></div>`).join('') : '<div class="empty">No commissions yet. Share your link to start earning.</div>'}</div>`;
}

function renderProfile() {
  const p = S.profile, pf = portfolio(), dark = resolveTheme() === 'dark';
  $('#page-profile').innerHTML = `
  <div class="top"><div></div><div class="top-actions">${themeBtn()}</div></div>
  <div class="profile-head"><div class="avatar-lg">${esc(initials(p.name))}</div><h1>${esc(p.name)}</h1><p>${esc(p.phone)}</p><p>${esc(p.email)}</p></div>
  <div class="grid2 block"><div class="stat"><div class="k">Portfolio value</div><div class="v num" data-bind="total"></div></div><div class="stat"><div class="k">Referrals</div><div class="v num">${REFS.all}</div></div></div>
  <div class="block"><div class="sec-title" style="margin-bottom:10px">Appearance</div>
    <div class="seg" style="margin:0"><button class="${S.theme === 'system' ? 'on' : ''}" data-act="settheme" data-v="system">System</button><button class="${S.theme === 'light' ? 'on' : ''}" data-act="settheme" data-v="light">Light</button><button class="${S.theme === 'dark' ? 'on' : ''}" data-act="settheme" data-v="dark">Dark</button></div></div>
  <div class="block menu">
    <button class="menu-item" data-act="theme"><span class="mi">${ic(dark ? 'moon' : 'sun')}</span><span class="t">Dark mode</span><span class="switch ${dark ? 'on' : ''}"></span></button>
    <button class="menu-item" data-act="editprofile"><span class="mi">${ic('user')}</span><span class="t">Profile details<small>Name, email, phone</small></span>${ic('chev', 'class="chev"')}</button>
    <button class="menu-item" data-act="password"><span class="mi">${ic('lock')}</span><span class="t">Change password</span>${ic('chev', 'class="chev"')}</button>
    <button class="menu-item" data-act="settings"><span class="mi">${ic('cog')}</span><span class="t">Settings<small>Live updates, data</small></span>${ic('chev', 'class="chev"')}</button>
    <button class="menu-item danger" data-act="logout"><span class="mi">${ic('out')}</span><span class="t">Log out</span></button>
  </div>
  <p class="small muted" style="text-align:center;margin-top:18px">${BRAND} · Member since ${esc(p.since)}</p>`;
}

function renderFinance() {
  const filters = [['all', 'All'], ['deposit', 'Deposits'], ['withdraw', 'Withdrawals'], ['trade', 'Trades'], ['commission', 'Commissions']];
  const list = sortedTx().filter(t => finFilter === 'all' || (finFilter === 'trade' ? (t.type === 'buy' || t.type === 'sell') : t.type === finFilter));
  const pf = portfolio();
  $('#page-finance').innerHTML = `
  ${head('Finance', 'Wallet, balances & transactions')}
  <div class="hero card"><div class="label">Total balance</div><div class="amount num" data-bind="total">${fUGX(pf.total)}</div>
    <span class="delta num" data-bind="heroPl" data-signed>—</span>
    <div class="btn-row" style="margin-top:18px"><button class="hero-btn" style="flex:1;flex-direction:row;justify-content:center;font-size:14px" data-act="deposit">${ic('down')}Deposit</button><button class="hero-btn" style="flex:1;flex-direction:row;justify-content:center;font-size:14px" data-act="withdraw">${ic('up')}Withdraw</button></div></div>
  <div class="block"><div class="sec-head"><h2>Balances</h2></div>
    <div class="card" style="padding:6px 16px 14px">
      <div class="bal"><div class="tx-ic deposit">${ic('wallet')}</div><div class="mid"><b>Wallet</b><span>Available to trade or withdraw</span></div><div class="v num" data-bind="funds"></div></div>
      <div class="bal"><div class="tx-ic buy">${ic('pie')}</div><div class="mid"><b>Invested</b><span>Stocks at market value</span></div><div class="v num"><div data-bind="mv"></div><div class="small num" data-bind="unreal" data-signed style="font-weight:700"></div></div></div>
      <div class="bal"><div class="tx-ic commission">${ic('gift')}</div><div class="mid"><b>Referral earnings</b><span><button class="link-btn" style="font-size:12px" data-act="claim">Move to wallet</button></span></div><div class="v num" data-bind="refBal"></div></div>
      <div class="bal"><div class="tx-ic" style="background:var(--info-bg);color:var(--info)">${ic('clock')}</div><div class="mid"><b>Pending</b><span>Deposits / withdrawals in progress</span></div><div class="v num" data-bind="pending"></div></div>
      <div class="alloc"><i data-alloc="funds" style="background:var(--up)"></i><i data-alloc="mv" style="background:var(--accent)"></i><i data-alloc="ref" style="background:var(--purple)"></i></div>
      <div class="small muted" style="display:flex;gap:14px;flex-wrap:wrap"><span><b class="up">●</b> Cash</span><span><b style="color:var(--accent)">●</b> Stocks</span><span><b style="color:var(--purple)">●</b> Referral</span></div>
    </div></div>
  <div class="block"><div class="sec-head"><h2>Transactions</h2></div>
    <div class="chips" style="margin:0 0 4px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none">${filters.map(([k, l]) => `<button class="chip ${finFilter === k ? 'on' : ''}" style="flex:none" data-act="finfilter" data-v="${k}">${l}</button>`).join('')}</div>
    <div id="txList">${txGroups(list)}</div></div>`;
  patchLive(true);
}

/* ───────────── live patching ───────────── */
function setText(el, txt, dir) {
  if (el.textContent === txt) return; el.textContent = txt;
  if (dir) { el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth; el.classList.add(dir > 0 ? 'flash-up' : 'flash-down'); }
}
function patchLive(force) {
  $$('[data-px]').forEach(el => { const a = A[el.dataset.px]; if (a) setText(el, fPx(a), force ? 0 : a.dir); });
  $$('[data-chg]').forEach(el => { const a = A[el.dataset.chg]; if (!a) return; const pc = chgPct(a); setText(el, fChg(a)); el.classList.toggle('up', pc >= 0); el.classList.toggle('down', pc < 0); });
  $$('[data-spark]').forEach(el => { const a = A[el.dataset.spark]; if (a) el.innerHTML = live0(a) ? '' : sparkSVG(a.series.LIVE, chgPct(a) >= 0); });
  const b = bindings();
  $$('[data-bind]').forEach(el => { const v = b[el.dataset.bind]; if (!v) return; setText(el, v.t); if (el.hasAttribute('data-signed')) { el.classList.toggle('up', v.s >= 0); el.classList.toggle('down', v.s < 0); } });
  const pf = portfolio(), tot = pf.total || 1;
  $$('[data-alloc]').forEach(el => { el.style.width = ((el.dataset.alloc === 'funds' ? S.funds : el.dataset.alloc === 'mv' ? pf.mv : S.refBal) / tot * 100).toFixed(1) + '%'; });
  $$('[data-livepill]').forEach(el => { el.classList.toggle('off', !S.live || feed.state === 'error'); const c = $('[data-clock]', el); if (c) c.textContent = pillText(); });
}

/* ───────────── trading ───────────── */
let T = null; // trade sheet context
function openTrade(sym, side) {
  T = { sym, side: side || 'buy', type: 'market' }; sheetOpen = 'trade'; drawTrade();
}
function drawTrade() {
  const a = A[T.sym], buy = T.side === 'buy', h = S.holdings[T.sym];
  openSheet(`<div class="sheet-head"><div class="sym-logo" style="background:${colorsBg(a)}">${a.sym[0]}</div><div style="flex:1"><h3>${a.sym}</h3><div class="small muted">${a.name}</div></div><div style="text-align:right"><b class="num" data-px="${a.sym}">${fPx(a)}</b><div><span class="pill ${chgCls(a)} num" data-chg="${a.sym}">${fChg(a)}</span></div></div></div>
  <div class="seg ${buy ? '' : 'sell'}"><button class="${buy ? 'on' : ''}" data-act="tside" data-v="buy">Buy</button><button class="${!buy ? 'on' : ''}" data-act="tside" data-v="sell">Sell</button></div>
  <div class="field"><label>Order type</label><div class="chips" style="margin:0"><button class="chip ${T.type === 'market' ? 'on' : ''}" data-act="ttype" data-v="market">Market</button><button class="chip ${T.type === 'limit' ? 'on' : ''}" data-act="ttype" data-v="limit">Limit</button></div></div>
  ${T.type === 'limit' ? `<div class="field"><label>Limit price (USD)</label><input class="input" id="tLimit" type="number" inputmode="decimal" step="0.01" value="${a.price.toFixed(2)}"></div>` : ''}
  <div class="field"><label>Quantity ${!buy ? `<span class="muted">(you own ${h ? h.qty : 0})</span>` : ''}</label><input class="input" id="tQty" type="number" inputmode="numeric" min="1" step="1" placeholder="0">
    <div class="chips">${[1, 5, 10, 25].map(n => `<button class="chip" data-act="tqty" data-v="${n}">${n}</button>`).join('')}${!buy && h ? `<button class="chip" data-act="tqty" data-v="${h.qty}">All</button>` : ''}</div></div>
  <div class="summary" id="tSummary"></div><div class="err" id="tErr"></div>
  <button class="btn ${buy ? 'green' : 'red'}" data-act="tconfirm">${buy ? 'Buy' : 'Sell'} ${a.sym}</button>`);
  refreshTrade();
}
function refreshTrade() {
  const box = $('#tSummary'); if (!box || !T) return;
  const a = A[T.sym], qty = parseInt($('#tQty')?.value) || 0, lim = parseFloat($('#tLimit')?.value), px = T.type === 'limit' && lim > 0 ? lim : a.price, h = S.holdings[T.sym];
  box.innerHTML = `<div><span>${T.type === 'limit' ? 'Limit price' : 'Market price'}</span><span class="num">${fUSD(px)}</span></div><div><span>Exchange rate ${RATE_LIVE ? '' : '(fallback)'}</span><span class="num">1 USD = ${fUGX(RATE)}</span></div><div><span>${T.side === 'buy' ? 'Available cash' : 'Shares owned'}</span><span class="num">${T.side === 'buy' ? fUGX(S.funds) : (h ? h.qty : 0)}</span></div><div><span>Estimated ${T.side === 'buy' ? 'cost' : 'proceeds'}</span><span class="num">${fUGX(qty * px * RATE)}</span></div>`;
}
function execute(side, sym, qty, px) {
  const cost = qty * px * RATE, h = S.holdings[sym];
  if (side === 'buy') {
    if (cost > S.funds) return 'Insufficient funds';
    S.funds -= cost; if (h) { h.avg = (h.qty * h.avg + qty * px) / (h.qty + qty); h.qty += qty; } else S.holdings[sym] = { qty, avg: px };
  } else {
    if (!h || h.qty < qty) return 'Insufficient shares';
    S.funds += cost; h.qty -= qty; if (!h.qty) delete S.holdings[sym];
  }
  S.tx.push({ id: uid(), type: side, title: `${side === 'buy' ? 'Bought' : 'Sold'} ${qty} ${sym}`, sub: `@ ${fUSD(px)} (rate ${Math.round(RATE).toLocaleString('en-US')})`, rate: RATE, amt: side === 'buy' ? -cost : cost, ts: Date.now(), status: 'done' });
  save(); return null;
}
function confirmTrade() {
  const a = A[T.sym], qty = parseInt($('#tQty').value), err = m => { $('#tErr').textContent = m; };
  if (LIVE_DATA && !a.real) return err('Waiting for a live price. Try again in a moment.');
  if (!qty || qty < 1) return err('Enter a valid quantity.');
  let lim = null;
  if (T.type === 'limit') { lim = parseFloat($('#tLimit').value); if (!lim || lim <= 0) return err('Enter a valid limit price.'); }
  const marketable = T.type === 'market' || (T.side === 'buy' ? a.price <= lim : a.price >= lim);
  if (marketable) {
    const e = execute(T.side, T.sym, qty, a.price); if (e) return err(e);
    toast(T.side === 'buy' ? 'Order filled' : 'Sold', `${T.side === 'buy' ? 'Bought' : 'Sold'} ${qty} ${T.sym} @ ${fUSD(a.price)}`);
  } else {
    if (T.side === 'buy' && qty * lim * RATE > S.funds) return err('Insufficient funds for this limit order.');
    if (T.side === 'sell' && (!S.holdings[T.sym] || S.holdings[T.sym].qty < qty)) return err('Insufficient shares.');
    S.orders.push({ id: uid(), side: T.side, sym: T.sym, qty, limit: lim }); save();
    toast('Limit order placed', `${T.side === 'buy' ? 'Buy' : 'Sell'} ${qty} ${T.sym} when price ${T.side === 'buy' ? '≤' : '≥'} ${fUSD(lim)}`);
  }
  closeSheet(); T = null; refreshPage();
}
function checkOrders() {
  let changed = false;
  S.orders = S.orders.filter(o => {
    const a = A[o.sym]; if (LIVE_DATA && !a.real) return true;
    const hit = o.side === 'buy' ? a.price <= o.limit : a.price >= o.limit; if (!hit) return true;
    const e = execute(o.side, o.sym, o.qty, a.price); changed = true;
    e ? toast('Order cancelled', `${o.sym}: ${e}`, true) : toast('Limit order filled', `${o.side === 'buy' ? 'Bought' : 'Sold'} ${o.qty} ${o.sym} @ ${fUSD(a.price)}`);
    return false;
  });
  if (changed) { save(); refreshPage(); }
}

/* ───────────── deposit / withdraw ───────────── */
const METHODS = [
  { id: 'mtn', n: 'MTN Mobile Money', d: 'Instant', f: 'phone' },
  { id: 'airtel', n: 'Airtel Money', d: 'Instant', f: 'phone' },
  { id: 'bank', n: 'Bank transfer', d: '1–2 business days', f: 'acct' },
  { id: 'card', n: 'Visa / Mastercard', d: 'Instant', f: 'none' },
];
let M = null;
const fee = (kind, amt) => kind === 'withdraw' ? Math.max(500, Math.round(amt * .01)) : 0;
function openMoney(kind) { M = { kind, method: 'mtn', amt: 0 }; sheetOpen = 'money'; drawMoney(); }
function drawMoney() {
  const dep = M.kind === 'deposit', m = METHODS.find(x => x.id === M.method), chips = dep ? [50000, 100000, 500000, 1000000] : [50000, 100000, 500000];
  openSheet(`<h3>${dep ? 'Deposit funds' : 'Withdraw funds'}</h3>
  <div class="field"><label>Amount (UGX)</label><input class="input amount-big num" id="mAmt" type="number" inputmode="numeric" placeholder="0" value="${M.amt || ''}">
    <div class="chips">${chips.map(c => `<button class="chip" data-act="mchip" data-v="${c}">${c >= 1e6 ? c / 1e6 + 'M' : c / 1e3 + 'K'}</button>`).join('')}${dep ? '' : '<button class="chip" data-act="mmax">Max</button>'}</div></div>
  <div class="field"><label>${dep ? 'Pay with' : 'Receive via'}</label><div class="methods">${METHODS.map(x => `<button class="method ${x.id === M.method ? 'on' : ''}" data-act="mmethod" data-v="${x.id}"><b>${x.n}</b><span>${x.d}</span></button>`).join('')}</div></div>
  ${m.f === 'phone' ? `<div class="field"><label>Mobile number</label><input class="input" id="mAcc" type="tel" value="${esc(S.profile.phone)}"></div>` : m.f === 'acct' ? `<div class="field"><label>Bank account number</label><input class="input" id="mAcc" inputmode="numeric" placeholder="Account number"></div>` : '<p class="small muted" style="margin-bottom:14px">Card details are entered on the secure checkout after you confirm.</p>'}
  <div class="summary" id="mSummary"></div><div class="err" id="mErr"></div>
  <button class="btn ${dep ? 'green' : 'red'}" data-act="mconfirm">${dep ? 'Confirm deposit' : 'Confirm withdrawal'}</button>`);
  refreshMoney();
}
function refreshMoney() {
  const box = $('#mSummary'); if (!box) return; const amt = parseFloat($('#mAmt').value) || 0, f = fee(M.kind, amt); M.amt = amt;
  box.innerHTML = `<div><span>Wallet balance</span><span class="num">${fUGX(S.funds)}</span></div><div><span>Fee</span><span class="num">${fUGX(f)}</span></div><div><span>${M.kind === 'deposit' ? 'You will receive' : 'Total debited'}</span><span class="num">${fUGX(M.kind === 'deposit' ? amt : amt + f)}</span></div>`;
}
function confirmMoney() {
  const amt = Math.round(parseFloat($('#mAmt').value) || 0), dep = M.kind === 'deposit', f = fee(M.kind, amt), m = METHODS.find(x => x.id === M.method), acc = ($('#mAcc')?.value || '').replace(/\s/g, ''), err = s => { $('#mErr').textContent = s; };
  if (amt < (dep ? MIN_DEPOSIT : MIN_WITHDRAW)) return err(`Minimum ${dep ? 'deposit' : 'withdrawal'} is ${fUGX(dep ? MIN_DEPOSIT : MIN_WITHDRAW)}.`);
  if (m.f !== 'none' && acc.length < 6) return err(m.f === 'phone' ? 'Enter a valid mobile number.' : 'Enter a valid account number.');
  if (!dep && amt + f > S.funds) return err('Insufficient wallet balance.');
  const tx = { id: uid(), type: M.kind, title: dep ? 'Deposit' : 'Withdrawal', sub: `${m.n}${acc ? ' · ••• ' + acc.slice(-3) : ''}`, amt: dep ? amt : -(amt + f), ts: Date.now(), status: 'pending' };
  if (!dep) S.funds -= amt + f; S.tx.push(tx); save(); settle(tx.id, 3500);
  toast(dep ? 'Deposit initiated' : 'Withdrawal requested', `${fUGX(amt)} via ${m.n} — processing…`);
  closeSheet(); M = null; refreshPage();
}
function settle(id, delay) {
  setTimeout(() => {
    const t = S.tx.find(x => x.id === id); if (!t || t.status !== 'pending') return;
    t.status = 'done'; if (t.type === 'deposit') S.funds += t.amt; save();
    toast(t.type === 'deposit' ? 'Deposit completed' : 'Withdrawal completed', `${fUGX(Math.abs(t.amt))} ${t.type === 'deposit' ? 'added to your wallet' : 'sent'}`);
    refreshPage();
  }, delay);
}

/* ───────────── profile sheets ───────────── */
function editProfile() {
  const p = S.profile;
  openSheet(`<h3>Profile details</h3><div class="field"><label>Full name</label><input class="input" id="pName" value="${esc(p.name)}"></div><div class="field"><label>Email</label><input class="input" id="pMail" type="email" value="${esc(p.email)}"></div><div class="field"><label>Phone</label><input class="input" id="pPhone" type="tel" value="${esc(p.phone)}"></div><div class="err" id="pErr"></div>
  <button class="btn" data-act="saveprofile">Save changes</button>`);
}
function changePassword() {
  openSheet(`<h3>Change password</h3><div class="field"><label>Current password</label><input class="input" id="pw0" type="password" autocomplete="current-password"></div><div class="field"><label>New password</label><input class="input" id="pw1" type="password" autocomplete="new-password"></div><div class="field"><label>Confirm new password</label><input class="input" id="pw2" type="password" autocomplete="new-password"></div><div class="err" id="pErr"></div>
  <button class="btn" data-act="savepw">Update password</button>`);
}
function settingsSheet() {
  openSheet(`<h3>Settings</h3><div class="menu" style="margin-bottom:14px">
    <button class="menu-item" data-act="togglelive"><span class="mi">${ic('bolt')}</span><span class="t">Live market updates<small>Prices refresh every 2 seconds</small></span><span class="switch ${S.live ? 'on' : ''}" id="liveSw"></span></button></div>
  <button class="btn ghost" data-act="reset" style="color:var(--down)">Reset demo data</button>
  <p class="small muted" style="margin-top:12px;text-align:center">Prices: ${LIVE_DATA ? (feed.state === 'live' ? 'live market data' : feed.state === 'closed' ? 'market closed (last close)' : feed.state === 'error' ? 'feed unreachable' + (feed.msg ? ' (' + feed.msg + ')' : '') : 'connecting…') : 'demo feed (simulated)'}<br>Exchange rate: ${RATE_LIVE ? 'live, updated ' + hm(new Date(RATE_AT)) : 'fallback, not updated'}<br>Data is stored on this device only.</p>`);
}

/* ───────────── navigation ───────────── */
const PAGES = ['home', 'stocks', 'finance', 'referral', 'profile'], ICONS = ['home', 'stocks', 'wallet', 'users', 'user'];
const RENDER = { home: renderHome, stocks: renderStocks, referral: renderReferral, profile: renderProfile, finance: renderFinance };
function go(p, opts = {}) {
  if (!PAGES.includes(p)) p = 'home';
  const changed = p !== page; page = p;
  $$('.page').forEach(el => el.classList.toggle('active', el.id === 'page-' + p));
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === p));
  $('#indicator').style.transform = `translateX(${PAGES.indexOf(p) * 100}%)`;
  RENDER[p](); patchLive(true); applyTheme();
  if (changed || opts.top) window.scrollTo({ top: 0 });
  if (changed) pollQuotes();
  try { history.replaceState(null, '', '#' + p); } catch (e) {}
}
const refreshPage = () => { const y = window.scrollY; RENDER[page](); patchLive(true); applyTheme(); window.scrollTo({ top: y }); };

/* ───────────── actions (event delegation) ───────────── */
const ACT = {
  theme: () => setTheme(resolveTheme() === 'dark' ? 'light' : 'dark'),
  settheme: d => setTheme(d.v),
  deposit: () => openMoney('deposit'), withdraw: () => openMoney('withdraw'),
  gostocks: () => go('stocks', { top: true }), gofinance: () => go('finance'), goreferral: () => go('referral'),
  movers: d => { moverTab = d.v; renderHome(); patchLive(true); },
  open: d => { selSym = d.sym; pollQuotes(); if (page !== 'stocks') go('stocks', { top: true }); else { renderStocks(); $('#chartCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } },
  tf: d => { tf = d.v; $$('#tfBar button').forEach(b => b.classList.toggle('on', b.dataset.v === tf)); CH.scrub = false; drawChart(); },
  stab: d => { stockTab = d.v; $$('.seg button[data-act="stab"]').forEach(b => b.classList.toggle('on', b.dataset.v === stockTab)); renderStockList(); },
  cat: d => { cat = d.v; renderCat(); $('#catCards').scrollLeft = 0; pollQuotes(); },
  trade: d => { if (!A[d.sym].trade) return toast('Watch-only market', 'Trading is available for stocks only.', true); openTrade(d.sym, d.side); },
  tside: d => { T.side = d.v; drawTrade(); }, ttype: d => { T.type = d.v; drawTrade(); },
  tqty: d => { $('#tQty').value = d.v; refreshTrade(); }, tconfirm: confirmTrade,
  cancelorder: d => { S.orders = S.orders.filter(o => o.id !== d.id); save(); renderStockList(); toast('Order cancelled', 'Your limit order was removed.'); },
  mchip: d => { $('#mAmt').value = d.v; refreshMoney(); },
  mmax: () => { const mx = Math.max(0, Math.floor(S.funds / 1.01)); $('#mAmt').value = mx; refreshMoney(); },
  mmethod: d => { const amt = $('#mAmt').value; M.method = d.v; M.amt = parseFloat(amt) || 0; drawMoney(); },
  mconfirm: confirmMoney,
  finfilter: d => { finFilter = d.v; renderFinance(); },
  claim: () => {
    if (S.refBal <= 0) return toast('Nothing to claim', 'No unclaimed commissions right now.', true);
    const a = S.refBal; S.funds += a; S.refBal = 0;
    S.tx.push({ id: uid(), type: 'commission', title: 'Referral payout', sub: 'Moved to wallet', amt: a, ts: Date.now(), status: 'done' }); save();
    toast('Commissions moved', `${fUGX(a)} added to your wallet`); refreshPage();
  },
  copy: () => {
    const el = $('#refLink'), done = () => toast('Link copied', 'Referral link copied to clipboard');
    const fb = () => { el.select(); try { document.execCommand('copy'); } catch (e) {} done(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.value).then(done, fb); else fb();
  },
  share: d => {
    const link = $('#refLink').value, msg = `Join me on ${BRAND} and start earning: ${link}`, u = encodeURIComponent(link), m = encodeURIComponent(msg);
    const url = { whatsapp: `https://wa.me/?text=${m}`, telegram: `https://t.me/share/url?url=${u}&text=${encodeURIComponent('Join me on ' + BRAND)}`, facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`, x: `https://twitter.com/intent/tweet?text=${m}`, email: `mailto:?subject=${encodeURIComponent('Join ' + BRAND)}&body=${m}` }[d.v];
    window.open(url, '_blank', 'noopener');
  },
  editprofile: editProfile, password: changePassword, settings: settingsSheet,
  saveprofile: () => {
    const n = $('#pName').value.trim(), e = $('#pMail').value.trim(), ph = $('#pPhone').value.trim();
    if (!n) return $('#pErr').textContent = 'Name is required.'; if (!/^\S+@\S+\.\S+$/.test(e)) return $('#pErr').textContent = 'Enter a valid email.';
    S.profile.name = n; S.profile.email = e; S.profile.phone = ph; save(); closeSheet(); refreshPage(); toast('Profile updated', 'Your details were saved.');
  },
  savepw: () => {
    const a = $('#pw0').value, b = $('#pw1').value, c = $('#pw2').value, er = s => $('#pErr').textContent = s;
    if (!a) return er('Enter your current password.'); if (b.length < 8) return er('New password must be at least 8 characters.'); if (b !== c) return er('Passwords do not match.');
    closeSheet(); toast('Password updated', 'Use your new password next time you sign in.');
  },
  togglelive: () => { S.live = !S.live; save(); $('#liveSw')?.classList.toggle('on', S.live); patchLive(true); },
  reset: () => { try { localStorage.removeItem(STORE_KEY); } catch (e) {} const th = S.theme; S = defaults(); S.theme = th; save(); closeSheet(); refreshPage(); toast('Demo data reset', 'Balances and transactions restored.'); },
  logout: () => $('#login').classList.remove('hidden'),
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return; const f = ACT[t.dataset.act]; if (f) f(t.dataset, t, e);
});
document.addEventListener('input', e => {
  if (e.target.id === 'search') { q = e.target.value; const rows = $('#quoteRows'); if (rows) { const f = q.trim().toUpperCase(), list = catList(cat).filter(s => s.sym.includes(f) || s.name.toUpperCase().includes(f)); rows.innerHTML = list.map(s => stockRow(s, s.sym === selSym)).join('') || '<div class="empty">No matches</div>'; patchLive(true); } }
  if (e.target.id === 'tQty' || e.target.id === 'tLimit') refreshTrade();
  if (e.target.id === 'mAmt') refreshMoney();
});
$('#signIn').addEventListener('click', () => { $('#login').classList.add('hidden'); toast('Welcome back', S.profile.name); });

/* nav bar */
$$('.nav-item').forEach((b, i) => {
  $('.ic', b).innerHTML = ic(ICONS[i]);
  b.addEventListener('click', e => {
    const r = document.createElement('span'), rect = b.getBoundingClientRect(), s = Math.max(rect.width, rect.height);
    r.className = 'ripple'; r.style.width = r.style.height = s + 'px'; r.style.left = (e.clientX - rect.left - s / 2) + 'px'; r.style.top = (e.clientY - rect.top - s / 2) + 'px';
    b.appendChild(r); setTimeout(() => r.remove(), 600); go(b.dataset.page);
  });
});

/* ───────────── loop ───────────── */
function afterTick() {
  patchLive(false); checkOrders();
  if (page === 'stocks') { drawChart(); if (stockTab === 'holdings') renderStockList(); }
  if (sheetOpen === 'trade') refreshTrade();
}
/* ── live exchange rate ── */
async function fetchRate() {
  try {
    const r = await fetch(CONFIG.fxUrl, { cache: 'no-store' }), j = await r.json(), v = j && j.rates && j.rates.UGX;
    if (!(v > 0)) throw new Error('no UGX rate');
    RATE = v; RATE_AT = Date.now(); RATE_LIVE = true;
    try { localStorage.setItem('tradeflow.rate', JSON.stringify({ rate: v, at: RATE_AT })); } catch (e) {}
    patchLive(true); if (sheetOpen === 'trade') refreshTrade();
  } catch (e) { /* keep the cached or fallback rate */ }
}

/* ── live quotes: EODHD real-time (some markets are delayed, depending on your plan) ── */
let pollCursor = 0, polling = false, pollAgain = false;
function pollSet() {
  const must = new Set([selSym, ...Object.keys(S.holdings), ...S.orders.map(o => o.sym)]);
  const pool = page === 'stocks' ? (cat === 'movers' || cat === 'all' ? Object.values(A) : catList(cat)) : [...STOCKS, ...INDICES];
  const rest = pool.filter(a => !must.has(a.sym)), room = Math.max(0, CONFIG.maxPerPoll - must.size);
  let pick = rest;
  if (rest.length > room) { pick = []; for (let i = 0; i < room; i++) pick.push(rest[(pollCursor + i) % rest.length]); pollCursor = (pollCursor + room) % rest.length; }
  return [...must].map(s => A[s]).filter(Boolean).concat(pick);
}
async function pollQuotes() {
  if (!LIVE_DATA || !S.live || (document.hidden && feed.at)) return;
  if (polling) { pollAgain = true; return; }
  polling = true;
  const list = pollSet(), eods = list.map(a => a.eod); let revealed = false;
  try {
    const url = CONFIG.proxyUrl
      ? `${CONFIG.proxyUrl.replace(/\/$/, '')}/quotes?symbols=${eods.join(',')}`
      : `${CONFIG.eodhdUrl}${eods[0]}?api_token=${encodeURIComponent(CONFIG.eodhdKey)}&fmt=json${eods.length > 1 ? '&s=' + eods.slice(1).join(',') : ''}`;
    const r = await fetch(url);
    if (!r.ok) { feed.msg = r.status === 401 || r.status === 403 ? 'token rejected' : r.status === 402 || r.status === 429 ? 'plan limit reached' : 'HTTP ' + r.status; throw new Error(feed.msg); }
    const j = await r.json(), rows = Array.isArray(j) ? j : [j], byCode = {};
    list.forEach(a => { byCode[a.eod.toUpperCase()] = a; });
    let got = 0, newest = 0; const t = new Date();
    rows.forEach(x => {
      const code = String(x && x.code || '').toUpperCase(), a = byCode[code] || list.find(s => s.eod.split('.')[0].toUpperCase() === code.split('.')[0]);
      const c = Number(x && x.close), pc = Number(x && x.previousClose); if (!a || !(c > 0)) return;
      got++; newest = Math.max(newest, Number(x.timestamp) || 0);
      const first = !a.real; a.prev = first ? c : a.price; a.price = c; a.open = pc > 0 ? pc : c; a.dir = Math.sign(a.price - a.prev);
      if (first) { a.real = true; revealed = true; a.series.LIVE = [{ v: c, l: hms(t) }, { v: c, l: hms(t) }]; }
      else if (c !== a.prev) { a.series.LIVE.push({ v: c, l: hms(t) }); if (a.series.LIVE.length > 90) a.series.LIVE.shift(); }
    });
    if (!got) { feed.msg = 'no quotes returned'; throw new Error(feed.msg); }
    feed.state = newest && Date.now() - newest * 1000 > 20 * 60 * 1000 ? 'closed' : 'live'; feed.at = Date.now(); feed.msg = '';
  } catch (e) { feed.state = 'error'; if (!feed.msg) feed.msg = 'network error'; }
  polling = false;
  if (revealed && page === 'stocks') { renderCat(); drawChart(); }
  afterTick();
  if (pollAgain) { pollAgain = false; pollQuotes(); }
}
function pillText() {
  if (!S.live) return 'Paused';
  return { sim: 'Demo ' + hms(new Date()), connecting: 'Connecting…', error: 'Offline', closed: 'Market closed', live: 'Live ' + hms(new Date()) }[feed.state];
}
setInterval(() => { if (!LIVE_DATA && S.live && !document.hidden) { tick(); afterTick(); } }, TICK_MS);
setInterval(() => $$('[data-clock]').forEach(c => { c.textContent = pillText(); }), 1000);
window.addEventListener('resize', () => { if (page === 'stocks') drawChart(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) patchLive(true); });

/* ───────────── boot ───────────── */
initMarket();
fetchRate(); setInterval(fetchRate, CONFIG.fxRefreshMs);
if (LIVE_DATA) setInterval(pollQuotes, CONFIG.pollMs);
S.tx.filter(t => t.status === 'pending').forEach(t => settle(t.id, 2000));
applyTheme();
go((location.hash || '#home').slice(1));
pollQuotes();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__tf = { A, S: () => S, go, tick, afterTick };   // handy for debugging
})();

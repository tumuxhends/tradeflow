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
  apiUrl: '',                             // accounts + referrals API (see /referral); blank = no accounts, everything stays on this device
  proxyUrl: '',
  eodhdKey: '',
  eodhdUrl: 'https://eodhd.com/api/real-time/',
  pollMs: 30000,                          // each quote costs API calls on EODHD, so poll gently
  maxPerPoll: 20,                         // symbols per refresh; longer lists are refreshed in rotation
  fxUrl: 'https://open.er-api.com/v6/latest/USD',
  fxRefreshMs: 60 * 60 * 1000,
  liveRate: false,                        // true = fetch the live USD→UGX rate; false = fixed virtual rate
  fallbackRate: 3700,                     // the fixed (virtual) rate
};
Object.assign(CONFIG, window.TRADEFLOW_CONFIG || {});
const LIVE_DATA = !!(CONFIG.proxyUrl || CONFIG.eodhdKey);
let RATE = CONFIG.fallbackRate, RATE_AT = 0, RATE_LIVE = false;   // 1 USD = RATE UGX
try { const c = CONFIG.liveRate ? JSON.parse(localStorage.getItem('tradeflow.rate') || 'null') : null; if (c && c.rate > 0) { RATE = c.rate; RATE_AT = c.at; RATE_LIVE = true; } } catch (e) {}
const API = String(CONFIG.apiUrl || '').replace(/\/$/, ''), API_MODE = !!API;
let SESSION = null; try { SESSION = JSON.parse(localStorage.getItem('tradeflow.session') || 'null'); if (!SESSION || !SESSION.token) SESSION = null; } catch (e) {}
try { const rc = new URLSearchParams(location.search).get('ref'); if (rc) localStorage.setItem('tradeflow.ref', rc.trim().toUpperCase().slice(0, 20)); } catch (e) {}   // a referral link remembers who invited you
const STORE_KEY = API_MODE && SESSION ? 'tradeflow.u' + SESSION.user.id : 'tradeflow.v2';
const TICK_MS = 2000;                    // live feed interval
const REF_BASE = 'https://tumuxhends.github.io/tradeflow/?ref=';   // every referral link is this address + the person's own code
const MIN_DEPOSIT = 5000, MIN_WITHDRAW = 5;      // deposit minimum in UGX, withdrawal minimum in USD

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
const sUSD = n => (n >= 0 ? '+' : '−') + fUSD(Math.abs(n));
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
const STOCK_SYMS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD', 'INTC'];
const DAY = 864e5;
const now0 = Date.now();
const defaults = () => ({
  theme: 'dark', live: true,
  profile: { name: 'Rita Smith', phone: '+256 771 717 171', email: 'rita@gmail.com', since: 'Nov 2026' },
  ver: 3,
  funds: 0,                 // wallet, in USD
  refBal: 0, refEarned: 0,  // referral commissions, in USD
  holdings: {},             // stocks: { qty, avg, sl?, tp? }
  positions: [],            // open leveraged trades (forex, metals, crypto, indices)
  closed: [],               // finished trades, for the success-rate stats
  orders: [],               // stock limit orders
  tx: [],
});
let S = defaults();
let ADOPTED = false;
try {
  let src = localStorage.getItem(STORE_KEY);
  if (!src && API_MODE && SESSION && !localStorage.getItem('tradeflow.adopted')) { src = localStorage.getItem('tradeflow.v2'); ADOPTED = !!src; localStorage.setItem('tradeflow.adopted', '1'); }   // first account on this device keeps the old local wallet
  const raw = JSON.parse(src || 'null'); if (raw) S = Object.assign(defaults(), raw, { profile: Object.assign(defaults().profile, raw.profile || {}) });
  if (ADOPTED) (S.tx || []).forEach(t => { t.ev = 1; });
} catch (e) {}
/* older saves held the wallet in UGX and non-stock holdings: convert once */
if (!S.ver || S.ver < 3) {
  const r = (S.tx.find(t => t.rate) || {}).rate || 3700;
  S.funds = (S.funds || 0) / r; S.refBal = (S.refBal || 0) / r; S.refEarned = (S.refEarned || 0) / r;
  S.tx.forEach(t => { t.ugx = t.amt; t.amt = t.amt / (t.rate || r); });
  Object.keys(S.holdings || {}).forEach(k => { const h = S.holdings[k]; if (!STOCK_SYMS.includes(k)) { S.funds += h.qty * (h.avgU ?? h.avg); delete S.holdings[k]; } else { delete h.avgU; } });
  S.positions = S.positions || []; S.closed = S.closed || []; S.ver = 3;
}
if (API_MODE && SESSION && !S.profile._acct) { S.profile.name = SESSION.user.name; S.profile.phone = '+' + SESSION.user.phone; if (!ADOPTED) S.profile.email = ''; S.profile._acct = 1; }
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {} };

const REFS = { all: 0, today: 0, recent: [], l: [0, 0, 0] };

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
    const a = { sym, name, price, prev: price, idx, cat, colors, trade: true, cur: o.cur ?? (idx || cat === 'majors' || cat === 'minors' || cat === 'exotic' ? '' : '$'),
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
/* ── trading maths ──
   Stocks: bought with cash, in USD.  Everything else (forex, metals, crypto, indices) is traded as leveraged positions,
   settled in USD: a position locks margin, profit/loss follows the price, stop loss / take profit close it automatically. */
const CS = { majors: 100000, minors: 100000, exotic: 100000, metals: 100, crypto: 1, indices: 1 };   // units per 1.00 lot
const CS_NOTE = { majors: '1 lot = 100,000 units', minors: '1 lot = 100,000 units', exotic: '1 lot = 100,000 units', metals: '1 lot = 100 oz', crypto: '1 lot = 1 coin', indices: '1 lot = 1 contract' };
const LEVS = [10, 50, 100];
const fQty = n => (+n.toFixed(4)).toLocaleString('en-US', { maximumFractionDigits: 4 });
function quoteToUsd(q) { if (q === 'USD') return 1; const d = A[q + '/USD']; if (d && !live0(d)) return d.price; const r = A['USD/' + q]; if (r && !live0(r)) return 1 / r.price; return null; }
function convOf(a, p = a.price) {         // USD value of a 1.0 price move on one unit
  if (a.cat === 'stocks' || a.cat === 'indices' || a.cat === 'metals' || a.cat === 'crypto') return 1;
  const [b, q] = a.sym.split('/'); if (q === 'USD') return 1; if (b === 'USD') return 1 / p; return quoteToUsd(q);
}
const dirSign = d => d === 'buy' ? 1 : -1;
const notionalUsd = (a, lots, px) => { const c = convOf(a, px); return c == null ? null : lots * CS[a.cat] * px * c; };
const pnlFor = (a, dir, lots, entry, px) => { const c = convOf(a, px); return c == null ? 0 : dirSign(dir) * lots * CS[a.cat] * (px - entry) * c; };
const posPnl = (p, a, px = a.price) => pnlFor(a, p.dir, p.lots, p.entry, px);
const REASON = { manual: 'Closed by you', sl: 'Stop loss', tp: 'Take profit', stopout: 'Stop-out', limit: 'Limit order' };
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
  for (const sym in S.holdings) { const h = S.holdings[sym], a = A[sym]; if (!a) continue; cost += h.qty * h.avg; if (live0(a)) { mv += h.qty * h.avg; continue; } mv += h.qty * a.price; pl += h.qty * (a.price - a.open); }
  for (const p of S.positions) { const a = A[p.sym]; cost += p.margin; const f = a && !live0(a) ? posPnl(p, a) : 0; mv += p.margin + f; pl += f; }
  const pending = S.tx.filter(t => t.status === 'pending').reduce((s, t) => s + Math.abs(t.amt), 0);
  return { mv, pl, cost, unreal: mv - cost, total: S.funds + mv + S.refBal, assets: S.funds + mv, pending, plPct: mv - pl > 0 ? pl / (mv - pl) * 100 : 0 };
}
function bindings() {
  const p = portfolio(), st = stats();
  return {
    total: { t: fUSD(p.total) }, totalUgx: { t: '≈ ' + fUGX(p.total * RATE) }, funds: { t: fUSD(S.funds) }, fundsUgx: { t: '≈ ' + fUGX(S.funds * RATE) }, mv: { t: fUSD(p.mv) }, assets: { t: fUSD(p.assets) },
    pl: { t: sUSD(p.pl), s: p.pl }, plPct: { t: sPct(p.plPct) + ' today', s: p.pl }, refBal: { t: fUSD(S.refBal) },
    unreal: { t: sUSD(p.unreal), s: p.unreal }, pending: { t: fUSD(p.pending) },
    heroPl: { t: `${p.pl >= 0 ? '▲' : '▼'} ${sUSD(p.pl)} today`, s: p.pl },
    winRate: { t: st.n ? st.rate.toFixed(0) + '%' : '—' }, winCount: { t: st.n ? `${st.wins} of ${st.n} trades won` : 'No closed trades yet' },
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
const txIcon = { deposit: 'down', withdraw: 'up', buy: 'stocks', sell: 'swap', trade: 'swap', commission: 'gift' };
function txRow(t) {
  const d = new Date(t.ts), pend = t.status === 'pending';
  return `<div class="tx"><div class="tx-ic ${t.type === 'trade' ? (t.amt >= 0 ? 'sell' : 'withdraw') : t.type}">${ic(txIcon[t.type] || 'coin')}</div>
    <div class="mid"><b>${esc(t.title)}</b><span>${esc(t.sub)} · ${hm(d)}</span></div>
    <div class="amt num"><span class="${t.amt >= 0 ? 'up' : ''}">${sUSD(t.amt)}</span><span class="status ${pend ? 'pending' : 'done'}">${pend ? '● Pending' : 'Completed'}</span></div></div>`;
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
const catNote = () => LIVE_DATA ? '' : 'Virtual market: simulated prices, so you can practise without risk.';
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
    <div class="amount num" data-bind="total">${fUSD(portfolio().total)}</div>
    <div class="small num" data-bind="totalUgx" style="opacity:.8;margin:-2px 0 8px"></div>
    <span class="delta num" data-bind="heroPl" data-signed>—</span>
    <div class="hero-actions">
      <button class="hero-btn" data-act="deposit">${ic('down')}Deposit</button>
      <button class="hero-btn" data-act="withdraw">${ic('up')}Withdraw</button>
      <button class="hero-btn" data-act="gostocks">${ic('swap')}Trade</button>
    </div>
  </div>
  <div class="grid2 block" style="margin-top:14px">
    <div class="stat"><div class="k">Available cash</div><div class="v num" data-bind="funds"></div></div>
    <div class="stat"><div class="k">In trades</div><div class="v num" data-bind="mv"></div></div>
  </div>
  <div class="card block" data-act="goperf" style="display:flex;align-items:center;gap:14px;cursor:pointer"><div style="flex:1"><div class="small muted">Trade success rate</div><div style="font-size:22px;font-weight:800" class="num" data-bind="winRate">—</div><div class="small muted" data-bind="winCount"></div></div>${ic('chev', 'style="width:18px;height:18px;color:var(--text-3)"')}</div>
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
  ${head('Trade', 'Real-time quotes, in US dollars')}
  <div class="grid2">
    <div class="stat"><div class="k">Available funds</div><div class="v num" data-bind="funds"></div></div>
    <div class="stat"><div class="k">Total assets</div><div class="v num" data-bind="assets"></div></div>
    <div class="stat"><div class="k">In trades</div><div class="v num" data-bind="mv"></div></div>
    <div class="stat"><div class="k">Open P/L</div><div class="v num" data-bind="pl" data-signed></div></div>
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
    <div class="btn-row" style="margin-top:14px"><button class="btn green" data-act="trade" data-side="buy" data-sym="${a.sym}">Buy</button><button class="btn red" data-act="trade" data-side="sell" data-sym="${a.sym}">Sell</button></div>
  </div>
  <div class="block">
    <div class="seg"><button class="${stockTab === 'market' ? 'on' : ''}" data-act="stab" data-v="market">Quotes</button><button class="${stockTab === 'holdings' ? 'on' : ''}" data-act="stab" data-v="holdings">My trades</button><button class="${stockTab === 'stats' ? 'on' : ''}" data-act="stab" data-v="stats">Performance</button></div>
    <div id="stockList"></div>
  </div>`;
  renderStockList(); bindChart(); drawChart(); patchLive(true);
}
function renderStockList() {
  const el = $('#stockList'); if (!el) return;
  if (stockTab === 'market') {
    const f = q.trim().toUpperCase(), list = catList(cat).filter(s => s.sym.includes(f) || s.name.toUpperCase().includes(f));
    el.innerHTML = `<label class="search">${ic('search')}<input id="search" placeholder="Search ticker or company" value="${esc(q)}" autocomplete="off"></label><div class="rows" id="quoteRows">${list.map(s => stockRow(s, s.sym === selSym)).join('') || '<div class="empty">No matches</div>'}</div>`;
  } else if (stockTab === 'stats') {
    el.innerHTML = statsHtml();
  } else {
    const hs = Object.keys(S.holdings), ps = S.positions;
    const prot = o => (o.sl || o.tp) ? `<span class="small muted" style="display:block">${o.sl ? 'SL ' + fmtPx(A[o.sym || ''] || o.a, o.sl) : ''}${o.sl && o.tp ? ' · ' : ''}${o.tp ? 'TP ' + fmtPx(A[o.sym || ''] || o.a, o.tp) : ''}</span>` : '';
    const posRows = ps.map(pp => {
      const a = A[pp.sym], f = live0(a) ? 0 : posPnl(pp, a), pc = pp.margin ? f / pp.margin * 100 : 0;
      return `<div class="row" data-act="popen" data-id="${pp.id}"><div class="sym-logo" style="background:${colorsBg(a)};${logoTxt(a).length > 1 ? 'font-size:11px' : ''}">${logoTxt(a)}</div>
        <div class="meta"><b>${pp.sym} <span class="tag ${pp.dir}">${pp.dir === 'buy' ? 'BUY' : 'SELL'}</span></b><span>${fQty(pp.lots)} lot · ${fmtPx(a, pp.entry)} → ${fPx(a)}</span>${prot({ sl: pp.sl, tp: pp.tp, sym: pp.sym })}</div>
        <div class="px" style="min-width:104px"><b class="num ${f >= 0 ? 'up' : 'down'}">${sUSD(f)}</b><span class="small num ${f >= 0 ? 'up' : 'down'}" style="font-weight:700">${sPct(pc)}</span></div></div>`;
    }).join('');
    const stockRows = hs.map(sym => {
      const h = S.holdings[sym], a = A[sym], val = live0(a) ? h.qty * h.avg : h.qty * a.price, pl = val - h.qty * h.avg, pc = h.avg ? (pl / (h.qty * h.avg)) * 100 : 0;
      return `<div class="row" data-act="trade" data-side="sell" data-sym="${sym}"><div class="sym-logo" style="background:${colorsBg(a)}">${logoTxt(a)}</div>
        <div class="meta"><b>${sym}</b><span>${fQty(h.qty)} sh · avg ${fmtPx(a, h.avg)}</span>${prot({ sl: h.sl, tp: h.tp, sym })}</div>
        <div class="px" style="min-width:104px"><b class="num">${fUSD(val)}</b><span class="small num ${pl >= 0 ? 'up' : 'down'}" style="font-weight:700">${sUSD(pl)} (${sPct(pc)})</span></div></div>`;
    }).join('');
    el.innerHTML = `${ps.length ? `<div class="sec-title" style="margin:0 0 8px">Open trades</div><div class="rows">${posRows}</div>` : ''}
    ${hs.length ? `<div class="sec-title" style="margin:${ps.length ? 18 : 0}px 0 8px">Stocks</div><div class="rows">${stockRows}</div>` : ''}
    ${!ps.length && !hs.length ? '<div class="empty">No open trades yet. Pick any market and tap Buy or Sell.</div>' : ''}
    ${S.orders.length ? `<div class="sec-title" style="margin:18px 0 8px">Open limit orders</div><div class="rows">${S.orders.map(o => `<div class="row" style="cursor:default"><div class="sym-logo" style="background:${colorsBg(A[o.sym])}">${o.sym[0]}</div><div class="meta"><b>${o.side === 'buy' ? 'Buy' : 'Sell'} ${fQty(o.qty)} ${o.sym}</b><span>Limit ${fmtPx(A[o.sym], o.limit)}</span></div><button class="mini-btn" data-act="cancelorder" data-id="${o.id}">Cancel</button></div>`).join('')}</div>` : ''}`;
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
  const code = API_MODE && SESSION ? SESSION.user.code : (S.profile.name.split(' ')[0] || 'USER').toUpperCase() + '123', link = REF_BASE + code;
  $('#page-referral').innerHTML = `
  <div class="top"><div></div><div class="top-actions">${themeBtn()}</div></div>
  <div class="ref-hero"><div class="ic">${ic('coin')}</div><h1>Referral Program</h1><p>Earn commissions on 3 levels of referrals. Share your link and start earning passive income today!</p></div>
  <div class="stats3">
    <div class="stat"><div class="v num">${REFS.all}</div><div class="k" style="margin:2px 0 0">All referrals</div></div>
    <div class="stat"><div class="v num">${pad2(REFS.today)}</div><div class="k" style="margin:2px 0 0">Today</div></div>
    <div class="stat"><div class="v num">${fUSD(S.refEarned)}</div><div class="k" style="margin:2px 0 0">Total earnings</div></div>
  </div>
  <div class="card"><div class="sec-head" style="margin:0"><h2>Your referral link</h2><span class="badge-active">Active</span></div>
    <div class="link-box"><input class="input" id="refLink" value="${link}" readonly><button class="btn sm" data-act="copy">${ic('copy')}Copy</button></div></div>
  <div class="card"><div style="display:flex;align-items:center;gap:12px"><div style="flex:1"><div class="k small muted">Unclaimed commissions${API_MODE ? ' (paid on your network\'s deposits)' : ''}</div><div style="font-size:20px;font-weight:800" class="num" data-bind="refBal">${fUSD(S.refBal)}</div></div>
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
    <div class="level l1"><div class="pc">10%</div><b style="font-size:12px">Level A</b><small>${API_MODE ? REFS.l[0] + ' people' : 'Direct'}</small></div>
    <div class="level l2"><div class="pc">5%</div><b style="font-size:12px">Level B</b><small>${API_MODE ? REFS.l[1] + ' people' : 'Team'}</small></div>
    <div class="level l3"><div class="pc">2%</div><b style="font-size:12px">Level C</b><small>${API_MODE ? REFS.l[2] + ' people' : 'Network'}</small></div></div></div>
  <div class="block"><div class="sec-head"><h2>Recent commissions</h2></div>
    ${REFS.recent.length ? REFS.recent.map(r => `<div class="tx"><div class="avatar" style="background:${r.c}">${initials(r.name.replace(/[._\d]/g, ' '))}</div><div class="mid"><b>${esc(r.name)}</b><span>Level ${r.lv} (${r.pct}%) · ${r.d}</span></div><div class="amt up num">+${fUSD(r.amt)}</div></div>`).join('') : '<div class="empty">No commissions yet. Share your link to start earning.</div>'}</div>`;
}

function renderProfile() {
  const p = S.profile, pf = portfolio(), dark = resolveTheme() === 'dark';
  $('#page-profile').innerHTML = `
  <div class="top"><div></div><div class="top-actions">${themeBtn()}</div></div>
  <div class="profile-head"><div class="avatar-lg">${esc(initials(p.name))}</div><h1>${esc(p.name)}</h1><p>${esc(p.phone)}</p><p>${esc(p.email)}</p></div>
  <div class="grid2 block"><div class="stat"><div class="k">Portfolio value</div><div class="v num" data-bind="total"></div></div><div class="stat"><div class="k">Trade success</div><div class="v num" data-bind="winRate">—</div></div></div>
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
  const list = sortedTx().filter(t => finFilter === 'all' || (finFilter === 'trade' ? (t.type === 'buy' || t.type === 'sell' || t.type === 'trade') : t.type === finFilter));
  const pf = portfolio();
  $('#page-finance').innerHTML = `
  ${head('Finance', 'Wallet, balances & transactions')}
  <div class="hero card"><div class="label">Total balance</div><div class="amount num" data-bind="total">${fUSD(pf.total)}</div>
    <div class="small num" data-bind="totalUgx" style="opacity:.8;margin:-2px 0 8px"></div>
    <span class="delta num" data-bind="heroPl" data-signed>—</span>
    <div class="btn-row" style="margin-top:18px"><button class="hero-btn" style="flex:1;flex-direction:row;justify-content:center;font-size:14px" data-act="deposit">${ic('down')}Deposit</button><button class="hero-btn" style="flex:1;flex-direction:row;justify-content:center;font-size:14px" data-act="withdraw">${ic('up')}Withdraw</button></div></div>
  <div class="block"><div class="sec-head"><h2>Balances</h2></div>
    <div class="card" style="padding:6px 16px 14px">
      <div class="bal"><div class="tx-ic deposit">${ic('wallet')}</div><div class="mid"><b>Wallet (USD)</b><span>Available to trade or withdraw</span></div><div class="v num"><div data-bind="funds"></div><div class="small muted num" data-bind="fundsUgx" style="font-weight:500"></div></div></div>
      <div class="bal"><div class="tx-ic buy">${ic('pie')}</div><div class="mid"><b>In trades</b><span>Stocks + margin and open P/L</span></div><div class="v num"><div data-bind="mv"></div><div class="small num" data-bind="unreal" data-signed style="font-weight:700"></div></div></div>
      <div class="bal"><div class="tx-ic commission">${ic('gift')}</div><div class="mid"><b>Referral earnings</b><span><button class="link-btn" style="font-size:12px" data-act="claim">Move to wallet</button></span></div><div class="v num" data-bind="refBal"></div></div>
      <div class="bal"><div class="tx-ic" style="background:var(--info-bg);color:var(--info)">${ic('clock')}</div><div class="mid"><b>Pending</b><span>Deposits / withdrawals in progress</span></div><div class="v num" data-bind="pending"></div></div>
      <div class="alloc"><i data-alloc="funds" style="background:var(--up)"></i><i data-alloc="mv" style="background:var(--accent)"></i><i data-alloc="ref" style="background:var(--purple)"></i></div>
      <div class="small muted" style="display:flex;gap:14px;flex-wrap:wrap"><span><b class="up">●</b> Cash</span><span><b style="color:var(--accent)">●</b> Trades</span><span><b style="color:var(--purple)">●</b> Referral</span></div>
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
const isStock = a => a.cat === 'stocks';
const PCT = a => ['majors', 'minors', 'exotic'].includes(a.cat) ? [.1, .25, .5, 1] : (a.cat === 'metals' || a.cat === 'indices') ? [.5, 1, 2, 4] : [1, 2, 5, 10];
const protDir = a => isStock(a) ? 'buy' : T.side;
function openTrade(sym, side) {
  const a = A[sym], h = S.holdings[sym];
  T = { sym, side: side || 'buy', type: 'market', qty: isStock(a) ? '' : '0.01', sl: h && h.sl ? String(h.sl) : '', tp: h && h.tp ? String(h.tp) : '', lev: 50 };
  sheetOpen = 'trade'; drawTrade();
}
function protBlock(a) {
  const pc = PCT(a), up = isStock(a) || T.side === 'buy';
  return `<div class="two"><div class="field"><label>Stop loss</label><input class="input" id="tSL" type="number" inputmode="decimal" step="${10 ** -a.dec}" placeholder="Optional" value="${T.sl}"></div>
    <div class="field"><label>Take profit</label><input class="input" id="tTP" type="number" inputmode="decimal" step="${10 ** -a.dec}" placeholder="Optional" value="${T.tp}"></div></div>
  <div class="chips" style="margin:-6px 0 6px"><span class="small muted" style="align-self:center;width:34px">SL</span>${pc.map(n => `<button class="chip" data-act="tslp" data-v="${n}">${up ? '−' : '+'}${n}%</button>`).join('')}</div>
  <div class="chips" style="margin:0 0 14px"><span class="small muted" style="align-self:center;width:34px">TP</span>${pc.map(n => `<button class="chip" data-act="ttpp" data-v="${n * 2}">${up ? '+' : '−'}${n * 2}%</button>`).join('')}</div>`;
}
function sheetHead(a) {
  return `<div class="sheet-head"><div class="sym-logo" style="background:${colorsBg(a)};${logoTxt(a).length > 1 ? 'font-size:11px' : ''}">${logoTxt(a)}</div><div style="flex:1"><h3>${a.sym}</h3><div class="small muted">${a.name}</div></div><div style="text-align:right"><b class="num" data-px="${a.sym}">${fPx(a)}</b><div><span class="pill ${chgCls(a)} num" data-chg="${a.sym}">${fChg(a)}</span></div></div></div>`;
}
function drawTrade() {
  const a = A[T.sym], buy = T.side === 'buy', h = S.holdings[T.sym];
  if (isStock(a)) {
    openSheet(`${sheetHead(a)}
    <div class="seg ${buy ? '' : 'sell'}"><button class="${buy ? 'on' : ''}" data-act="tside" data-v="buy">Buy</button><button class="${!buy ? 'on' : ''}" data-act="tside" data-v="sell">Sell</button></div>
    <div class="field"><label>Order type</label><div class="chips" style="margin:0"><button class="chip ${T.type === 'market' ? 'on' : ''}" data-act="ttype" data-v="market">Market</button><button class="chip ${T.type === 'limit' ? 'on' : ''}" data-act="ttype" data-v="limit">Limit</button></div></div>
    ${T.type === 'limit' ? `<div class="field"><label>Limit price (USD)</label><input class="input" id="tLimit" type="number" inputmode="decimal" step="0.01" value="${a.price.toFixed(2)}"></div>` : ''}
    <div class="field"><label>Quantity (shares) ${!buy ? `<span class="muted">(you own ${h ? h.qty : 0})</span>` : ''}</label><input class="input" id="tQty" type="number" inputmode="numeric" min="1" step="1" placeholder="0" value="${T.qty}">
      <div class="chips">${[1, 5, 10, 25].map(n => `<button class="chip" data-act="tqty" data-v="${n}">${n}</button>`).join('')}${!buy && h ? `<button class="chip" data-act="tqty" data-v="${h.qty}">All</button>` : ''}</div></div>
    ${protBlock(a)}${!buy && h ? `<button class="btn ghost" data-act="hsave" style="margin-bottom:12px">Save stop loss / take profit on my ${a.sym}</button>` : ''}
    <div class="summary" id="tSummary"></div><div class="err" id="tErr"></div>
    <button class="btn ${buy ? 'green' : 'red'}" data-act="tconfirm">${buy ? 'Buy' : 'Sell'} ${a.sym}</button>`);
  } else {
    openSheet(`${sheetHead(a)}
    <div class="seg ${buy ? '' : 'sell'}"><button class="${buy ? 'on' : ''}" data-act="tside" data-v="buy">Buy · go long</button><button class="${!buy ? 'on' : ''}" data-act="tside" data-v="sell">Sell · go short</button></div>
    <div class="field"><label>Size (lots) <span class="muted">${CS_NOTE[a.cat]}</span></label><input class="input" id="tQty" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0.01" value="${T.qty}">
      <div class="chips">${[0.01, 0.05, 0.1, 0.5, 1].map(n => `<button class="chip" data-act="tqty" data-v="${n}">${n}</button>`).join('')}</div></div>
    <div class="field"><label>Leverage</label><div class="chips" style="margin:0">${LEVS.map(n => `<button class="chip ${T.lev === n ? 'on' : ''}" data-act="tlev" data-v="${n}">1:${n}</button>`).join('')}</div></div>
    ${protBlock(a)}
    <div class="summary" id="tSummary"></div><div class="err" id="tErr"></div>
    <button class="btn ${buy ? 'green' : 'red'}" data-act="tconfirm">${buy ? 'Buy' : 'Sell'} ${a.sym}</button>`);
  }
  refreshTrade();
}
function refreshTrade() {
  const box = $('#tSummary'); if (!box || !T) return;
  const a = A[T.sym], row = (k, v) => `<div><span>${k}</span><span class="num">${v}</span></div>`;
  if (isStock(a)) {
    const qty = parseFloat(T.qty) || 0, lim = parseFloat($('#tLimit')?.value), px = T.type === 'limit' && lim > 0 ? lim : a.price, h = S.holdings[T.sym];
    box.innerHTML = row(T.type === 'limit' ? 'Limit price' : 'Market price', fUSD(px)) + row(T.side === 'buy' ? 'Available cash' : 'Shares owned', T.side === 'buy' ? fUSD(S.funds) : (h ? h.qty : 0)) + row(`Estimated ${T.side === 'buy' ? 'cost' : 'proceeds'}`, fUSD(qty * px));
    return;
  }
  const lots = parseFloat(T.qty) || 0, px = a.price, not = notionalUsd(a, lots, px), mg = not == null ? null : not / T.lev, sl = parseFloat(T.sl), tp = parseFloat(T.tp);
  let h = row('Market price', fPx(a)) + row('Position size', not == null ? '—' : fUSD(not)) + row(`Margin required (1:${T.lev})`, mg == null ? '—' : fUSD(mg)) + row('Available cash', fUSD(S.funds));
  const loss = sl > 0 ? pnlFor(a, T.side, lots, px, sl) : null, gain = tp > 0 ? pnlFor(a, T.side, lots, px, tp) : null;
  if (loss != null) h += row('Loss if stop loss hits', `<span class="down">${sUSD(loss)}</span>`);
  if (gain != null) h += row('Profit if take profit hits', `<span class="up">${sUSD(gain)}</span>`);
  if (loss != null && gain != null && loss < 0) h += row('Risk : reward', `1 : ${(gain / -loss).toFixed(1)}`);
  box.innerHTML = h + `<div class="small muted" style="margin-top:6px">Your loss on a trade can't exceed its margin: it closes automatically (stop-out).</div>`;
}

/* ── records ── */
function record(e) { S.closed.push(Object.assign({ id: uid(), ts: Date.now() }, e)); if (S.closed.length > 500) S.closed.shift(); }
function stats() {
  const c = S.closed, n = c.length, sum = l => l.reduce((t, x) => t + x.pnl, 0), w = c.filter(x => x.pnl > 0), l = c.filter(x => x.pnl < 0), gw = sum(w), gl = -sum(l);
  return { n, wins: w.length, losses: l.length, rate: n ? w.length / n * 100 : 0, net: sum(c), avgW: w.length ? gw / w.length : 0, avgL: l.length ? gl / l.length : 0, pf: gl ? gw / gl : (gw ? Infinity : 0),
    best: n ? Math.max(...c.map(x => x.pnl)) : 0, worst: n ? Math.min(...c.map(x => x.pnl)) : 0, sl: c.filter(x => x.reason === 'sl').length, tp: c.filter(x => x.reason === 'tp').length, so: c.filter(x => x.reason === 'stopout').length };
}
const CAT_LABEL = { stocks: 'Stocks', majors: 'Forex majors', minors: 'Forex minors', exotic: 'Forex exotic', metals: 'Metals', crypto: 'Crypto', indices: 'Indices' };
function statsHtml() {
  const st = stats(); if (!st.n) return '<div class="empty">No closed trades yet. Your success rate, profit and loss history appear here after your first trade closes.</div>';
  const tile = (k, v, cls = '') => `<div class="stat"><div class="k">${k}</div><div class="v num ${cls}">${v}</div></div>`;
  const by = {}; S.closed.forEach(x => { const b = by[x.cat] || (by[x.cat] = { n: 0, w: 0, net: 0 }); b.n++; b.net += x.pnl; if (x.pnl > 0) b.w++; });
  const hist = [...S.closed].reverse().slice(0, 25).map(x => `<div class="tx"><div class="tx-ic ${x.pnl >= 0 ? 'sell' : 'withdraw'}">${ic('swap')}</div><div class="mid"><b>${x.sym} <span class="tag ${x.dir}">${x.dir === 'buy' ? 'BUY' : 'SELL'}</span></b><span>${fQty(x.size)} ${x.kind === 'fx' ? 'lot' : 'sh'} · ${REASON[x.reason] || x.reason} · ${dayLabel(x.ts)}</span></div><div class="amt num"><span class="${x.pnl >= 0 ? 'up' : 'down'}">${sUSD(x.pnl)}</span></div></div>`).join('');
  return `<div class="card"><div class="small muted">Success rate</div><div style="font-size:34px;font-weight:800;letter-spacing:-1px" class="num">${st.rate.toFixed(1)}%</div>
    <div class="winbar"><i style="width:${st.rate}%"></i></div><div class="small muted">${st.wins} won · ${st.losses} lost · ${st.n - st.wins - st.losses} break-even · ${st.n} closed</div></div>
  <div class="grid2" style="margin-top:12px">${tile('Net profit / loss', sUSD(st.net), st.net >= 0 ? 'up' : 'down')}${tile('Profit factor', st.pf === Infinity ? '∞' : st.pf.toFixed(2))}${tile('Average win', fUSD(st.avgW), 'up')}${tile('Average loss', fUSD(st.avgL), 'down')}${tile('Best trade', sUSD(st.best), 'up')}${tile('Worst trade', sUSD(st.worst), 'down')}${tile('Closed by stop loss', st.sl)}${tile('Closed by take profit', st.tp)}</div>
  <div class="sec-title" style="margin:18px 0 8px">By market</div><div class="rows">${Object.keys(by).map(k => `<div class="row" style="cursor:default"><div class="meta"><b>${CAT_LABEL[k] || k}</b><span>${by[k].n} trade${by[k].n === 1 ? '' : 's'} · ${(by[k].w / by[k].n * 100).toFixed(0)}% won</span></div><div class="px"><b class="num ${by[k].net >= 0 ? 'up' : 'down'}">${sUSD(by[k].net)}</b></div></div>`).join('')}</div>
  <div class="sec-title" style="margin:18px 0 8px">Trade history</div>${hist}`;
}

/* ── stocks (cash, USD) ── */
function execStock(side, sym, qty, px, o = {}, reason = 'manual') {
  const a = A[sym], h = S.holdings[sym], val = qty * px;
  if (side === 'buy') {
    if (val > S.funds + 1e-9) return 'Insufficient funds';
    S.funds -= val;
    if (h) { h.avg = (h.qty * h.avg + val) / (h.qty + qty); h.qty += qty; } else S.holdings[sym] = { qty, avg: px };
    if (o.sl) S.holdings[sym].sl = o.sl; if (o.tp) S.holdings[sym].tp = o.tp;
  } else {
    if (!h || h.qty < qty) return 'Not enough shares';
    S.funds += val; record({ sym, cat: 'stocks', dir: 'buy', size: qty, entry: h.avg, exit: px, pnl: qty * (px - h.avg), reason, kind: 'stock' });
    h.qty -= qty; if (!h.qty) delete S.holdings[sym];
  }
  S.tx.push({ id: uid(), type: side, title: `${side === 'buy' ? 'Bought' : 'Sold'} ${qty} ${sym}`, sub: `@ ${fUSD(px)}${side === 'sell' && reason !== 'manual' ? ' · ' + REASON[reason] : ''}`, amt: side === 'buy' ? -val : val, ts: Date.now(), status: 'done' });
  save(); return null;
}
/* validates stop loss / take profit against a price; returns an error text or null */
function protError(dir, px, sl, tp) {
  if (sl > 0 && (dir === 'buy' ? sl >= px : sl <= px)) return `Stop loss must be ${dir === 'buy' ? 'below' : 'above'} the current price.`;
  if (tp > 0 && (dir === 'buy' ? tp <= px : tp >= px)) return `Take profit must be ${dir === 'buy' ? 'above' : 'below'} the current price.`;
  return null;
}
function confirmTrade() {
  const a = A[T.sym], err = m => { $('#tErr').textContent = m; };
  if (LIVE_DATA && !a.real) return err('Waiting for a live price. Try again in a moment.');
  const sl = parseFloat(T.sl) || 0, tp = parseFloat(T.tp) || 0;
  if (!isStock(a)) return confirmFx(a, sl, tp, err);
  const qty = parseInt(T.qty);
  if (!qty || qty < 1) return err('Enter a valid quantity.');
  let lim = null;
  if (T.type === 'limit') { lim = parseFloat($('#tLimit').value); if (!lim || lim <= 0) return err('Enter a valid limit price.'); }
  if (T.side === 'buy') { const pe = protError('buy', lim || a.price, sl, tp); if (pe) return err(pe); }
  const marketable = T.type === 'market' || (T.side === 'buy' ? a.price <= lim : a.price >= lim);
  if (marketable) {
    const e = execStock(T.side, T.sym, qty, a.price, { sl, tp }); if (e) return err(e);
    toast(T.side === 'buy' ? 'Order filled' : 'Sold', `${T.side === 'buy' ? 'Bought' : 'Sold'} ${qty} ${T.sym} @ ${fUSD(a.price)}`);
  } else {
    if (T.side === 'buy' && qty * lim > S.funds) return err('Insufficient funds for this limit order.');
    if (T.side === 'sell' && (!S.holdings[T.sym] || S.holdings[T.sym].qty < qty)) return err('Not enough shares.');
    S.orders.push({ id: uid(), side: T.side, sym: T.sym, qty, limit: lim, sl, tp }); save();
    toast('Limit order placed', `${T.side === 'buy' ? 'Buy' : 'Sell'} ${qty} ${T.sym} when price ${T.side === 'buy' ? '≤' : '≥'} ${fUSD(lim)}`);
  }
  closeSheet(); T = null; refreshPage();
}
/* update stop loss / take profit on shares you already own */
function saveHoldingProtection() {
  const a = A[T.sym], h = S.holdings[T.sym], sl = parseFloat(T.sl) || 0, tp = parseFloat(T.tp) || 0;
  if (!h) return;
  const pe = protError('buy', a.price, sl, tp); if (pe) return $('#tErr').textContent = pe;
  sl ? h.sl = sl : delete h.sl; tp ? h.tp = tp : delete h.tp; save(); closeSheet(); T = null; refreshPage();
  toast('Protection saved', `${a.sym}: ${sl ? 'stop loss ' + fUSD(sl) : 'no stop loss'}${tp ? ' · take profit ' + fUSD(tp) : ''}`);
}

/* ── leveraged trades (forex, metals, crypto, indices) ── */
function confirmFx(a, sl, tp, err) {
  const lots = Math.round((parseFloat(T.qty) || 0) * 100) / 100, px = a.price;
  if (!(lots >= .01)) return err('Minimum size is 0.01 lot.');
  if (lots > 100) return err('Maximum size is 100 lots.');
  const not = notionalUsd(a, lots, px); if (not == null) return err('Waiting for the live rate of this pair. Try again in a moment.');
  const margin = not / T.lev; if (margin > S.funds + 1e-9) return err(`Not enough funds. This trade needs ${fUSD(margin)} margin; you have ${fUSD(S.funds)}.`);
  const pe = protError(T.side, px, sl, tp); if (pe) return err(pe);
  S.funds -= margin; S.positions.push({ id: uid(), sym: T.sym, dir: T.side, lots, entry: px, lev: T.lev, margin, sl: sl || 0, tp: tp || 0, ts: Date.now() }); save();
  toast(T.side === 'buy' ? 'Buy opened' : 'Sell opened', `${fQty(lots)} lot ${T.sym} @ ${fmtPx(a, px)} · margin ${fUSD(margin)}`);
  closeSheet(); T = null; refreshPage();
}
function closePos(id, px, reason) {
  const i = S.positions.findIndex(x => x.id === id); if (i < 0) return null;
  const p = S.positions[i], a = A[p.sym], pnl = Math.max(posPnl(p, a, px), -p.margin);
  S.funds += p.margin + pnl; S.positions.splice(i, 1);
  record({ sym: p.sym, cat: a.cat, dir: p.dir, size: p.lots, entry: p.entry, exit: px, pnl, reason, kind: 'fx' });
  S.tx.push({ id: uid(), type: 'trade', title: `Closed ${p.dir === 'buy' ? 'BUY' : 'SELL'} ${p.sym}`, sub: `${fQty(p.lots)} lot · ${REASON[reason]}`, amt: pnl, ts: Date.now(), status: 'done' });
  save(); return pnl;
}
let PS = null;   // open-position sheet: id of the position being managed
function openPos(id) { if (!S.positions.find(x => x.id === id)) return; PS = id; sheetOpen = 'pos'; drawPos(); }
function drawPos() {
  const p = S.positions.find(x => x.id === PS); if (!p) return closeSheet(); const a = A[p.sym];
  T = { sym: p.sym, side: p.dir, sl: p.sl ? String(p.sl) : '', tp: p.tp ? String(p.tp) : '' };
  openSheet(`${sheetHead(a)}<div class="summary" id="pSum"></div>${protBlock(a)}<div class="err" id="tErr"></div>
    <button class="btn ghost" data-act="psave" style="margin-bottom:10px">Save stop loss / take profit</button><button class="btn red" data-act="pclose">Close position now</button>`);
  updatePos();
}
function updatePos() {
  const p = S.positions.find(x => x.id === PS), box = $('#pSum'); if (!box) return; if (!p) return closeSheet();
  const a = A[p.sym], f = live0(a) ? 0 : posPnl(p, a), row = (k, v) => `<div><span>${k}</span><span class="num">${v}</span></div>`;
  box.innerHTML = row('Direction', `<span class="tag ${p.dir}">${p.dir === 'buy' ? 'BUY' : 'SELL'}</span> ${fQty(p.lots)} lot`) + row('Entry price', fmtPx(a, p.entry)) + row('Current price', fPx(a)) + row('Margin (1:' + p.lev + ')', fUSD(p.margin)) + row('Profit / loss', `<b class="${f >= 0 ? 'up' : 'down'}">${sUSD(f)}</b>`);
}
function savePos() {
  const p = S.positions.find(x => x.id === PS); if (!p) return; const a = A[p.sym], sl = parseFloat(T.sl) || 0, tp = parseFloat(T.tp) || 0;
  const pe = protError(p.dir, a.price, sl, tp); if (pe) return $('#tErr').textContent = pe;
  p.sl = sl; p.tp = tp; save(); closeSheet(); PS = null; T = null; refreshPage(); toast('Protection saved', `${p.sym}: ${sl ? 'stop loss ' + fmtPx(a, sl) : 'no stop loss'}${tp ? ' · take profit ' + fmtPx(a, tp) : ''}`);
}
function closePosNow() {
  const p = S.positions.find(x => x.id === PS); if (!p) return; const a = A[p.sym];
  if (live0(a)) return $('#tErr').textContent = 'Waiting for a live price.';
  const pnl = closePos(p.id, a.price, 'manual'); closeSheet(); PS = null; T = null; refreshPage(); toast('Position closed', `${p.sym}: ${sUSD(pnl)}`, pnl < 0);
}

/* ── automatic exits: stop loss, take profit, stop-out; limit orders ── */
function checkProtect() {
  let changed = false;
  for (const p of [...S.positions]) {
    const a = A[p.sym]; if (!a || live0(a)) continue; const px = a.price; let hit = null, ex = px;
    if (p.sl && (p.dir === 'buy' ? px <= p.sl : px >= p.sl)) { hit = 'sl'; ex = p.sl; }
    else if (p.tp && (p.dir === 'buy' ? px >= p.tp : px <= p.tp)) { hit = 'tp'; ex = p.tp; }
    else if (posPnl(p, a) <= -p.margin) hit = 'stopout';
    if (hit) { const pnl = closePos(p.id, ex, hit); changed = true; toast(hit === 'tp' ? 'Take profit hit' : hit === 'sl' ? 'Stop loss hit' : 'Stop-out', `${p.sym}: ${sUSD(pnl)}`, pnl < 0); }
  }
  for (const sym of Object.keys(S.holdings)) {
    const h = S.holdings[sym], a = A[sym]; if (!h || !a || live0(a)) continue; const px = a.price;
    const hit = h.sl && px <= h.sl ? 'sl' : h.tp && px >= h.tp ? 'tp' : null; if (!hit) continue;
    const ex = hit === 'sl' ? h.sl : h.tp, qty = h.qty, pnl = qty * (ex - h.avg);
    if (!execStock('sell', sym, qty, ex, {}, hit)) { changed = true; toast(hit === 'tp' ? 'Take profit hit' : 'Stop loss hit', `${sym}: sold ${qty} · ${sUSD(pnl)}`, pnl < 0); }
  }
  if (changed) { if (sheetOpen === 'pos' && !S.positions.find(x => x.id === PS)) closeSheet(); refreshPage(); }
}
function checkOrders() {
  let changed = false;
  S.orders = S.orders.filter(o => {
    const a = A[o.sym]; if (LIVE_DATA && !a.real) return true;
    const hit = o.side === 'buy' ? a.price <= o.limit : a.price >= o.limit; if (!hit) return true;
    const e = execStock(o.side, o.sym, o.qty, a.price, { sl: o.sl, tp: o.tp }, 'limit'); changed = true;
    e ? toast('Order cancelled', `${o.sym}: ${e}`, true) : toast('Limit order filled', `${o.side === 'buy' ? 'Bought' : 'Sold'} ${o.qty} ${o.sym} @ ${fUSD(a.price)}`);
    return false;
  });
  if (changed) { save(); refreshPage(); }
}

/* ───────────── deposit / withdraw ─────────────
   The wallet is held in US dollars. Deposits are paid in UGX and converted to USD at the live rate;
   withdrawals are taken in USD and paid out in UGX at the live rate. */
const METHODS = [
  { id: 'mtn', n: 'MTN Mobile Money', d: 'Instant', f: 'phone' },
  { id: 'airtel', n: 'Airtel Money', d: 'Instant', f: 'phone' },
  { id: 'bank', n: 'Bank transfer', d: '1–2 business days', f: 'acct' },
  { id: 'card', n: 'Visa / Mastercard', d: 'Instant', f: 'none' },
];
let M = null;
const feeUsd = (kind, usd) => kind === 'withdraw' ? Math.max(.15, Math.round(usd) / 100) : 0;     // 1%, at least 15 cents
const rateTxt = () => Math.round(RATE).toLocaleString('en-US');
function openMoney(kind) { M = { kind, method: 'mtn', amt: 0 }; sheetOpen = 'money'; drawMoney(); }
function drawMoney() {
  const dep = M.kind === 'deposit', m = METHODS.find(x => x.id === M.method), chips = dep ? [50000, 100000, 500000, 1000000] : [10, 25, 50, 100];
  openSheet(`<h3>${dep ? 'Deposit funds' : 'Withdraw funds'}</h3>
  <div class="field"><label>${dep ? 'Amount you pay (UGX)' : 'Amount to withdraw (USD)'}</label><input class="input amount-big num" id="mAmt" type="number" inputmode="decimal" placeholder="0" value="${M.amt || ''}">
    <div class="chips">${chips.map(c => `<button class="chip" data-act="mchip" data-v="${c}">${dep ? (c >= 1e6 ? c / 1e6 + 'M' : c / 1e3 + 'K') : '$' + c}</button>`).join('')}${dep ? '' : '<button class="chip" data-act="mmax">Max</button>'}</div></div>
  <div class="field"><label>${dep ? 'Pay with' : 'Receive via'}</label><div class="methods">${METHODS.map(x => `<button class="method ${x.id === M.method ? 'on' : ''}" data-act="mmethod" data-v="${x.id}"><b>${x.n}</b><span>${x.d}</span></button>`).join('')}</div></div>
  ${m.f === 'phone' ? `<div class="field"><label>Mobile number</label><input class="input" id="mAcc" type="tel" value="${esc(S.profile.phone)}"></div>` : m.f === 'acct' ? `<div class="field"><label>Bank account number</label><input class="input" id="mAcc" inputmode="numeric" placeholder="Account number"></div>` : '<p class="small muted" style="margin-bottom:14px">Card details are entered on the secure checkout after you confirm.</p>'}
  <div class="summary" id="mSummary"></div><div class="err" id="mErr"></div>
  <button class="btn ${dep ? 'green' : 'red'}" data-act="mconfirm">${dep ? 'Confirm deposit' : 'Confirm withdrawal'}</button>`);
  refreshMoney();
}
function refreshMoney() {
  const box = $('#mSummary'); if (!box) return; const amt = parseFloat($('#mAmt').value) || 0; M.amt = amt;
  const row = (k, v) => `<div><span>${k}</span><span class="num">${v}</span></div>`, rate = row(`Exchange rate${RATE_LIVE ? '' : ' (virtual)'}`, `1 USD = UGX ${rateTxt()}`);
  if (M.kind === 'deposit') box.innerHTML = row('Wallet balance', fUSD(S.funds)) + rate + row('You pay', fUGX(amt)) + row('Added to your wallet', `<b>${fUSD(amt / RATE)}</b>`);
  else { const f = feeUsd('withdraw', amt); box.innerHTML = row('Wallet balance', fUSD(S.funds)) + rate + row('Fee', fUSD(f)) + row('Total debited', fUSD(amt + f)) + row('You receive', `<b>${fUGX(amt * RATE)}</b>`); }
}
function confirmMoney() {
  const dep = M.kind === 'deposit', m = METHODS.find(x => x.id === M.method), acc = ($('#mAcc')?.value || '').replace(/\s/g, ''), err = s => { $('#mErr').textContent = s; };
  const raw = parseFloat($('#mAmt').value) || 0, amt = dep ? Math.round(raw) : Math.round(raw * 100) / 100;
  if (dep && amt < MIN_DEPOSIT) return err(`Minimum deposit is ${fUGX(MIN_DEPOSIT)}.`);
  if (!dep && amt < MIN_WITHDRAW) return err(`Minimum withdrawal is ${fUSD(MIN_WITHDRAW)}.`);
  if (m.f !== 'none' && acc.length < 6) return err(m.f === 'phone' ? 'Enter a valid mobile number.' : 'Enter a valid account number.');
  const via = `${m.n}${acc ? ' · ••• ' + acc.slice(-3) : ''}`;
  let tx;
  if (dep) { const usd = amt / RATE; tx = { id: uid(), type: 'deposit', title: 'Deposit', sub: `${via} · ${fUGX(amt)} @ ${rateTxt()}`, amt: usd, ugx: amt, rate: RATE, ts: Date.now(), status: 'pending' }; }
  else { const f = feeUsd('withdraw', amt); if (amt + f > S.funds + 1e-9) return err('Insufficient wallet balance.'); S.funds -= amt + f; tx = { id: uid(), type: 'withdraw', title: 'Withdrawal', sub: `${via} · ${fUGX(amt * RATE)} @ ${rateTxt()}`, amt: -(amt + f), ugx: amt * RATE, rate: RATE, ts: Date.now(), status: 'pending' }; }
  S.tx.push(tx); save(); settle(tx.id, 3500);
  toast(dep ? 'Deposit initiated' : 'Withdrawal requested', dep ? `${fUGX(amt)} → ${fUSD(tx.amt)} · processing…` : `${fUSD(amt)} → ${fUGX(tx.ugx)} · processing…`);
  closeSheet(); M = null; refreshPage();
}
function settle(id, delay) {
  setTimeout(() => {
    const t = S.tx.find(x => x.id === id); if (!t || t.status !== 'pending') return;
    t.status = 'done'; if (t.type === 'deposit') { S.funds += t.amt; sendDepositEvent(t); } save();
    toast(t.type === 'deposit' ? 'Deposit completed' : 'Withdrawal completed', t.type === 'deposit' ? `${fUSD(t.amt)} added to your wallet` : `${fUGX(t.ugx)} sent to your account`);
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
  <p class="small muted" style="margin-top:12px;text-align:center">Prices: ${LIVE_DATA ? (feed.state === 'live' ? 'live market data' : feed.state === 'closed' ? 'market closed (last close)' : feed.state === 'error' ? 'feed unreachable' + (feed.msg ? ' (' + feed.msg + ')' : '') : 'connecting…') : 'demo feed (simulated)'}<br>Exchange rate: ${RATE_LIVE ? 'live, updated ' + hm(new Date(RATE_AT)) : 'fixed at 1 USD = UGX ' + rateTxt() + ' (virtual)'}<br>Data is stored on this device only.</p>`);
}

/* ───────────── accounts + referrals (only when CONFIG.apiUrl is set) ───────────── */
async function apiFetch(path, opt = {}) {
  let r; try { r = await fetch(API + path, { method: opt.method || 'GET', headers: Object.assign({ 'content-type': 'application/json' }, SESSION ? { Authorization: 'Bearer ' + SESSION.token } : {}), body: opt.body ? JSON.stringify(opt.body) : (opt.method === 'POST' ? '{}' : undefined) }); }
  catch (e) { const er = new Error('Can\'t reach the server. Check your internet connection.'); er.status = 0; throw er; }
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (r.status === 401 && SESSION && path !== '/login') { clearSession(); }
  if (!r.ok) { const er = new Error(j.error || 'Something went wrong. Try again.'); er.status = r.status; throw er; }
  return j;
}
function clearSession() { try { localStorage.removeItem('tradeflow.session'); history.replaceState(null, '', location.pathname); } catch (e) {} location.reload(); }
const getRef = () => { try { return localStorage.getItem('tradeflow.ref') || ''; } catch (e) { return ''; } };
let AUTH = { mode: getRef() ? 'register' : 'login', busy: false, err: '', inviter: '', f: { name: '', phone: '', pw: '', ref: getRef() } };
function showAuth() { $('#auth').classList.remove('hidden'); drawAuth(); if (AUTH.f.ref) checkInvite(); }
function drawAuth() {
  const reg = AUTH.mode === 'register', f = AUTH.f;
  $('#auth').innerHTML = `<div class="auth-card"><div class="logo">${ic('stocks')}</div><h1>${BRAND}</h1><p class="muted" style="margin-bottom:18px">${reg ? 'Create your account' : 'Welcome back'}</p>
  <div class="seg"><button class="${!reg ? 'on' : ''}" data-act="amode" data-v="login">Sign in</button><button class="${reg ? 'on' : ''}" data-act="amode" data-v="register">Create account</button></div>
  ${reg ? `<div class="field"><label>Full name</label><input class="input" id="aName" autocomplete="name" value="${esc(f.name)}"></div>` : ''}
  <div class="field"><label>Phone number</label><input class="input" id="aPhone" type="tel" autocomplete="tel" placeholder="07XX XXX XXX" value="${esc(f.phone)}"></div>
  <div class="field"><label>Password</label><input class="input" id="aPw" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="${reg ? 'At least 8 characters' : ''}" value="${esc(f.pw)}"></div>
  ${reg ? `<div class="field"><label>Referral code <span class="muted">(optional)</span></label><input class="input" id="aRef" autocapitalize="characters" placeholder="e.g. RITA123" value="${esc(f.ref)}"><div class="small" id="aInv" style="margin-top:6px;color:var(--up)">${AUTH.inviter ? 'You were invited by ' + esc(AUTH.inviter) + ' ✓' : ''}</div></div>` : ''}
  <div class="err" id="aErr">${esc(AUTH.err)}</div>
  <button class="btn" data-act="asubmit" ${AUTH.busy ? 'disabled' : ''}>${AUTH.busy ? 'Please wait…' : reg ? 'Create account' : 'Sign in'}</button>
  <p class="small muted" style="text-align:center;margin-top:14px">Practice trading with virtual money. No real funds are used.</p></div>`;
}
let invT;
function checkInvite() {
  clearTimeout(invT); const c = AUTH.f.ref.trim(); AUTH.inviter = ''; const el = $('#aInv'); if (el) el.textContent = '';
  if (c.length < 5) return;
  invT = setTimeout(async () => { try { const r = await apiFetch('/invite?code=' + encodeURIComponent(c)); if (c === AUTH.f.ref.trim()) { AUTH.inviter = r.name; const e2 = $('#aInv'); if (e2) { e2.style.color = 'var(--up)'; e2.textContent = 'You were invited by ' + r.name + ' ✓'; } } } catch (e) { const e2 = $('#aInv'); if (e2 && e.status === 404) { e2.style.color = 'var(--down)'; e2.textContent = 'This code does not exist.'; } } }, 350);
}
async function authSubmit() {
  if (AUTH.busy) return; const f = AUTH.f, reg = AUTH.mode === 'register', setErr = m => { AUTH.err = m; drawAuth(); };
  if (reg && f.name.trim().length < 2) return setErr('Enter your full name.');
  if (f.phone.replace(/\D/g, '').length < 9) return setErr('Enter a valid phone number.');
  if (reg && f.pw.length < 8) return setErr('Password must be at least 8 characters.');
  if (!f.pw) return setErr('Enter your password.');
  AUTH.busy = true; AUTH.err = ''; drawAuth();
  try {
    const r = await apiFetch(reg ? '/register' : '/login', { method: 'POST', body: reg ? { name: f.name, phone: f.phone, password: f.pw, ref: f.ref.trim() } : { phone: f.phone, password: f.pw } });
    localStorage.setItem('tradeflow.session', JSON.stringify(r)); localStorage.removeItem('tradeflow.ref'); history.replaceState(null, '', location.pathname + '#home'); location.reload();
  } catch (e) { AUTH.busy = false; setErr(e.message); }
}
async function loadReferral() {
  if (!API_MODE || !SESSION) return;
  try {
    const r = await apiFetch('/me'); REFS.all = r.all; REFS.today = r.today; REFS.l = r.levels;
    REFS.recent = r.recent.map(x => ({ name: x.name, lv: x.level, pct: x.pct, d: new Date(x.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), amt: x.amount, c: ['#3b82f6', '#a855f7', '#f59e0b'][x.level - 1] }));
    S.refEarned = r.earned; S.refBal = r.unclaimed; save();
    if (page === 'referral') { const y = window.scrollY; renderReferral(); patchLive(true); applyTheme(); window.scrollTo({ top: y }); } else patchLive(true);
  } catch (e) { /* offline: keep what we have */ }
}
function sendDepositEvent(t) {
  if (!API_MODE || !SESSION || t.ev) return;
  apiFetch('/event', { method: 'POST', body: { id: t.id, usd: t.amt } }).then(() => { t.ev = 1; save(); }).catch(e => { if (e.status === 400) { t.ev = 1; save(); } });
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
  if (p === 'referral') loadReferral();
  try { history.replaceState(null, '', '#' + p); } catch (e) {}
}
const refreshPage = () => { const y = window.scrollY; RENDER[page](); patchLive(true); applyTheme(); window.scrollTo({ top: y }); };

/* ───────────── actions (event delegation) ───────────── */
const ACT = {
  theme: () => setTheme(resolveTheme() === 'dark' ? 'light' : 'dark'),
  settheme: d => setTheme(d.v),
  deposit: () => openMoney('deposit'), withdraw: () => openMoney('withdraw'),
  gostocks: () => go('stocks', { top: true }), goperf: () => { stockTab = 'stats'; go('stocks', { top: true }); }, gofinance: () => go('finance'), goreferral: () => go('referral'),
  movers: d => { moverTab = d.v; renderHome(); patchLive(true); },
  open: d => { selSym = d.sym; pollQuotes(); if (page !== 'stocks') go('stocks', { top: true }); else { renderStocks(); $('#chartCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } },
  tf: d => { tf = d.v; $$('#tfBar button').forEach(b => b.classList.toggle('on', b.dataset.v === tf)); CH.scrub = false; drawChart(); },
  stab: d => { stockTab = d.v; $$('.seg button[data-act="stab"]').forEach(b => b.classList.toggle('on', b.dataset.v === stockTab)); renderStockList(); },
  cat: d => { cat = d.v; renderCat(); $('#catCards').scrollLeft = 0; pollQuotes(); },
  trade: d => openTrade(d.sym, d.side),
  tside: d => { T.side = d.v; drawTrade(); }, ttype: d => { T.type = d.v; drawTrade(); }, tlev: d => { T.lev = +d.v; drawTrade(); },
  tqty: d => { $('#tQty').value = d.v; T.qty = String(d.v); refreshTrade(); }, tconfirm: confirmTrade,
  tslp: d => { const a = A[T.sym]; if (live0(a)) return; T.sl = (a.price * (1 - dirSign(protDir(a)) * d.v / 100)).toFixed(a.dec); $('#tSL').value = T.sl; refreshTrade(); },
  ttpp: d => { const a = A[T.sym]; if (live0(a)) return; T.tp = (a.price * (1 + dirSign(protDir(a)) * d.v / 100)).toFixed(a.dec); $('#tTP').value = T.tp; refreshTrade(); },
  hsave: saveHoldingProtection, popen: d => openPos(d.id), psave: savePos, pclose: closePosNow,
  cancelorder: d => { S.orders = S.orders.filter(o => o.id !== d.id); save(); renderStockList(); toast('Order cancelled', 'Your limit order was removed.'); },
  mchip: d => { $('#mAmt').value = d.v; refreshMoney(); },
  mmax: () => { let mx = Math.floor(S.funds / 1.01 * 100) / 100; while (mx > 0 && mx + feeUsd('withdraw', mx) > S.funds) mx = Math.round((mx - .01) * 100) / 100; $('#mAmt').value = Math.max(0, mx); refreshMoney(); },
  mmethod: d => { const amt = $('#mAmt').value; M.method = d.v; M.amt = parseFloat(amt) || 0; drawMoney(); },
  mconfirm: confirmMoney,
  finfilter: d => { finFilter = d.v; renderFinance(); },
  amode: d => { AUTH.mode = d.v; AUTH.err = ''; drawAuth(); if (d.v === 'register' && AUTH.f.ref) checkInvite(); }, asubmit: authSubmit,
  claim: async () => {
    if (API_MODE && SESSION) {
      try { const r = await apiFetch('/claim', { method: 'POST' }); if (!(r.amount > 0)) return toast('Nothing to claim', 'No unclaimed commissions right now.', true);
        S.funds += r.amount; S.refBal = 0; S.tx.push({ id: uid(), type: 'commission', title: 'Referral payout', sub: 'Moved to wallet', amt: r.amount, ts: Date.now(), status: 'done', ev: 1 }); save();
        toast('Commissions moved', `${fUSD(r.amount)} added to your wallet`); refreshPage(); loadReferral(); }
      catch (e) { toast('Could not claim', e.message, true); }
      return;
    }
    if (S.refBal <= 0) return toast('Nothing to claim', 'No unclaimed commissions right now.', true);
    const a = S.refBal; S.funds += a; S.refBal = 0;
    S.tx.push({ id: uid(), type: 'commission', title: 'Referral payout', sub: 'Moved to wallet', amt: a, ts: Date.now(), status: 'done' }); save();
    toast('Commissions moved', `${fUSD(a)} added to your wallet`); refreshPage();
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
    if (!n) return $('#pErr').textContent = 'Name is required.'; if (e && !/^\S+@\S+\.\S+$/.test(e)) return $('#pErr').textContent = 'Enter a valid email.';
    S.profile.name = n; S.profile.email = e; S.profile.phone = ph; save(); closeSheet(); refreshPage(); toast('Profile updated', 'Your details were saved.');
  },
  savepw: () => {
    const a = $('#pw0').value, b = $('#pw1').value, c = $('#pw2').value, er = s => $('#pErr').textContent = s;
    if (!a) return er('Enter your current password.'); if (b.length < 8) return er('New password must be at least 8 characters.'); if (b !== c) return er('Passwords do not match.');
    closeSheet(); toast('Password updated', 'Use your new password next time you sign in.');
  },
  togglelive: () => { S.live = !S.live; save(); $('#liveSw')?.classList.toggle('on', S.live); patchLive(true); },
  reset: () => { try { localStorage.removeItem(STORE_KEY); } catch (e) {} const th = S.theme; S = defaults(); S.theme = th; save(); closeSheet(); refreshPage(); toast('Demo data reset', 'Balances and transactions restored.'); },
  logout: () => { if (API_MODE && SESSION) { apiFetch('/logout', { method: 'POST' }).catch(() => {}).finally(clearSession); } else $('#login').classList.remove('hidden'); },
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return; const f = ACT[t.dataset.act]; if (f) f(t.dataset, t, e);
});
document.addEventListener('input', e => {
  if (e.target.id === 'search') { q = e.target.value; const rows = $('#quoteRows'); if (rows) { const f = q.trim().toUpperCase(), list = catList(cat).filter(s => s.sym.includes(f) || s.name.toUpperCase().includes(f)); rows.innerHTML = list.map(s => stockRow(s, s.sym === selSym)).join('') || '<div class="empty">No matches</div>'; patchLive(true); } }
  if (e.target.id === 'tQty' && T) T.qty = e.target.value; if (e.target.id === 'tSL' && T) T.sl = e.target.value; if (e.target.id === 'tTP' && T) T.tp = e.target.value;
  if (['tQty', 'tLimit', 'tSL', 'tTP'].includes(e.target.id)) refreshTrade();
  if (e.target.id === 'mAmt') refreshMoney();
  const af = { aName: 'name', aPhone: 'phone', aPw: 'pw', aRef: 'ref' }[e.target.id]; if (af) { AUTH.f[af] = e.target.value; if (af === 'ref') { AUTH.f.ref = e.target.value.toUpperCase(); checkInvite(); } }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest && e.target.closest('#auth')) authSubmit(); });
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
  patchLive(false); checkOrders(); checkProtect();
  if (page === 'stocks') { drawChart(); if (stockTab === 'holdings') renderStockList(); }
  if (sheetOpen === 'trade') refreshTrade();
  if (sheetOpen === 'pos') updatePos();
}
/* ── live exchange rate ── */
async function fetchRate() {
  if (!CONFIG.liveRate) return;
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
  const must = new Set([selSym, ...Object.keys(S.holdings), ...S.positions.map(p => p.sym), ...S.orders.map(o => o.sym)]);
  [...must].slice().forEach(sy => { const a = A[sy]; if (a && (a.cat === 'majors' || a.cat === 'minors' || a.cat === 'exotic')) { const [b, qc] = a.sym.split('/'); if (b !== 'USD' && qc !== 'USD') { const h = A[qc + '/USD'] ? qc + '/USD' : A['USD/' + qc] ? 'USD/' + qc : null; if (h) must.add(h); } } });
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
if (API_MODE && !SESSION) {
  showAuth();                                   // not signed in: only the sign-in / create-account screen
} else {
  initMarket();
  fetchRate(); setInterval(fetchRate, CONFIG.fxRefreshMs);
  if (LIVE_DATA) setInterval(pollQuotes, CONFIG.pollMs);
  S.tx.filter(t => t.status === 'pending').forEach(t => settle(t.id, 2000));
  S.tx.filter(t => t.type === 'deposit' && t.status === 'done' && !t.ev).forEach(sendDepositEvent);
  applyTheme(); save();
  go((location.hash || '#home').slice(1));
  pollQuotes(); loadReferral(); setInterval(() => { if (page === 'referral' && !document.hidden) loadReferral(); }, 30000);
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__tf = { A, S: () => S, go, tick, afterTick };   // handy for debugging
})();

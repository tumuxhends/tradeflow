/* TradeFlow accounts + referral API — Cloudflare Worker with a D1 database.
   Deploy steps are in README.md next to this file.
   Endpoints: GET /health · GET /invite?code= · POST /register · POST /login · GET /me · POST /event · POST /claim */

// Websites allowed to call this API. Add your own domain here if you host the app somewhere else.
const ALLOWED_ORIGINS = ['https://tumuxhends.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000'];
const LEVEL_PCT = [10, 5, 2];                 // commission % for Level A (direct), B, C
const DAY = 864e5, SESSION_DAYS = 90, UTC_OFFSET = 3 * 3600e3;   // "today" is counted in Uganda time (UTC+3)

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const rand = n => hex(crypto.getRandomValues(new Uint8Array(n)));
async function sha(s) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
async function pbkdf2(pw, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations: 100000 }, key, 256));
}
const normPhone = p => { let d = String(p || '').replace(/\D/g, ''); if (/^0\d{9}$/.test(d)) d = '256' + d.slice(1); return d; };
/* a person's code = their first name + a number, e.g. RITA123 (a longer number is used if the short ones are taken) */
const makeCode = (name, attempt) => { const first = (name.trim().split(/\s+/)[0] || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10) || 'USER'; const n = attempt < 4 ? 100 + crypto.getRandomValues(new Uint32Array(1))[0] % 900 : 1000 + crypto.getRandomValues(new Uint32Array(1))[0] % 9000; return first + n; };

export default {
  async fetch(req, env) {
    const url = new URL(req.url), origin = req.headers.get('Origin') || '';
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response('Origin not allowed', { status: 403 });
    const cors = { 'Access-Control-Allow-Origin': origin || ALLOWED_ORIGINS[0], 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, authorization', Vary: 'Origin' };
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...cors } });
    const fail = (status, error) => json({ error }, status);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (!env.DB) return fail(500, 'Database not connected');
    const db = env.DB, now = Date.now();
    let body = {}; if (req.method === 'POST') { const raw = await req.text(); try { body = raw ? JSON.parse(raw) : {}; } catch (e) { return fail(400, 'Bad request'); } }

    const authUser = async () => {
      const m = /^Bearer (\w{20,})$/.exec(req.headers.get('Authorization') || ''); if (!m) return null;
      const s = await db.prepare('SELECT user_id, created_at FROM sessions WHERE token_hash = ?').bind(await sha(m[1])).first();
      if (!s || now - s.created_at > SESSION_DAYS * DAY) return null;
      return db.prepare('SELECT * FROM users WHERE id = ?').bind(s.user_id).first();
    };
    const startSession = async (u) => { const token = rand(32); await db.prepare('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)').bind(await sha(token), u.id, now).run(); return { token, user: { id: u.id, name: u.name, phone: u.phone, code: u.code } }; };

    if (url.pathname === '/health') return json({ ok: true });

    if (url.pathname === '/invite' && req.method === 'GET') {          // "You were invited by …" on the sign-up form
      const u = await db.prepare('SELECT name FROM users WHERE code = ?').bind((url.searchParams.get('code') || '').trim().toUpperCase()).first();
      return u ? json({ name: u.name.split(' ')[0] }) : fail(404, 'Unknown code');
    }

    if (url.pathname === '/register' && req.method === 'POST') {
      const name = String(body.name || '').trim().replace(/\s+/g, ' '), phone = normPhone(body.phone), pw = String(body.password || '');
      if (name.length < 2 || name.length > 40) return fail(400, 'Enter your full name.');
      if (phone.length < 9 || phone.length > 15) return fail(400, 'Enter a valid phone number.');
      if (pw.length < 8 || pw.length > 100) return fail(400, 'Password must be at least 8 characters.');
      let sponsor = null; const rc = String(body.ref || '').trim().toUpperCase();
      if (rc) { sponsor = await db.prepare('SELECT id FROM users WHERE code = ?').bind(rc).first(); if (!sponsor) return fail(400, 'That referral code does not exist.'); }
      if (await db.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).first()) return fail(409, 'This phone number already has an account. Sign in instead.');
      const salt = rand(16), hash = await pbkdf2(pw, salt); let id = null;
      for (let i = 0; i < 8 && !id; i++) {
        try { const r = await db.prepare('INSERT INTO users (name, phone, salt, pass_hash, code, sponsor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(name, phone, salt, hash, makeCode(name, i), sponsor ? sponsor.id : null, now).run(); id = r.meta.last_row_id; }
        catch (e) { if (!/UNIQUE/i.test(String(e.message || e))) throw e; if (/phone/i.test(String(e.message || e))) return fail(409, 'This phone number already has an account. Sign in instead.'); }
      }
      if (!id) return fail(500, 'Could not create the account. Try again.');
      return json(await startSession(await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()));
    }

    if (url.pathname === '/login' && req.method === 'POST') {
      const u = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(normPhone(body.phone)).first();
      if (!u) return fail(401, 'Wrong phone number or password.');
      if (u.locked_until > now) return fail(429, 'Too many wrong attempts. Try again in ' + Math.ceil((u.locked_until - now) / 60000) + ' minutes.');
      if (await pbkdf2(String(body.password || ''), u.salt) !== u.pass_hash) {
        const f = u.fails + 1; await db.prepare('UPDATE users SET fails = ?, locked_until = ? WHERE id = ?').bind(f >= 5 ? 0 : f, f >= 5 ? now + 10 * 60000 : 0, u.id).run();
        return fail(401, 'Wrong phone number or password.');
      }
      await db.prepare('UPDATE users SET fails = 0, locked_until = 0 WHERE id = ?').bind(u.id).run();
      return json(await startSession(u));
    }

    const me = await authUser(); if (!me) return fail(401, 'Please sign in again.');

    if (url.pathname === '/logout' && req.method === 'POST') {
      const m = /^Bearer (\w{20,})$/.exec(req.headers.get('Authorization') || ''); await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha(m[1])).run(); return json({ ok: true });
    }

    if (url.pathname === '/me' && req.method === 'GET') {
      const t0 = Math.floor((now + UTC_OFFSET) / DAY) * DAY - UTC_OFFSET, lv = [];
      const q = ['sponsor_id = ?', 'sponsor_id IN (SELECT id FROM users WHERE sponsor_id = ?)', 'sponsor_id IN (SELECT id FROM users WHERE sponsor_id IN (SELECT id FROM users WHERE sponsor_id = ?))'];
      for (const w of q) { const r = await db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS t FROM users WHERE ${w}`).bind(t0, me.id).first(); lv.push(r); }
      const earned = await db.prepare('SELECT COALESCE(SUM(amount_usd), 0) AS v FROM commissions WHERE user_id = ?').bind(me.id).first();
      const open = await db.prepare('SELECT COALESCE(SUM(amount_usd), 0) AS v FROM commissions WHERE user_id = ? AND claimed = 0').bind(me.id).first();
      const recent = await db.prepare('SELECT c.level, c.pct, c.amount_usd, c.created_at, u.name FROM commissions c JOIN users u ON u.id = c.from_user_id WHERE c.user_id = ? ORDER BY c.id DESC LIMIT 20').bind(me.id).all();
      return json({ user: { id: me.id, name: me.name, phone: me.phone, code: me.code }, levels: lv.map(x => x.n), all: lv.reduce((s, x) => s + x.n, 0), today: lv.reduce((s, x) => s + x.t, 0), earned: earned.v, unclaimed: open.v,
        recent: (recent.results || []).map(r => ({ level: r.level, pct: r.pct, amount: r.amount_usd, at: r.created_at, name: r.name })) });
    }

    if (url.pathname === '/event' && req.method === 'POST') {       // a deposit by this user → commissions up the chain
      const usd = Number(body.usd), id = String(body.id || '');
      if (!(usd > 0 && usd <= 1e6) || !/^[\w-]{4,64}$/.test(id)) return fail(400, 'Bad event');
      let cur = me.sponsor_id, n = 0;
      for (let i = 0; i < LEVEL_PCT.length && cur; i++) {
        const amt = Math.round(usd * LEVEL_PCT[i] / 100 * 1e4) / 1e4;
        const r = await db.prepare('INSERT OR IGNORE INTO commissions (user_id, from_user_id, level, pct, amount_usd, ref_event, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(cur, me.id, i + 1, LEVEL_PCT[i], amt, `${me.id}:${id}:${i + 1}`, now).run();
        n += r.meta.changes || 0;
        const up = await db.prepare('SELECT sponsor_id FROM users WHERE id = ?').bind(cur).first(); cur = up ? up.sponsor_id : null;
      }
      return json({ ok: true, credited: n });
    }

    if (url.pathname === '/claim' && req.method === 'POST') {       // atomic: marks everything claimed and returns the total once
      const r = await db.prepare('UPDATE commissions SET claimed = 1 WHERE user_id = ? AND claimed = 0 RETURNING amount_usd').bind(me.id).all();
      return json({ amount: Math.round((r.results || []).reduce((s, x) => s + x.amount_usd, 0) * 1e4) / 1e4 });
    }
    return fail(404, 'Not found');
  },
};

/**
 * auth.js n0003 관리자 인증
 * n0005/src/auth.js 기반 (관리자 전용, Stripe/고객 제외)
 */

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};
const ok  = (d, s=200)  => new Response(JSON.stringify(d), { status:s, headers:{'Content-Type':'application/json',...CORS} });
const bad = (msg, s=400) => ok({ error: msg }, s);

function sid(req) {
  const a = req.headers.get('Authorization') || '';
  return a.startsWith('Bearer ') ? a.slice(7).trim() : null;
}

/* ── PBKDF2 PASSWORD ── */
export async function hashPw(pw) {
  const enc  = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key  = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name:'PBKDF2', hash:'SHA-256', salt, iterations:100_000 }, key, 256
  );
  const h2 = b => b.toString(16).padStart(2,'0');
  return 'pbkdf2:' + [...salt].map(h2).join('') + ':' + [...new Uint8Array(bits)].map(h2).join('');
}

export async function checkPw(pw, stored) {
  if (!stored) return false;
  if (!stored.startsWith('pbkdf2:')) return pw === stored;
  const [, sHex, hHex] = stored.split(':');
  const salt = Uint8Array.from(sHex.match(/.{2}/g), h => parseInt(h,16));
  const enc  = new TextEncoder();
  const key  = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name:'PBKDF2', hash:'SHA-256', salt, iterations:100_000 }, key, 256
  );
  const attempt = [...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,'0')).join('');
  return attempt === hHex;
}

/* ── SESSION ── */
export async function newSession(DB, userId, userType, ttl) {
  const id  = crypto.randomUUID();
  const exp = new Date(Date.now() + ttl * 1000).toISOString();
  await DB.prepare('INSERT INTO sessions(id,user_id,user_type,expires_at) VALUES(?,?,?,?)')
    .bind(id, userId, userType, exp).run();
  return id;
}

export async function getSession(DB, req, wantType) {
  const id = sid(req);
  if (!id) return null;
  const s = await DB.prepare(
    "SELECT * FROM sessions WHERE id=? AND expires_at > datetime('now')"
  ).bind(id).first();
  if (!s || (wantType && s.user_type !== wantType)) return null;
  return s;
}

/* ── LOGIN (관리자 전용) ── */
export async function login(request, env) {
  const body  = await request.json().catch(() => ({}));
  const input = (body.username || '').trim().toLowerCase();
  const pw    = body.password || '';

  if (!input || !pw) return bad('Email and password required');

  const admin = await env.DB.prepare(
    'SELECT * FROM admins WHERE (email=? OR username=?) AND is_active=1'
  ).bind(input, input).first();

  if (!admin) return bad('Incorrect email or password', 401);

  const valid = await checkPw(pw, admin.password_hash);
  if (!valid) return bad('Incorrect email or password', 401);

  // 평문이었으면 해시로 업데이트
  if (!admin.password_hash.startsWith('pbkdf2:')) {
    const hash = await hashPw(pw);
    await env.DB.prepare('UPDATE admins SET password_hash=? WHERE id=?').bind(hash, admin.id).run();
  }

  const session = await newSession(env.DB, admin.id, 'admin', 86400 * 7);
  await env.DB.prepare('UPDATE admins SET last_login=? WHERE id=?')
    .bind(new Date().toISOString(), admin.id).run();

  return ok({
    success: true,
    user_type: 'admin',
    session_id: session,
    user: { id: admin.id, username: admin.username, email: admin.email, role: admin.role }
  });
}

export async function logout(request, env) {
  const id = sid(request);
  if (id) await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(id).run();
  return ok({ success: true });
}

export async function me(request, env) {
  const s = await getSession(env.DB, request, null);
  if (!s) return bad('Unauthorized', 401);

  if (s.user_type === 'admin') {
    const u = await env.DB.prepare(
      'SELECT id,username,email,role,last_login FROM admins WHERE id=?'
    ).bind(s.user_id).first();
    return ok({ user_type: 'admin', user: u });
  }

  return bad('Unauthorized', 401);
}

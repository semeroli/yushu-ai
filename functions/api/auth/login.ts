// POST /api/auth/login
// 校验凭据，成功后下发 HttpOnly 签名 Cookie。
import type { PagesFunction } from '@cloudflare/workers-types';
import {
  AuthEnv,
  verifyPassword,
  signSession,
  sessionCookie,
  jsonWithCookies,
  json,
} from '../../lib/auth';

// 简单的内存登录限流（尽力而为，防爆破）
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW = 60 * 1000;
const MAX = 10;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const s = attempts.get(ip);
  if (!s || now >= s.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW });
    return false;
  }
  s.count++;
  return s.count > MAX;
}

function clientIP(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.SESSION_SECRET) return json({ error: 'SERVER_CONFIG' }, 500);
  if (tooMany(clientIP(request))) return json({ error: 'RATE_LIMITED' }, 429);

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'INVALID_BODY' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) return json({ error: 'MISSING_FIELDS' }, 400);

  const row = await env.DB.prepare(
    'SELECT id, email, role, password_hash FROM users WHERE email = ?'
  )
    .bind(email)
    .first<{ id: string; email: string; role: 'user' | 'admin'; password_hash: string }>();
  if (!row) return json({ error: 'INVALID_CREDENTIALS' }, 401);

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return json({ error: 'INVALID_CREDENTIALS' }, 401);

  const token = await signSession(
    `${row.id}|${row.role}|${Date.now() + 7 * 864e5}`,
    env.SESSION_SECRET
  );
  return jsonWithCookies(
    { id: row.id, email: row.email, role: row.role },
    200,
    [sessionCookie(token)]
  );
};

// POST /api/auth/register
// 注册新用户；首个用户或命中 ADMIN_EMAILS 白名单的邮箱自动成为管理员。
import type { PagesFunction } from '@cloudflare/workers-types';
import {
  AuthEnv,
  hashPassword,
  signSession,
  sessionCookie,
  jsonWithCookies,
  json,
} from '../../lib/auth';

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.SESSION_SECRET) return json({ error: 'SERVER_CONFIG' }, 500);

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'INVALID_BODY' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'INVALID_EMAIL' }, 400);
  if (password.length < 8) return json({ error: 'WEAK_PASSWORD' }, 400);

  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();
  if (exists) return json({ error: 'EMAIL_TAKEN' }, 409);

  const passwordHash = await hashPassword(password);
  const id = toHex(crypto.getRandomValues(new Uint8Array(8)));

  const countRow = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first<{ c: number }>();
  const adminEmails = (env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const role: 'user' | 'admin' =
    (countRow && countRow.c === 0) || adminEmails.includes(email) ? 'admin' : 'user';

  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(id, email, passwordHash, role, Date.now())
    .run();

  // 注册成功自动登录
  const token = await signSession(`${id}|${role}|${Date.now() + 7 * 864e5}`, env.SESSION_SECRET);
  return jsonWithCookies({ id, email, role }, 201, [sessionCookie(token)]);
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 无依赖认证工具：PBKDF2 密码哈希 + HMAC 会话签名 + Cookie 读写
// 全部使用边缘运行时原生 Web Crypto，不引入任何 npm 包。
import type { D1Database } from '@cloudflare/workers-types';

export interface AuthEnv {
  DB: D1Database;
  SESSION_SECRET: string;
  ADMIN_EMAILS?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

const PBKDF2_ITERATIONS = 100000;
const SESSION_MAX_AGE = 7 * 24 * 3600; // 7 天

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 常数时间字符串比对，防计时攻击
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return `${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const chunks = saltHex.match(/.{2}/g);
  if (!chunks) return false;
  const salt = new Uint8Array(chunks.map((h) => parseInt(h, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return timingSafeEqual(toHex(new Uint8Array(bits)), hashHex);
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toHex(new Uint8Array(sig));
}

export async function signSession(payload: string, secret: string): Promise<string> {
  const sig = await hmac(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifySession(
  token: string,
  secret: string
): Promise<{ userId: string; role: string; exp: number } | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = await hmac(payload, secret);
  if (!timingSafeEqual(sig, expected)) return null;
  const [userId, role, expStr] = payload.split('|');
  const exp = Number(expStr);
  if (!userId || !role || !exp || Date.now() > exp) return null;
  return { userId, role, exp };
}

export function getCookie(request: Request, name: string): string | undefined {
  const raw = request.headers.get('Cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v ?? '');
  }
  return undefined;
}

// 返回要写进 Set-Cookie 的完整字符串（HttpOnly + Secure + SameSite=Lax）
export function sessionCookie(token: string, maxAge = SESSION_MAX_AGE): string {
  return `ys_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

const SECURE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...SECURE_HEADERS, ...extra },
  });
}

export function jsonWithCookies(
  data: unknown,
  status: number,
  cookies: string[] = []
): Response {
  const headers = new Headers(SECURE_HEADERS);
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify(data), { status, headers });
}

// 从请求 Cookie 中解析出当前登录用户（供 /me 与管理员接口复用）
export async function getCurrentUser(request: Request, env: AuthEnv): Promise<SessionUser | null> {
  const cookie = getCookie(request, 'ys_session');
  if (!cookie) return null;
  const session = await verifySession(cookie, env.SESSION_SECRET);
  if (!session) return null;
  const row = await env.DB.prepare('SELECT id, email, role FROM users WHERE id = ?')
    .bind(session.userId)
    .first<{ id: string; email: string; role: 'user' | 'admin' }>();
  return row ?? null;
}

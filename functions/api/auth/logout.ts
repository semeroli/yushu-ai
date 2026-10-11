// POST /api/auth/logout
// 清除会话 Cookie。
import type { PagesFunction } from '@cloudflare/workers-types';
import { AuthEnv, sessionCookie, jsonWithCookies } from '../../lib/auth';

export const onRequestPost: PagesFunction<AuthEnv> = async () => {
  // Max-Age=0 让浏览器立即丢弃 Cookie
  return jsonWithCookies({ ok: true }, 200, [sessionCookie('', 0)]);
};

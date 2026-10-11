// GET /api/auth/me
// 读取登录 Cookie，返回当前用户；未登录返回 401。
import type { PagesFunction } from '@cloudflare/workers-types';
import { AuthEnv, getCurrentUser, json } from '../../lib/auth';

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const user = await getCurrentUser(request, env);
  if (!user) return json({ error: 'UNAUTH' }, 401);
  return json(user);
};

// /api/auth/users —— 管理员专用
// GET   列出全部用户
// PUT   修改某用户角色 { id, role }
// DELETE 删除用户      ?id=xxx
import type { PagesFunction } from '@cloudflare/workers-types';
import { AuthEnv, getCurrentUser, json } from '../../lib/auth';

export const onRequest: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const admin = await getCurrentUser(request, env);
  if (!admin || admin.role !== 'admin') return json({ error: 'FORBIDDEN' }, 403);

  if (request.method === 'GET') {
    const res = await env.DB.prepare(
      'SELECT id, email, role, created_at FROM users ORDER BY created_at DESC'
    ).all<{ id: string; email: string; role: 'user' | 'admin'; created_at: number }>();
    return json(res.results || []);
  }

  if (request.method === 'DELETE') {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ error: 'MISSING_ID' }, 400);
    if (id === admin.id) return json({ error: 'CANNOT_DELETE_SELF' }, 400);
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  if (request.method === 'PUT') {
    const body = (await request.json().catch(() => ({}))) as { id?: string; role?: string };
    const { id, role } = body;
    if (!id || (role !== 'admin' && role !== 'user')) return json({ error: 'INVALID' }, 400);
    await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();
    return json({ ok: true });
  }

  return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
};

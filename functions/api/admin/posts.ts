/**
 * 博客管理接口（仅管理员）
 * GET    /api/admin/posts        → 列出全部文章（含草稿、含正文，供后台编辑）
 * POST   /api/admin/posts        → 新建文章
 * PUT    /api/admin/posts        → 更新文章（body 含 id）
 * DELETE /api/admin/posts?id=xxx → 删除文章
 */
import type { PagesFunction } from '@cloudflare/workers-types';
import { AuthEnv, getCurrentUser, json } from '../../lib/auth';

interface AdminPostsEnv extends AuthEnv {}

// 由标题生成基础 slug；中文保留，空格/标点转连字符
function genSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return (base || 'post') + '-' + Date.now().toString(36);
}

// 保证 slug 唯一：若冲突则追加随机后缀
async function uniqueSlug(
  db: AuthEnv['DB'],
  slug: string,
  excludeId?: string
): Promise<string> {
  let candidate = slug;
  for (let i = 0; i < 5; i++) {
    const row = await db
      .prepare('SELECT 1 FROM posts WHERE slug = ? AND id <> ?')
      .bind(candidate, excludeId || '')
      .first();
    if (!row) return candidate;
    candidate = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

export const onRequestGet: PagesFunction<AdminPostsEnv> = async ({ request, env }) => {
  const admin = await getCurrentUser(request, env);
  if (!admin || admin.role !== 'admin') return json({ error: 'FORBIDDEN' }, 403);
  try {
    const res = await env.DB.prepare('SELECT * FROM posts ORDER BY updated_at DESC').all();
    return json(res.results || [], 200);
  } catch (e: any) {
    return json({ error: 'DB_ERROR', message: String(e?.message || e) }, 500);
  }
};

export const onRequestPost: PagesFunction<AdminPostsEnv> = async ({ request, env }) => {
  const admin = await getCurrentUser(request, env);
  if (!admin || admin.role !== 'admin') return json({ error: 'FORBIDDEN' }, 403);

  const body = (await request.json().catch(() => ({}))) as any;
  const title = String(body.title || '').trim();
  if (!title) return json({ error: 'MISSING_TITLE' }, 400);

  const slug = await uniqueSlug(env.DB, String(body.slug || '').trim() || genSlug(title));
  const now = Date.now();
  const status = body.status === 'published' ? 'published' : 'draft';
  const content = String(body.content_html || '');
  const excerpt = body.excerpt ? String(body.excerpt) : null;
  const cover = body.cover_image ? String(body.cover_image) : null;
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO posts (id, slug, title, excerpt, cover_image, content_html, status, author_email, created_at, updated_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, slug, title, excerpt, cover, content, status, admin.email, now, now, status === 'published' ? now : null)
    .run();

  return json({ id, slug, status }, 201);
};

export const onRequestPut: PagesFunction<AdminPostsEnv> = async ({ request, env }) => {
  const admin = await getCurrentUser(request, env);
  if (!admin || admin.role !== 'admin') return json({ error: 'FORBIDDEN' }, 403);

  const body = (await request.json().catch(() => ({}))) as any;
  const id = String(body.id || '');
  if (!id) return json({ error: 'MISSING_ID' }, 400);

  const existing = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>();
  if (!existing) return json({ error: 'NOT_FOUND' }, 404);

  const title = body.title != null ? String(body.title).trim() : existing.title;
  if (!title) return json({ error: 'MISSING_TITLE' }, 400);

  const slug =
    body.slug != null && String(body.slug).trim()
      ? await uniqueSlug(env.DB, String(body.slug).trim(), id)
      : existing.slug;

  const status = body.status === 'published' ? 'published' : 'draft';
  const content = body.content_html != null ? String(body.content_html) : existing.content_html;
  const excerpt = body.excerpt != null ? (body.excerpt ? String(body.excerpt) : null) : existing.excerpt;
  const cover = body.cover_image != null ? (body.cover_image ? String(body.cover_image) : null) : existing.cover_image;

  const now = Date.now();
  const publishedAt = status === 'published' ? existing.published_at || now : existing.published_at;

  await env.DB.prepare(
    `UPDATE posts SET title = ?, slug = ?, excerpt = ?, cover_image = ?, content_html = ?, status = ?, updated_at = ?, published_at = ? WHERE id = ?`
  )
    .bind(title, slug, excerpt, cover, content, status, now, publishedAt, id)
    .run();

  return json({ id, slug, status }, 200);
};

export const onRequestDelete: PagesFunction<AdminPostsEnv> = async ({ request, env }) => {
  const admin = await getCurrentUser(request, env);
  if (!admin || admin.role !== 'admin') return json({ error: 'FORBIDDEN' }, 403);

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'MISSING_ID' }, 400);

  await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  return json({ ok: true }, 200);
};

export const onRequest: PagesFunction<AdminPostsEnv> = async (ctx) => {
  const method = ctx.request.method;
  if (method === 'GET') return onRequestGet(ctx);
  if (method === 'POST') return onRequestPost(ctx);
  if (method === 'PUT') return onRequestPut(ctx);
  if (method === 'DELETE') return onRequestDelete(ctx);
  return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
};

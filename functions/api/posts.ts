/**
 * 博客公开接口
 * GET /api/posts            → 已发布文章列表（摘要字段，不含正文）
 * GET /api/posts?slug=xxx   → 单篇已发布文章（含完整正文 HTML）
 */
import type { PagesFunction } from '@cloudflare/workers-types';
import { AuthEnv, json } from '../lib/auth';

interface PostsEnv extends AuthEnv {
  BUCKET?: R2Bucket;
}

export const onRequestGet: PagesFunction<PostsEnv> = async ({ request, env }) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');

  try {
    if (slug) {
      const row = await env.DB.prepare(
        `SELECT id, slug, title, excerpt, cover_image, content_html, author_email, published_at, updated_at
         FROM posts WHERE slug = ? AND status = ?`
      )
        .bind(slug, 'published')
        .first();
      if (!row) return json({ error: 'NOT_FOUND' }, 404);
      return json(row, 200);
    }

    const res = await env.DB.prepare(
      `SELECT id, slug, title, excerpt, cover_image, published_at, updated_at
       FROM posts WHERE status = ? ORDER BY published_at DESC, updated_at DESC`
    )
      .bind('published')
      .all();
    return json(res.results || [], 200);
  } catch (e: any) {
    console.error('posts GET error:', e);
    return json({ error: 'DB_ERROR', message: String(e?.message || e) }, 500);
  }
};

export const onRequest: PagesFunction<PostsEnv> = async (ctx) => {
  if (ctx.request.method === 'GET') return onRequestGet(ctx);
  return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
};

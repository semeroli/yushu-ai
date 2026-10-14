/**
 * 博客图片访问（公开）
 * GET /api/blog-media/<key>  → 从 R2 读取并返回图片字节
 * <key> 与上传时写回的 key 一致（如 blog/2026/xxxx.jpg）
 */
import type { PagesFunction } from '@cloudflare/workers-types';
import type { R2Bucket } from '@cloudflare/workers-types';
import { AuthEnv } from '../../lib/auth';

interface MediaEnv extends AuthEnv {
  BUCKET?: R2Bucket;
}

export const onRequestGet: PagesFunction<MediaEnv> = async ({ params, env }) => {
  const key = (params as any)?.key as string | undefined;
  if (!key || !env.BUCKET) return new Response('Not Found', { status: 404 });
  const obj = await env.BUCKET.get(key);
  if (!obj) return new Response('Not Found', { status: 404 });
  const ct = obj.httpMetadata?.contentType || 'application/octet-stream';
  return new Response(obj.body, {
    headers: {
      'Content-Type': ct,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};

export const onRequest: PagesFunction<MediaEnv> = async (ctx) => {
  if (ctx.request.method === 'GET') return onRequestGet(ctx);
  return new Response('Method Not Allowed', { status: 405 });
};

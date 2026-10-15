/**
 * 博客图片访问（公开）
 * GET /api/blog-media/<key>  → 从 R2 读取并返回图片字节
 *
 * ⚠️ key 只允许单层路径（R2 对象键名里的 '/' 已替换为 '-'），
 * 原因是 Cloudflare Pages 的 [[key]] 通配路由对「多级路径」的匹配不可靠：
 * 形如 /api/blog-media/blog/2026/xxx.jpg 的多级 key 会 404，
 * 只有 /api/blog-media/xxx.jpg 这种单层 key 能稳定命中。
 *
 * 上传端（/api/admin/upload）生成 key 时必须遵守此约定。
 */
import type { PagesFunction } from '@cloudflare/workers-types';
import type { R2Bucket } from '@cloudflare/workers-types';
import { AuthEnv } from '../../lib/auth';

interface MediaEnv extends AuthEnv {
  BUCKET?: R2Bucket;
}

export const onRequestGet: PagesFunction<MediaEnv> = async ({ params, env, request }) => {
  const key = (params as any)?.key as string | undefined;
  if (!key || !env.BUCKET) return new Response('Not Found', { status: 404 });

  const obj = await env.BUCKET.get(key);
  if (!obj) {
    // 诊断：R2 没有这个对象（或 R2 未绑定）时，把完整请求路径写进响应体，
    // 方便定位「路径是否被 SPA 兜底截胡」与「key 是否匹配」两类问题。
    const url = new URL(request.url);
    return new Response(
      `Not Found: key="${key}" bucket_bound=${env.BUCKET ? 'yes' : 'no'} path=${url.pathname}`,
      { status: 404 }
    );
  }
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

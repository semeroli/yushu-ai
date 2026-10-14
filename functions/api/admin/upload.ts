/**
 * 博客图片上传（仅管理员）
 * POST /api/admin/upload  (multipart/form-data, 字段名 file)
 *   → 存入 R2 绑定 BUCKET，返回站内访问地址 { url }
 * 未配置 R2 时返回 R2_NOT_CONFIGURED，提示改用「插入图片链接」。
 */
import type { PagesFunction } from '@cloudflare/workers-types';
import type { R2Bucket } from '@cloudflare/workers-types';
import { AuthEnv, getCurrentUser, json } from '../../lib/auth';

interface UploadEnv extends AuthEnv {
  BUCKET?: R2Bucket;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

export const onRequestPost: PagesFunction<UploadEnv> = async ({ request, env }) => {
  const admin = await getCurrentUser(request, env);
  if (!admin || admin.role !== 'admin') return json({ error: 'FORBIDDEN' }, 403);

  if (!env.BUCKET) {
    return json(
      {
        error: 'R2_NOT_CONFIGURED',
        message:
          '图片上传需要先配置 R2 存储桶（详见使用说明）。暂时可直接使用「插入图片链接」功能填写图片网址。',
      },
      400
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  // 运行时鸭子类型判断（兼容各环境的 File/Blob 实现）
  if (!file || typeof (file as any).arrayBuffer !== 'function') {
    return json({ error: 'NO_FILE' }, 400);
  }
  const f = file as any;
  const type: string = f.type || '';
  const size: number = f.size || 0;

  if (!ALLOWED.includes(type)) {
    return json({ error: 'BAD_TYPE', message: '仅支持 PNG / JPEG / WebP / GIF / AVIF 图片' }, 400);
  }
  if (size > MAX_BYTES) {
    return json({ error: 'TOO_LARGE', message: '图片不能超过 5MB' }, 400);
  }

  const ext = type.split('/')[1].replace('jpeg', 'jpg').replace('+xml', '');
  const key = `blog/${new Date().getFullYear()}/${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const buf = await f.arrayBuffer();
  await env.BUCKET.put(key, buf, { httpMetadata: { contentType: type } });

  return json({ url: '/api/blog-media/' + key, key }, 200);
};

export const onRequest: PagesFunction<UploadEnv> = async (ctx) => {
  if (ctx.request.method === 'POST') return onRequestPost(ctx);
  return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
};

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

  // 解析 multipart 表单。边缘环境的解析器对「文件名含中文/特殊字符」比较挑剔，
  // 可能直接抛错 → 捕获后带回诊断信息；字段名拿不到文件时再全表单扫一遍。
  let form: FormData | null = null;
  let formErr = '';
  try {
    form = await request.formData();
  } catch (e: any) {
    formErr = String(e?.message || e);
  }

  let f: any = null;
  if (form) {
    const cand: any = form.get('file');
    if (cand && typeof cand.arrayBuffer === 'function') {
      f = cand;
    } else {
      for (const v of form.values()) {
        const anyV = v as any;
        if (anyV && typeof anyV.arrayBuffer === 'function') {
          f = anyV;
          break;
        }
      }
    }
  }

  if (!f) {
    return json(
      {
        error: form ? 'NO_FILE' : 'FORM_PARSE_ERROR',
        message: form
          ? '请求里没有找到文件字段。' + (formErr ? `（解析提示：${formErr}）` : '')
          : '表单解析失败：' + (formErr || '未知原因'),
        keys: form ? Array.from(form.keys()) : [],
      },
      400
    );
  }
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

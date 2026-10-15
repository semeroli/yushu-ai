/**
 * 博客图片上传（仅管理员）
 * POST /api/admin/upload   Content-Type: application/json
 *   通道一（本地文件）：{ data: "data:image/png;base64,...." }  （前端 FileReader 读出的 dataURL）
 *   通道二（外链转存）：{ url: "https://imagebed.cc/xxx" }        （服务端拉取后存进 R2）
 *   → 存入 R2 绑定 BUCKET，返回站内访问地址 { url }
 *
 * 为什么用 JSON 而不是 multipart 表单：
 * 边缘环境对 multipart 的解析对文件名/分隔符很挑剔（实测连续 NO_FILE），
 * JSON 解析零依赖、必然稳定。5MB 图片 base64 后约 6.8MB，远低于平台请求体上限。
 *
 * 为什么支持「外链转存」：
 * 图床（如 imagebed.cc）常因失效或防盗链导致外链图片在读者浏览器里显示不出来。
 * 由服务端把图片拉回来存进 R2，文章里只引用本站 /api/blog-media/... 地址，
 * 彻底摆脱对第三方图床的依赖。
 */
import type { PagesFunction } from '@cloudflare/workers-types';
import type { R2Bucket } from '@cloudflare/workers-types';
import { AuthEnv, getCurrentUser, json } from '../../lib/auth';

interface UploadEnv extends AuthEnv {
  BUCKET?: R2Bucket;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

function genKey(type: string): string {
  const ext = type.split('/')[1].replace('jpeg', 'jpg').replace('+xml', '');
  return `blog/${new Date().getFullYear()}/${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
}

/**
 * 通道二：服务端拉取外部图片并存入 R2。
 * 必须管理员鉴权、且 R2 已配置（调用方已前置检查）。
 */
async function fetchAndStore(url: string, env: UploadEnv) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return json({ error: 'BAD_URL', message: '图片链接格式不正确' }, 400);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return json({ error: 'BAD_URL', message: '仅支持 http(s) 图片链接' }, 400);
  }

  let upstream: Response;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    upstream = await fetch(u.toString(), {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'yushu-blog-media/1.0' },
    });
    clearTimeout(timer);
  } catch {
    return json({ error: 'FETCH_FAILED', message: '无法访问该图片链接（图床失效或被防盗链拦截）' }, 400);
  }
  if (!upstream.ok) {
    return json({ error: 'FETCH_FAILED', message: '图片链接返回 ' + upstream.status }, 400);
  }
  const ct = (upstream.headers.get('content-type') || '').toLowerCase();
  if (!ct.startsWith('image/')) {
    return json({ error: 'BAD_TYPE', message: '该链接返回的不是图片（' + ct + '）' }, 400);
  }
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  if (bytes.length > MAX_BYTES) {
    return json({ error: 'TOO_LARGE', message: '图片超过 5MB' }, 400);
  }
  const key = genKey(ct);
  await env.BUCKET!.put(key, bytes, { httpMetadata: { contentType: ct } });
  return json({ url: '/api/blog-media/' + key, key }, 200);
}

export const onRequestPost: PagesFunction<UploadEnv> = async ({ request, env }) => {
  const admin = await getCurrentUser(request, env);
  if (!admin || admin.role !== 'admin') return json({ error: 'FORBIDDEN' }, 403);

  if (!env.BUCKET) {
    return json(
      {
        error: 'R2_NOT_CONFIGURED',
        message: '图片上传需要先配置 R2 存储桶（详见使用说明）。暂时可直接使用「插入图片链接」功能填写图片网址。',
      },
      400
    );
  }

  const body = (await request.json().catch(() => null)) as any;
  const dataUrl: string = String(body?.data || '');
  const extUrl: string = String(body?.url || '');

  // 通道二优先：外链转存（图床图片拉回站内）
  if (extUrl && !dataUrl) {
    return fetchAndStore(extUrl, env);
  }

  // 通道一：base64 dataURL（本地文件）
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!m) {
    return json({ error: 'NO_FILE', message: '没有收到有效的图片数据（dataURL 格式不符）' }, 400);
  }
  const type = m[1].toLowerCase();
  const b64 = m[2].replace(/\s+/g, '');

  if (!ALLOWED.includes(type)) {
    return json({ error: 'BAD_TYPE', message: '仅支持 PNG / JPEG / WebP / GIF / AVIF 图片' }, 400);
  }
  const size = Math.floor((b64.length * 3) / 4);
  if (size > MAX_BYTES) {
    return json({ error: 'TOO_LARGE', message: '图片不能超过 5MB' }, 400);
  }

  // base64 → 字节（边缘环境无 Buffer，用 atob）
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const key = genKey(type);
  await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: type } });

  return json({ url: '/api/blog-media/' + key, key }, 200);
};

export const onRequest: PagesFunction<UploadEnv> = async (ctx) => {
  if (ctx.request.method === 'POST') return onRequestPost(ctx);
  return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
};

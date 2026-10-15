/**
 * 正文外链图片批量转存（仅管理员）
 * POST /api/admin/rehost
 *   body: { html: "..." }  （正文 HTML 字符串）
 *   → 返回 { html, ok, failed, total }
 *     正文里 <img src="http(s)://..."> 的图片由服务端拉取并存进 R2，
 *     src 替换为站内 /api/blog-media/<单层key> 地址；
 *     已经是本站 /api/blog-media/ 的 src 原样保留；
 *     拉取失败的保留原地址并计入 failed。
 *
 * 为什么要这个接口：
 * 早期文章正文里插入的是图床外链（如 imagebed.cc），那些图在读者浏览器里加载失败。
 * 编辑现有文章时点「一键转存正文图片」，本接口把所有外链图片批量拉回 R2，
 * 再把替换后的 html 写回文章，彻底摆脱对第三方图床的依赖。
 */
import type { PagesFunction } from '@cloudflare/workers-types';
import type { R2Bucket } from '@cloudflare/workers-types';
import { AuthEnv, getCurrentUser, json } from '../../lib/auth';

interface RehostEnv extends AuthEnv {
  BUCKET?: R2Bucket;
}

const MAX_BYTES = 5 * 1024 * 1024;

function genKey(type: string): string {
  const ext = type.split('/')[1].replace('jpeg', 'jpg').replace('+xml', '');
  return `blog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

/** 拉取外链图片 → R2，成功返回站内地址，失败返回 null（不抛错） */
async function fetchOne(url: string, bucket: R2Bucket): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

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
    return null;
  }
  if (!upstream.ok) return null;
  const ct = (upstream.headers.get('content-type') || '').toLowerCase();
  if (!ct.startsWith('image/')) return null;
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  if (bytes.length > MAX_BYTES) return null;

  const key = genKey(ct);
  await bucket.put(key, bytes, { httpMetadata: { contentType: ct } });
  return '/api/blog-media/' + key;
}

export const onRequestPost: PagesFunction<RehostEnv> = async ({ request, env }) => {
  const admin = await getCurrentUser(request, env);
  if (!admin || admin.role !== 'admin') return json({ error: 'FORBIDDEN' }, 403);

  if (!env.BUCKET) {
    return json(
      { error: 'R2_NOT_CONFIGURED', message: '转存图片需要先配置 R2 存储桶' },
      400
    );
  }

  const body = (await request.json().catch(() => null)) as any;
  const html: string = String(body?.html || '');
  if (!html) return json({ error: 'NO_HTML', message: '没有收到正文内容' }, 400);

  // 找出所有 <img> 的 src（支持单/双引号、src 前后有其他属性）
  const srcRe = /<img([^>]*?)\ssrc=("([^"]*)"|'([^']*)')/gi;
  const matches: Array<{ full: string; src: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = srcRe.exec(html)) !== null) {
    const src = m[3] ?? m[4] ?? '';
    matches.push({ full: m[0], src });
  }

  let total = 0;
  let ok = 0;
  let failed: string[] = [];
  let next = html;

  for (const { src } of matches) {
    if (!src) continue;
    // 本站地址 / dataURL 跳过
    if (src.startsWith('/api/blog-media/') || src.startsWith('data:') || src.startsWith('blob:')) {
      continue;
    }
    if (!/^https?:\/\//i.test(src)) continue;
    total++;
    const localUrl = await fetchOne(src, env.BUCKET);
    if (localUrl) {
      // 替换该 src 的所有出现（同图可能被引用多次）
      next = next.split(src).join(localUrl);
      ok++;
    } else {
      failed.push(src);
    }
  }

  return json({ html: next, total, ok, failed }, 200);
};

export const onRequest: PagesFunction<RehostEnv> = async (ctx) => {
  if (ctx.request.method === 'POST') return onRequestPost(ctx);
  return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
};

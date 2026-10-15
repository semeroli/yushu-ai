/**
 * 博客 R2 图片管理（仅管理员）
 * GET    /api/admin/blog-images          → 列出 R2 桶里所有对象，标注「被哪篇文章引用 / 未引用」
 * DELETE /api/admin/blog-images?keys=a,b → 批量删除指定对象
 *
 * 为什么要有这个接口：
 * 每次上传图片都会生成新 key 写入 R2；用户在编辑器里删掉某张图，
 * 只是把正文里指向它的 <img> 标签删了，**R2 里那个对象不会自动清理**。
 * 桶会慢慢积累"孤儿对象"（未被任何文章引用的图片），浪费存储、干扰视线。
 * 本接口提供两个能力：
 *  1. 列出桶里所有对象，并和所有文章的正文/封面做交叉引用检查，标出"未引用"。
 *  2. 批量删除指定 key，一键清理孤儿。
 */
import type { PagesFunction } from '@cloudflare/workers-types';
import type { R2Bucket, R2Object } from '@cloudflare/workers-types';
import { AuthEnv, getCurrentUser, json } from '../../lib/auth';

interface ImagesEnv extends AuthEnv {
  BUCKET?: R2Bucket;
}

export interface ImageInfo {
  key: string;
  size: number;
  last_modified: string;
  ref_count: number;
  refs: string[]; // 被哪些文章引用（slug）
}

export const onRequestGet: PagesFunction<ImagesEnv> = async ({ request, env }) => {
  const admin = await getCurrentUser(request, env);
  if (!admin || admin.role !== 'admin') return json({ error: 'FORBIDDEN' }, 403);

  if (!env.BUCKET) {
    return json({ error: 'R2_NOT_CONFIGURED', message: 'R2 未配置' }, 400);
  }

  // 列出桶里所有对象。R2 的 list() 返回迭代器，每次 yield 一个 { objects, truncated, ... }
  // 分页游标；桶里对象数 < 1000 时一次就拿到，但循环写法对未来扩展兼容。
  const full: R2Object[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 10; i++) { // 最多 10000 个对象，超出停止
    const batch = await env.BUCKET.list({ limit: 1000, cursor });
    for (const o of batch.objects) full.push(o);
    if (!batch.truncated) break;
    cursor = batch.cursor;
  }

  // 拉取所有文章的 cover_image + 正文里出现的 /api/blog-media/xxx key
  const postsRes = await env.DB
    .prepare('SELECT id, slug, cover_image, content_html FROM posts')
    .all();
  const posts = postsRes.results || [];

  // key → 引用的 slug 列表
  const keyToRefs = new Map<string, string[]>();
  for (const p of posts) {
    const refs = new Set<string>();
    // 封面图
    if (p.cover_image && String(p.cover_image).startsWith('/api/blog-media/')) {
      const k = String(p.cover_image).replace(/^\/api\/blog-media\//, '');
      refs.add(k);
    }
    // 正文里的 <img src>
    const content = String(p.content_html || '');
    const srcRe = /<img[^>]+src=(?:"([^"]+)"|'([^']+)')/gi;
    let m: RegExpExecArray | null;
    while ((m = srcRe.exec(content)) !== null) {
      const src = m[1] ?? m[2] ?? '';
      if (src.startsWith('/api/blog-media/')) {
        refs.add(src.replace(/^\/api\/blog-media\//, ''));
      }
    }
    for (const k of refs) {
      if (!keyToRefs.has(k)) keyToRefs.set(k, []);
      keyToRefs.get(k)!.push(p.slug || '(未命名)');
    }
  }

  const items: ImageInfo[] = full.map((o) => {
    const refs = keyToRefs.get(o.key) || [];
    return {
      key: o.key,
      size: o.size,
      last_modified: o.uploaded,
      ref_count: refs.length,
      refs,
    };
  });

  return json({
    count: items.length,
    total_bytes: items.reduce((s, i) => s + i.size, 0),
    orphan_bytes: items.filter((i) => i.ref_count === 0).reduce((s, i) => s + i.size, 0),
    items,
  }, 200);
};

export const onRequestDelete: PagesFunction<ImagesEnv> = async ({ request, env }) => {
  const admin = await getCurrentUser(request, env);
  if (!admin || admin.role !== 'admin') return json({ error: 'FORBIDDEN' }, 403);

  if (!env.BUCKET) {
    return json({ error: 'R2_NOT_CONFIGURED', message: 'R2 未配置' }, 400);
  }

  const keys = new URL(request.url)
    .searchParams.get('keys')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) || [];
  if (!keys.length) return json({ error: 'NO_KEYS', message: '未提供要删除的 keys' }, 400);

  // 安全护栏：只允许删「未被任何文章引用」的 key，避免误删正在被使用的图
  const postsRes = await env.DB
    .prepare('SELECT slug, cover_image, content_html FROM posts')
    .all();
  const posts = postsRes.results || [];
  const used = new Set<string>();
  for (const p of posts) {
    if (p.cover_image && String(p.cover_image).startsWith('/api/blog-media/')) {
      used.add(String(p.cover_image).replace(/^\/api\/blog-media\//, ''));
    }
    const content = String(p.content_html || '');
    const srcRe = /<img[^>]+src=(?:"([^"]+)"|'([^']+)')/gi;
    let m: RegExpExecArray | null;
    while ((m = srcRe.exec(content)) !== null) {
      const src = m[1] ?? m[2] ?? '';
      if (src.startsWith('/api/blog-media/')) used.add(src.replace(/^\/api\/blog-media\//, ''));
    }
  }

  const safeKeys = keys.filter((k) => !used.has(k));
  const skipped = keys.filter((k) => used.has(k));

  for (const k of safeKeys) {
    await env.BUCKET.delete(k);
  }

  return json({
    deleted: safeKeys.length,
    deleted_keys: safeKeys,
    skipped: skipped,
    skipped_reason: '这些 key 仍被文章正文/封面引用，跳过删除以避免破坏文章',
  }, 200);
};

export const onRequest: PagesFunction<ImagesEnv> = async (ctx) => {
  const m = ctx.request.method;
  if (m === 'GET') return onRequestGet(ctx);
  if (m === 'DELETE') return onRequestDelete(ctx);
  return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
};

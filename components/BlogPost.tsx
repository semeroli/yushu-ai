import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, User } from 'lucide-react';

interface PostFull {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  content_html: string;
  author_email: string | null;
  published_at: number | null;
  updated_at: number;
}

export const BlogPost: React.FC<{ slug: string | null }> = ({ slug }) => {
  const [post, setPost] = useState<PostFull | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!slug) {
      setErr('缺少文章标识');
      setBusy(false);
      return;
    }
    setBusy(true);
    fetch('/api/posts?slug=' + encodeURIComponent(slug))
      .then((r) => (r.ok ? r.json() : Promise.reject('HTTP ' + r.status)))
      .then((d) => setPost(d && d.id ? d : null))
      .catch((e) => setErr('文章加载失败：' + String(e)))
      .finally(() => setBusy(false));
  }, [slug]);

  const back = () => {
    window.location.hash = '#blog';
  };

  const fmt = (ts: number | null) =>
    ts ? new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  if (busy)
    return (
      <section className="pt-32 pb-20 px-6 text-center text-link/40 dark:text-white/40">加载中…</section>
    );

  if (err || !post)
    return (
      <section className="pt-32 pb-20 px-6 max-w-3xl mx-auto text-center">
        <p className="text-red-500 mb-6">{err || '未找到该文章'}</p>
        <button
          onClick={back}
          className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> 返回博客列表
        </button>
      </section>
    );

  return (
    <article className="pt-28 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={back}
          className="inline-flex items-center gap-2 text-sm text-link/50 dark:text-white/50 hover:text-emerald-600 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> 返回博客列表
        </button>

        {post.cover_image && (
          <img
            src={post.cover_image}
            alt={post.title}
            className="w-full aspect-[16/9] object-cover rounded-2xl mb-8 border border-black/10 dark:border-white/10"
          />
        )}

        <h1 className="text-3xl md:text-5xl font-extrabold serif-zh leading-tight mb-4">{post.title}</h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-link/50 dark:text-white/50 mb-8 pb-6 border-b border-black/10 dark:border-white/10">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" /> {fmt(post.published_at)}
          </span>
          {post.author_email && (
            <span className="inline-flex items-center gap-1.5">
              <User className="w-4 h-4" /> {post.author_email}
            </span>
          )}
        </div>

        {/* 正文：管理员编写的 HTML，直接渲染 */}
        <div
          className="article-content max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
        />
      </div>
    </article>
  );
};

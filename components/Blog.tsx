import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MotionDiv } from '../lib/motion';
import { FileText, ArrowRight, ImageOff, PenLine, Newspaper } from 'lucide-react';

interface PostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  published_at: number | null;
  updated_at: number;
}

export const Blog: React.FC = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setBusy(true);
    fetch('/api/posts')
      .then((r) => (r.ok ? r.json() : Promise.reject('HTTP ' + r.status)))
      .then((d) => setPosts(Array.isArray(d) ? d : []))
      .catch((e) => setErr('文章加载失败：' + String(e)))
      .finally(() => setBusy(false));
  }, []);

  const fmt = (ts: number | null) =>
    ts ? new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  const go = (slug: string) => {
    window.location.hash = '#post/' + encodeURIComponent(slug);
  };
  const goAdmin = () => {
    window.location.hash = '#admin';
  };

  return (
    <section className="pt-28 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold serif-zh mb-2">博客 · 教学札记</h1>
            <p className="text-link/50 dark:text-white/50">语文教学的思考、案例与资源分享</p>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={goAdmin}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
            >
              <PenLine className="w-4 h-4" /> 写文章
            </button>
          )}
        </div>

        {busy && <p className="text-link/40 dark:text-white/40 py-12 text-center">加载中…</p>}
        {err && <p className="text-red-500 py-12 text-center">{err}</p>}

        {!busy && !err && posts.length === 0 && (
          <div className="py-20 text-center text-link/40 dark:text-white/40">
            <Newspaper className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p>还没有发布的文章。</p>
            {user?.role === 'admin' && (
              <button onClick={goAdmin} className="mt-4 text-emerald-600 font-medium hover:underline">
                去后台发布第一篇 →
              </button>
            )}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {posts.map((p, i) => (
            <MotionDiv
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              onClick={() => go(p.slug)}
              className="group cursor-pointer rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden bg-white/50 dark:bg-white/[0.03] hover:shadow-xl transition-all hover:-translate-y-1"
            >
              <div className="aspect-[16/9] bg-black/5 dark:bg-white/5 flex items-center justify-center overflow-hidden">
                {p.cover_image ? (
                  <img
                    src={p.cover_image}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <ImageOff className="w-10 h-10 text-link/20 dark:text-white/20" />
                )}
              </div>
              <div className="p-5">
                <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">
                  {fmt(p.published_at)}
                </div>
                <h2 className="text-xl font-bold mb-2 line-clamp-2 serif-zh group-hover:text-emerald-600 transition-colors">
                  {p.title}
                </h2>
                <p className="text-link/60 dark:text-white/60 text-sm line-clamp-3">
                  {p.excerpt || '（暂无摘要）'}
                </p>
                <div className="mt-4 flex items-center text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                  阅读全文 <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { useAuth } from '../contexts/AuthContext';
import { MarkdownModal } from './MarkdownModal';
import {
  Plus, Pencil, Trash2, Save, Eye, EyeOff, ArrowLeft, Loader2, FileText,
  Bold, Italic, Underline, Heading2, Heading3, List, ListOrdered, Link2, ImagePlus, Download, Folder,
  CheckCircle2, X, ExternalLink, FileCode,
} from 'lucide-react';

interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  content_html: string;
  status: string;
  author_email: string | null;
  created_at: number;
  updated_at: number;
  published_at: number | null;
}

interface FormState {
  id: string | null;
  slug: string;
  title: string;
  excerpt: string;
  cover_image: string;
  content_html: string;
  status: 'draft' | 'published';
}

const EMPTY: FormState = {
  id: null, slug: '', title: '', excerpt: '', cover_image: '', content_html: '', status: 'draft',
};

export interface BlogImageInfo {
  key: string;
  size: number;
  last_modified: string;
  ref_count: number;
  refs: string[];
}

export const BlogAdmin: React.FC = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [images, setImages] = useState<BlogImageInfo[] | null>(null);
  const [imagesBusy, setImagesBusy] = useState(false);
  const [mdModalOpen, setMdModalOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [editingView, setEditingView] = useState<'edit' | 'split' | 'preview'>('split');
  const [previewHtml, setPreviewHtml] = useState('');

  const load = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/admin/posts');
      if (!r.ok) setMsg('加载失败：' + r.status);
      else setPosts(await r.json());
    } catch {
      setMsg('网络错误');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 把正文灌进编辑器。必须放在所有「提前 return」之前（React Hooks 规则：
  // 每次渲染 Hook 数量要一致，否则切换视图时整页崩溃白屏）。
  // 用 ref 记录"已为哪篇文章灌过内容"，只在切换编辑目标时灌一次，
  // 避免打字过程中被重置。
  const editorInitRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editing) {
      editorInitRef.current = null;
      return;
    }
    const key = editing.id ?? '__new__';
    if (editorInitRef.current !== key && editorRef.current) {
      editorRef.current.innerHTML = editing.content_html || '';
      editorInitRef.current = key;
      setPreviewHtml(editing.content_html || '');
    }
  });

  if (!user || user.role !== 'admin') return null;

  // ============ 列表视图 ============
  if (!editing) {
    return (
      <section className="py-28 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-emerald-500" />
            <h2 className="text-2xl md:text-3xl font-bold">博客文章管理</h2>
            <button
              onClick={load}
              disabled={busy}
              className="ml-auto px-3 py-1.5 text-sm rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 transition-colors"
            >
              刷新
            </button>
            <button
              onClick={async () => {
                setShowImages(true);
                setImagesBusy(true);
                try {
                  const r = await fetch('/api/admin/blog-images');
                  const d = await r.json().catch(() => ({}));
                  if (r.ok && d.items) setImages(d.items as BlogImageInfo[]);
                  else setMsg('图片总览加载失败：' + (d.message || d.error || r.status));
                } catch {
                  setMsg('图片总览网络错误');
                } finally {
                  setImagesBusy(false);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 transition-colors"
            >
              <Folder className="w-4 h-4" /> 图片总览
            </button>
            <button
              onClick={() => setEditing({ ...EMPTY })}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
            >
              <Plus className="w-4 h-4" /> 新建文章
            </button>
          </div>

          {msg && <p className="text-sm text-red-500 mb-4">{msg}</p>}
          {busy && <p className="text-link/40 dark:text-white/40 py-12 text-center">加载中…</p>}

          <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/5 text-link/60 dark:text-white/60">
                <tr>
                  <th className="text-left p-3 font-medium">标题</th>
                  <th className="text-left p-3 font-medium">状态</th>
                  <th className="text-left p-3 font-medium">更新时间</th>
                  <th className="text-right p-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-t border-black/5 dark:border-white/5">
                    <td className="p-3">
                      <div className="font-medium text-link dark:text-white line-clamp-1">{p.title}</div>
                      <div className="text-xs text-link/40 dark:text-white/40">/{p.slug}</div>
                    </td>
                    <td className="p-3">
                      {p.status === 'published' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                          <Eye className="w-3.5 h-3.5" /> 已发布
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-link/40 dark:text-white/40 text-xs font-medium">
                          <EyeOff className="w-3.5 h-3.5" /> 草稿
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-link/50 dark:text-white/50">
                      {new Date(p.updated_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {p.status === 'published' && (
                        <a
                          href={'#post/' + encodeURIComponent(p.slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-link/50 dark:text-white/50 hover:text-emerald-600 transition-colors"
                          title="查看"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await fetch('/api/admin/posts', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: p.id, status: p.status === 'published' ? 'draft' : 'published' }),
                            });
                          } finally {
                            setBusy(false);
                          }
                          load();
                        }}
                        className="p-2 text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title={p.status === 'published' ? '下架（改回草稿）' : '发布'}
                      >
                        {p.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() =>
                          setEditing({
                            id: p.id, slug: p.slug, title: p.title,
                            excerpt: p.excerpt || '', cover_image: p.cover_image || '',
                            content_html: p.content_html, status: p.status as any,
                          })
                        }
                        className="p-2 text-link/60 dark:text-white/60 hover:text-emerald-600 transition-colors"
                        title="编辑"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('确定删除《' + p.title + '》？此操作不可恢复。')) return;
                          setBusy(true);
                          await fetch('/api/admin/posts?id=' + encodeURIComponent(p.id), { method: 'DELETE' });
                          setBusy(false);
                          load();
                        }}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {posts.length === 0 && !busy && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-link/40 dark:text-white/40">
                      还没有文章，点击右上角「新建文章」开始写作。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* R2 图片总览面板（可选折叠） */}
          {showImages && (
            <div className="mt-8 rounded-2xl border border-black/10 dark:border-white/10 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Folder className="w-4 h-4 text-emerald-500" />
                <h3 className="text-lg font-semibold">R2 图片总览</h3>
                <span className="text-xs text-link/40 dark:text-white/40">
                  桶里所有对象 + 是否被文章引用（「未引用」即编辑器里已删但桶里仍残留的孤儿文件）
                </span>
                <button
                  onClick={() => {
                    setImagesBusy(true);
                    fetch('/api/admin/blog-images')
                      .then((r) => r.json())
                      .then((d) => {
                        if (d.items) setImages(d.items as BlogImageInfo[]);
                      })
                      .finally(() => setImagesBusy(false));
                  }}
                  className="ml-auto px-3 py-1.5 text-xs rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 transition-colors"
                >
                  刷新
                </button>
                <button
                  onClick={async () => {
                    const orphans = (images || []).filter((i) => i.ref_count === 0);
                    if (!orphans.length) {
                      setMsg('没有未引用的图片可清理');
                      return;
                    }
                    if (!confirm('清理 ' + orphans.length + ' 个未引用图片？（已引用的对象不会动）')) return;
                    setImagesBusy(true);
                    try {
                      const keys = orphans.map((i) => i.key).join(',');
                      const r = await fetch('/api/admin/blog-images?keys=' + encodeURIComponent(keys), {
                        method: 'DELETE',
                      });
                      const d = await r.json().catch(() => ({}));
                      if (r.ok) {
                        setMsg(
                          '已清理 ' + d.deleted + ' 个未引用图片' +
                          (d.skipped?.length ? '（' + d.skipped.length + ' 个被文章引用，跳过）' : '')
                        );
                        const rr = await fetch('/api/admin/blog-images');
                        const dd = await rr.json();
                        if (dd.items) setImages(dd.items as BlogImageInfo[]);
                      } else {
                        setMsg('清理失败：' + (d.message || d.error || r.status));
                      }
                    } finally {
                      setImagesBusy(false);
                    }
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  disabled={imagesBusy}
                >
                  <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                  清理未引用
                </button>
              </div>

              {imagesBusy && <p className="text-xs text-link/40 dark:text-white/40 py-4 text-center">加载中…</p>}

              {!imagesBusy && images && (
                <>
                  <p className="text-xs text-link/50 dark:text-white/50 mb-2">
                    共 {images.length} 个对象 · 未引用 {images.filter((i) => i.ref_count === 0).length} 个 ·
                    已引用 {images.filter((i) => i.ref_count > 0).length} 个
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
                    <table className="w-full text-sm">
                      <thead className="bg-black/5 dark:bg-white/5 text-link/60 dark:text-white/60">
                        <tr>
                          <th className="text-left p-2.5 font-medium">对象键名</th>
                          <th className="text-left p-2.5 font-medium">大小</th>
                          <th className="text-left p-2.5 font-medium">最后修改</th>
                          <th className="text-left p-2.5 font-medium">引用</th>
                        </tr>
                      </thead>
                      <tbody>
                        {images.map((i) => (
                          <tr key={i.key} className="border-t border-black/5 dark:border-white/5">
                            <td className="p-2.5 font-mono text-xs break-all max-w-[360px]">{i.key}</td>
                            <td className="p-2.5 text-xs whitespace-nowrap">{(i.size / 1024).toFixed(1)} KB</td>
                            <td className="p-2.5 text-xs text-link/50 dark:text-white/50 whitespace-nowrap">
                              {new Date(i.last_modified).toLocaleString('zh-CN')}
                            </td>
                            <td className="p-2.5">
                              {i.ref_count > 0 ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {i.ref_count} 处引用
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-link/40 dark:text-white/40 text-xs">
                                  <X className="w-3.5 h-3.5" /> 未引用
                                </span>
                              )}
                              {i.refs.length > 0 && (
                                <div className="text-[11px] text-link/40 dark:text-white/40 mt-1">
                                  {i.refs.join(', ')}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  // ============ 编辑视图 ============
  const f = editing;

  const setField = (k: keyof FormState, v: any) => setEditing({ ...f, [k]: v });

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  // 把文件读成 dataURL，再走 JSON 通道发给后端。
  // 这样做彻底绕开了边缘环境对 multipart 表单解析不稳定的问题（之前反复报 NO_FILE）。
  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('read-failed'));
      reader.readAsDataURL(file);
    });

  const uploadToR2 = async (payload: { data?: string; url?: string }, setLoading: (b: boolean) => void) => {
    setLoading(true);
    setMsg('');
    try {
      const r = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(d.message || d.error || '上传失败');
        return null;
      }
      return d.url as string;
    } catch {
      setMsg('上传网络错误');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File, asCover: boolean) => {
    const setLoading = asCover ? setCoverUploading : setImgUploading;
    try {
      const dataUrl = await fileToDataUrl(file);
      return await uploadToR2({ data: dataUrl }, setLoading);
    } catch {
      setLoading(false);
      setMsg('读取文件失败');
      return null;
    }
  };

  const onPickContentImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = await uploadImage(file, false);
    if (url) {
      editorRef.current?.focus();
      document.execCommand('insertImage', false, url);
    }
  };

  const onPickCoverImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = await uploadImage(file, true);
    if (url) setField('cover_image', url);
  };

  const insertImageByUrl = async () => {
    const url = window.prompt('请输入图片网址（http(s)://...）');
    if (!url) return;
    // 先尝试把外链转存到本站 R2：这样即便图床失效 / 有防盗链，读者也能正常看到图片。
    // 转存失败时退化为直接插入外链（至少还能显示就显示）。
    setImgUploading(true);
    try {
      const r = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const d = await r.json().catch(() => ({}));
      const finalUrl = r.ok && d.url ? d.url : url;
      editorRef.current?.focus();
      document.execCommand('insertImage', false, finalUrl);
      setMsg(r.ok && d.url ? '外链图片已转存到站内 ✓' : '外链图片直接引用（转存失败，已按原样插入）');
    } catch {
      editorRef.current?.focus();
      document.execCommand('insertImage', false, url);
    } finally {
      setImgUploading(false);
    }
  };

  const insertLink = () => {
    const url = window.prompt('请输入链接网址');
    if (!url) return;
    exec('createLink', url);
  };

  // 把正文里所有外链图片（http(s) 开头且非本站 /api/blog-media/）批量转存到 R2
  const rehostContentImages = async () => {
    const html = editorRef.current?.innerHTML || '';
    const imgs = html.match(/<img[^>]+src=(?:"[^"]+"|'[^']+')/gi) || [];
    const external = imgs.filter((tag) => {
      const m = tag.match(/src=(?:"([^"]+)"|'([^']+)')/i);
      const src = m?.[1] ?? m?.[2] ?? '';
      return /^https?:\/\//.test(src) && !src.startsWith('/api/blog-media/') && !src.includes(window.location.origin);
    });
    if (external.length === 0) {
      setMsg('正文里没有需要转存的外链图片');
      return;
    }
    if (!confirm('把正文里 ' + external.length + ' 张外链图片拉回本站存储？（完成后记得点「保存」写回文章）')) return;
    setMsg('正在转存 ' + external.length + ' 张外链图片…');
    try {
      const r = await fetch('/api/admin/rehost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg('转存失败：' + (d.message || d.error || r.status));
        return;
      }
      // 把转存后的 HTML 写回编辑器与预览（innerHTML 整体替换，光标位置会丢，可接受）
      if (editorRef.current) {
        editorRef.current.innerHTML = d.html;
        setPreviewHtml(d.html);
      }
      setMsg(
        '已转存 ' + d.ok + '/' + d.total + ' 张外链图片' +
        (d.failed?.length ? '（' + d.failed.length + ' 张拉取失败，已保留原链接）' : '') +
        ' — 请点「保存」写回文章'
      );
    } catch {
      setMsg('转存网络错误');
    }
  };

  const save = async () => {
    if (!f.title.trim()) {
      setMsg('请填写标题');
      return;
    }
    const payload = {
      id: f.id, slug: f.slug, title: f.title, excerpt: f.excerpt,
      cover_image: f.cover_image, content_html: editorRef.current?.innerHTML || '', status: f.status,
    };
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/admin/posts', {
        method: f.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg('保存失败：' + (d.error || r.status));
      } else {
        setMsg('已保存 ✓');
        setTimeout(() => setEditing(null), 700);
        load();
      }
    } catch {
      setMsg('网络错误');
    } finally {
      setBusy(false);
    }
  };

  const ToolBtn: React.FC<{ onClick: () => void; title: string; children: React.ReactNode; active?: boolean }> = ({
    onClick, title, children,
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="p-2 rounded-lg text-link/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
    >
      {children}
    </button>
  );

  return (
    <section className="py-28 md:py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setEditing(null)}
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="返回列表"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold">{f.id ? '编辑文章' : '新建文章'}</h2>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setField('status', f.status === 'published' ? 'draft' : 'published')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                f.status === 'published'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-black/15 dark:border-white/15 text-link/60 dark:text-white/60'
              }`}
            >
              {f.status === 'published' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {f.status === 'published' ? '已发布' : '草稿'}
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存
            </button>
          </div>
        </div>

        {msg && (
          <p className={`text-sm mb-4 ${msg.includes('失败') || msg.includes('错误') ? 'text-red-500' : 'text-emerald-600'}`}>
            {msg}
          </p>
        )}

        <div className="space-y-4">
          <input
            value={f.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="文章标题"
            className="w-full text-2xl font-bold bg-transparent border-b-2 border-black/10 dark:border-white/10 focus:border-emerald-500 outline-none py-2 px-1"
          />
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-link/50 dark:text-white/50">自定义链接（英文/数字，留空自动生成）</label>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-link/40 dark:text-white/40 text-sm">/post/</span>
                <input
                  value={f.slug}
                  onChange={(e) => setField('slug', e.target.value)}
                  placeholder="my-article"
                  className="flex-1 bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-link/50 dark:text-white/50">封面图</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  value={f.cover_image}
                  onChange={(e) => setField('cover_image', e.target.value)}
                  placeholder="封面图片网址（可上传）"
                  className="flex-1 bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                />
                {/^https?:\/\//.test(f.cover_image) && !f.cover_image.includes('/api/blog-media/') && (
                  <button
                    type="button"
                    disabled={coverUploading}
                    onClick={async () => {
                      const url = await uploadToR2({ url: f.cover_image }, setCoverUploading);
                      if (url) {
                        setField('cover_image', url);
                        setMsg('封面外链已转存到站内 ✓');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 text-sm hover:bg-emerald-600/20 transition-colors disabled:opacity-50"
                    title="把外链图片拉回本站存储，彻底解决图床失效/防盗链导致的裂图"
                  >
                    {coverUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : '转存'}
                  </button>
                )}
                <label className="relative cursor-pointer px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-sm hover:bg-black/10 transition-colors">
                  {coverUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : '上传'}
                  <input type="file" accept="image/*" className="hidden" onChange={onPickCoverImage} />
                </label>
              </div>
              {f.cover_image && (
                <img src={f.cover_image} alt="封面预览" className="mt-2 h-20 rounded-lg object-cover border border-black/10 dark:border-white/10" />
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-link/50 dark:text-white/50">摘要（列表页显示，可留空）</label>
            <textarea
              value={f.excerpt}
              onChange={(e) => setField('excerpt', e.target.value)}
              rows={2}
              className="w-full mt-1 bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* 视图切换：编辑 / 分屏 / 预览 */}
          <div className="flex items-center gap-1 mb-2">
            {(['edit', 'split', 'preview'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setEditingView(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  editingView === v
                    ? 'bg-emerald-600 text-white'
                    : 'bg-black/5 dark:bg-white/10 text-link/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/20'
                }`}
              >
                {v === 'edit' ? '编辑' : v === 'split' ? '分屏预览' : '预览'}
              </button>
            ))}
            <span className="ml-2 text-xs text-link/40 dark:text-white/40">右侧/预览区随输入实时更新</span>
          </div>

          {/* 工具栏（始终在顶部，横跨） */}
          <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] sticky top-16 z-20 mb-3">
            <ToolBtn onClick={() => exec('bold')} title="加粗"><Bold className="w-4 h-4" /></ToolBtn>
            <ToolBtn onClick={() => exec('italic')} title="斜体"><Italic className="w-4 h-4" /></ToolBtn>
            <ToolBtn onClick={() => exec('underline')} title="下划线"><Underline className="w-4 h-4" /></ToolBtn>
            <span className="w-px h-5 bg-black/10 dark:bg-white/10 mx-1" />
            <ToolBtn onClick={() => exec('formatBlock', '<h2>')} title="二级标题"><Heading2 className="w-4 h-4" /></ToolBtn>
            <ToolBtn onClick={() => exec('formatBlock', '<h3>')} title="三级标题"><Heading3 className="w-4 h-4" /></ToolBtn>
            <ToolBtn onClick={() => exec('insertUnorderedList')} title="无序列表"><List className="w-4 h-4" /></ToolBtn>
            <ToolBtn onClick={() => exec('insertOrderedList')} title="有序列表"><ListOrdered className="w-4 h-4" /></ToolBtn>
            <ToolBtn onClick={insertLink} title="插入链接"><Link2 className="w-4 h-4" /></ToolBtn>
            <span className="w-px h-5 bg-black/10 dark:bg-white/10 mx-1" />
            <ToolBtn onClick={insertImageByUrl} title="插入图片链接"><ImagePlus className="w-4 h-4" /></ToolBtn>
            <label className="relative cursor-pointer p-2 rounded-lg text-link/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="上传并插入图片">
              {imgUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              <input type="file" accept="image/*" className="hidden" onChange={onPickContentImage} />
            </label>
            <span className="w-px h-5 bg-black/10 dark:bg-white/10 mx-1" />
            <ToolBtn onClick={rehostContentImages} title="把正文里所有外链图片批量转存到本站">
              <Download className="w-4 h-4" />
            </ToolBtn>
            <span className="w-px h-5 bg-black/10 dark:bg-white/10 mx-1" />
            <ToolBtn onClick={() => setMdModalOpen(true)} title="粘贴整篇 Markdown 文档（左侧 MD 源码 + 右侧实时渲染）">
              <FileCode className="w-4 h-4" />
            </ToolBtn>
          </div>

          {/* 编辑区 + 实时预览 */}
          <div className={editingView === 'split' ? 'grid md:grid-cols-2 gap-4 items-start' : ''}>
            {/* 正文编辑区（始终挂载，预览模式下仅隐藏，避免内容丢失） */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setPreviewHtml(e.currentTarget.innerHTML)}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text/plain');
                // 识别粘贴内容是 Markdown 源码（含 # 标题、** 加粗、``` 代码块、| 表格等特征）
                if (text && /(^|\n)(#{1,6}\s|```|> \S|\s\|\s|- \S)/.test(text) && !e.clipboardData.items.length) {
                  e.preventDefault();
                  const html = marked.parse(text, { async: false, gfm: true, breaks: true }) as string;
                  const frag = document.createRange().createContextualFragment(html);
                  const sel = window.getSelection();
                  const ed = e.currentTarget as HTMLElement;
                  const anchor = sel?.anchorNode;
                  if (anchor && ed.contains(anchor)) {
                    const range = document.createRange();
                    range.setStart(anchor, 0);
                    range.insertNode(frag);
                  } else {
                    ed.appendChild(frag);
                  }
                  setPreviewHtml(ed.innerHTML);
                  setMsg('Markdown 已自动渲染为 HTML ✓');
                }
              }}
              className={
                'min-h-[360px] rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] p-5 outline-none focus:border-emerald-500 leading-relaxed ' +
                (editingView === 'preview' ? 'hidden ' : '') +
                '[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 ' +
                '[&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-3'
              }
              data-placeholder="在此撰写正文，可插入图片、标题、列表…"
            />

            {editingView !== 'edit' && (
              <div
                className="min-h-[360px] rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] p-5 overflow-auto
                  [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:serif-zh
                  [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:serif-zh
                  [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-2
                  [&_p]:my-4 [&_p]:text-[1.05rem]
                  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4
                  [&_li]:my-1.5
                  [&_a]:text-emerald-600 [&_a]:underline
                  [&_img]:rounded-xl [&_img]:my-6 [&_img]:max-w-full [&_img]:mx-auto [&_img]:border [&_img]:border-black/10 [&_img]:dark:border-white/10
                  [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-link/70 [&_blockquote]:dark:text-white/70 [&_blockquote]:my-4
                  [&_code]:bg-black/5 [&_code]:dark:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
                  [&_pre]:bg-black/5 [&_pre]:dark:bg-white/5 [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:my-4"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
          </div>

          <p className="text-xs text-link/40 dark:text-white/40 mt-2">
            提示：图片支持「上传」（需先配置 R2 存储桶）和「插入图片链接」两种方式。排版工具使用浏览器原生功能。预览区实时呈现读者看到的效果。
          </p>
        </div>
      </div>

      {/* Markdown 粘贴模态（整篇 MD → 渲染 HTML → 插入正文） */}
      <MarkdownModal
        open={mdModalOpen}
        onInsert={(html) => {
          const ed = editorRef.current;
          if (!ed) return;
          ed.focus();
          // 把渲染后的 HTML 插到编辑器末尾
          const tmp = document.createElement('div');
          tmp.innerHTML = html;
          const frag = document.createRange().createContextualFragment(tmp.innerHTML || '');
          ed.appendChild(frag);
          setPreviewHtml(ed.innerHTML);
          setMdModalOpen(false);
          setMsg('Markdown 已渲染并插入正文 ✓');
        }}
        onClose={() => setMdModalOpen(false)}
      />
    </section>
  );
};

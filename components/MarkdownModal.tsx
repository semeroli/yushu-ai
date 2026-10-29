import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { X, ArrowLeft, Code, Loader2, CheckCircle2, FileCode } from 'lucide-react';

interface Props {
  open: boolean;
  initialHtml?: string; // 编辑器当前 HTML（用于预填）
  onInsert: (html: string) => void;
  onClose: () => void;
}

// 简易 Markdown → HTML 渲染（带代码块/表格/图片/引用/标题等完整特性）
// 用 marked v9 的同步 parse API。
const renderMd = (md: string): string => {
  if (!md.trim()) return '';
  try {
    const html = marked.parse(md, {
      async: false,
      gfm: true,
      breaks: true,
    }) as string;
    return html;
  } catch {
    // marked 极端异常时，至少保留原文（包 <pre> 里显示）
    return '<pre>' + md.replace(/</g, '&lt;') + '</pre>';
  }
};

export const MarkdownModal: React.FC<Props> = ({ open, initialHtml, onInsert, onClose }) => {
  const [md, setMd] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [busy, setBusy] = useState(false);
  const [inserted, setInserted] = useState(false);
  const mdRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setMd('');
      setPreviewHtml('');
      setInserted(false);
      setBusy(false);
      // 若传入 initialHtml，可以简单把它作为参考文本（用户可粘贴覆盖）
      if (initialHtml) {
        // 粗略提取纯文本供参考
        const tmp = document.createElement('div');
        tmp.innerHTML = initialHtml;
        setMd(tmp.textContent || '');
      }
      // 聚焦 textarea
      setTimeout(() => mdRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setPreviewHtml(renderMd(md)), 150);
    return () => clearTimeout(t);
  }, [md, open]);

  if (!open) return null;

  const handleInsert = async () => {
    setBusy(true);
    const html = renderMd(md);
    onInsert(html);
    setInserted(true);
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl h-[85vh] rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-xl flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]">
          <FileCode className="w-5 h-5 text-emerald-500" />
          <h3 className="text-base font-semibold">粘贴 Markdown 文档</h3>
          <span className="text-xs text-link/40 dark:text-white/40">
            左侧写/粘贴 MD 源码，右侧实时渲染；完成后点「插入到正文」
          </span>
          <button
            onClick={onClose}
            className="ml-auto p-2 rounded-lg text-link/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 双栏 */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 overflow-hidden">
          {/* 左：MD 源码 */}
          <div className="flex flex-col min-w-0 border-r border-black/10 dark:border-white/10">
            <div className="px-3 py-2 text-xs text-link/50 dark:text-white/50 border-b border-black/10 dark:border-white/10 flex items-center gap-2">
              <Code className="w-3.5 h-3.5" /> Markdown 源码
            </div>
            <textarea
              ref={mdRef}
              value={md}
              onChange={(e) => setMd(e.target.value)}
              placeholder={'在此粘贴 Markdown，例如：\n\n# 标题\n\n**加粗** 段落\n\n```\n代码块\n```\n\n| 表 | 头 |\n|---|---|\n| a | b |\n'}
              spellCheck={false}
              className="flex-1 w-full resize-none outline-none bg-transparent p-4 font-mono text-sm leading-relaxed text-link dark:text-white/90 focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          {/* 右：渲染预览 */}
          <div className="flex flex-col min-w-0 overflow-hidden">
            <div className="px-3 py-2 text-xs text-link/50 dark:text-white/50 border-b border-black/10 dark:border-white/10 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> 渲染预览
            </div>
            <div
              className="article-content flex-1 overflow-auto p-5"
              dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-link/30 dark:text-white/30">粘贴 Markdown 后会实时渲染在这里…</p>' }}
            />
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]">
          <span className="text-xs text-link/50 dark:text-white/50">
            {md.length === 0 ? '尚未输入内容' : `已输入 ${md.length} 字符`}
            {inserted && <span className="ml-2 text-emerald-600">已插入正文 ✓</span>}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleInsert}
              disabled={busy || md.trim() === ''}
              className="flex items-center gap-2 px-4 py-1.5 text-sm rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              插入到正文
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

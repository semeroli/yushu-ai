import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Scroll, PenTool, BookOpen, Library, Copy, Check, Feather, Image as ImageIcon, XCircle, ShieldCheck, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateTeachingResource, ToolType } from '../services/geminiService';
import { MotionDiv } from '../lib/motion';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: ToolType;
  images?: string[];
}

const TOOLS = [
  { id: 'ancient', label: '古诗文鉴赏', icon: <Scroll className="w-4 h-4" />, color: 'text-orange-400' },
  { id: 'poetry', label: '诗词创作助手', icon: <Feather className="w-4 h-4" />, color: 'text-yellow-400' },
  { id: 'essay', label: '作文批改', icon: <PenTool className="w-4 h-4" />, color: 'text-pink-400' },
  { id: 'lesson', label: '教案生成', icon: <Library className="w-4 h-4" />, color: 'text-blue-400' },
  { id: 'reading', label: '阅读理解', icon: <BookOpen className="w-4 h-4" />, color: 'text-purple-400' },
];

export const AIPortal: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '你好！我是语枢AI助手，为你提供专业的语文教学辅助服务。我可以帮你进行古诗文鉴赏、教案生成、作文批改等多种功能。选择下方工具开始使用吧！' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolType>('general');
  const [isExpertMode, setIsExpertMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, selectedImages]);

  const toggleExpertMode = async () => {
    if (!isExpertMode) {
      setIsExpertMode(true);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '✅ 专家模式已开启！现在你将使用更强大的模型获得更专业的教学资源生成服务。'
      }]);
    } else {
      setIsExpertMode(false);
      setMessages(prev => [...prev, { role: 'assistant', content: '已退出专家模式。' }]);
    }
  };

  // 压缩图片：限制最大宽度/高度，降低质量，控制 base64 大小
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          // 限制最大尺寸 1200px（保持比例）
          const maxSize = 1200;
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            } else {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // 先尝试 quality 0.8，如果还太大再降到 0.6
          let quality = 0.8;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);

          // 如果超过 500KB，降低质量
          const base64Length = dataUrl.length - 'data:image/jpeg;base64,'.length;
          const sizeInBytes = (base64Length * 3) / 4;
          if (sizeInBytes > 500 * 1024) {
            quality = 0.6;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Image load failed'));
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (selectedImages.length + files.length > 5) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ 附件数量不超过 5 张' }]);
      return;
    }

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ 图片 ${file.name} 超过 10MB，无法处理` }]);
        continue;
      }
      try {
        const compressed = await compressImage(file);
        setSelectedImages(prev => [...prev, compressed]);
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ 图片 ${file.name} 处理失败，请重试` }]);
      }
    }
  };

  const handleSend = async (overridePrompt?: string, forceType?: ToolType) => {
    const textToSend = overridePrompt || input;
    const typeToUse = forceType || activeTool;
    const imagesToSend = [...selectedImages];

    if ((!textToSend.trim() && imagesToSend.length === 0) || isLoading) return;

    setInput('');
    setSelectedImages([]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setMessages(prev => [...prev, {
      role: 'user',
      content: textToSend,
      type: typeToUse,
      images: imagesToSend.length > 0 ? imagesToSend : undefined
    }]);
    setIsLoading(true);

    const response = await generateTeachingResource(textToSend, typeToUse, isExpertMode, imagesToSend.length > 0 ? imagesToSend : undefined);

    if (response === 'ERROR_KEY_INVALID') {
      setIsExpertMode(false);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '🔑 服务密钥无效，请联系管理员更新配置。'
      }]);
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: response || '服务暂时不可用，请稍后再试。' }]);
    }
    setIsLoading(false);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section id="experience" className="py-12 md:py-24 px-4 md:px-6 relative">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-6">
          <div className="text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-500/20">
              Intelligent Workspace
            </div>
            <h2 className="text-2xl md:text-5xl font-bold">语枢 <span className="text-emerald-500">AI助手</span></h2>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              onClick={toggleExpertMode}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-xs md:text-sm font-bold w-full md:w-auto ${
                isExpertMode
                  ? 'bg-purple-600/20 border-purple-500 text-purple-600 dark:text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                  : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-link/40 dark:text-white/40 hover:text-link dark:hover:text-white'
              }`}
            >
              {isExpertMode ? <ShieldCheck className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              <span>{isExpertMode ? '专家模式已开启' : '切换专家模式'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-start gap-2 md:gap-3 mb-8">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id as ToolType)}
              className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-xl border transition-all shrink-0 ${
                activeTool === tool.id
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-link/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10'
              }`}
            >
              <span className={activeTool === tool.id ? 'text-white' : tool.color}>{tool.icon}</span>
              <span className="text-[12px] md:text-sm font-medium">{tool.label}</span>
            </button>
          ))}
        </div>

        <div className="glass dark:glass rounded-[1.5rem] md:rounded-[2rem] overflow-hidden border border-black/10 dark:border-white/10 shadow-2xl flex flex-col h-[70vh] md:h-[650px] relative bg-white/40 dark:bg-black/20">
          <div className="p-3 md:p-4 border-b border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-colors ${isExpertMode ? 'bg-purple-600' : 'bg-emerald-600'}`}>
                {isExpertMode ? <Zap className="w-3 h-3 md:w-4 md:h-4 text-white" /> : <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-white" />}
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-xs md:text-sm text-link dark:text-white">
                  语枢助手 {isExpertMode && <span className="text-[8px] md:text-[10px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded ml-1 font-bold tracking-tighter">EXPERT</span>}
                </span>
                <span className="text-[8px] md:text-[10px] text-link/40 dark:text-white/40">
                  {TOOLS.find(t => t.id === activeTool)?.label || '通用助手'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setMessages([{ role: 'assistant', content: '对话已清空，开始新的对话吧！' }])}
              className="text-[10px] text-link/30 dark:text-white/30 hover:text-link dark:hover:text-white px-2 py-1 flex items-center gap-1"
            >
              清空对话
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth bg-black/5 dark:bg-black/20">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <MotionDiv
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 md:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                    msg.role === 'user' ? 'bg-emerald-700' : 'bg-black/10 dark:bg-white/10'
                  }`}>
                    {msg.role === 'user' ? <User className="w-3 h-3 md:w-4 md:h-4 text-white" /> : <Bot className="w-3 h-3 md:w-4 md:h-4 text-link dark:text-white" />}
                  </div>
                  <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[80%]`}>
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-1 justify-end">
                        {msg.images.map((img, idx) => (
                          <div key={idx} className="rounded-xl overflow-hidden border border-black/10 dark:border-white/10 max-w-[150px] shadow-sm">
                            <img src={img} alt={`Upload ${idx}`} className="w-full h-auto" />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={`p-4 md:p-5 rounded-2xl text-xs md:text-sm leading-relaxed relative group ${
                      msg.role === 'user'
                        ? 'bg-emerald-700 text-white rounded-tr-none shadow-lg shadow-emerald-900/10'
                        : 'bg-white/80 dark:bg-white/5 border border-black/5 dark:border-white/10 text-link dark:text-white/90 prose prose-invert max-w-none rounded-tl-none shadow-sm'
                    }`}>
                      <div className="whitespace-pre-wrap font-sans">
                        {msg.content}
                      </div>
                      {msg.role === 'assistant' && i > 0 && (
                        <button
                          onClick={() => handleCopy(msg.content)}
                          className="absolute top-2 right-2 p-1.5 bg-black/5 dark:bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copied ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3 text-link/40 dark:text-white/40" />}
                        </button>
                      )}
                    </div>
                  </div>
                </MotionDiv>
              ))}
              {isLoading && (
                <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-link/40 dark:text-white/40" />
                  </div>
                  <div className="p-4 md:p-5 rounded-2xl bg-white/80 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center gap-3">
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] md:text-xs text-link/40 dark:text-white/40 tracking-widest">语枢正在为你生成教学资源...</span>
                  </div>
                </MotionDiv>
              )}
            </AnimatePresence>
          </div>

          <div className="p-4 md:p-6 border-t border-black/5 dark:border-white/5 bg-white/30 dark:bg-white/[0.03]">
            <AnimatePresence>
              {selectedImages.length > 0 && (
                <MotionDiv
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="flex flex-wrap gap-3"
                >
                  {selectedImages.map((img, index) => (
                    <div key={index} className="relative inline-block">
                      <div className="relative rounded-xl overflow-hidden border border-emerald-500/30 w-20 h-20 group shadow-md">
                        <img src={img} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                            className="p-1 rounded-full bg-red-500/80 text-white hover:bg-red-500"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </MotionDiv>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-3">
              <div className="relative flex items-end gap-2 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl md:rounded-2xl p-2 md:p-3 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all shadow-inner">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-lg transition-colors shrink-0 mb-0.5 ${
                    selectedImages.length > 0
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                      : 'text-link/40 dark:text-white/40 hover:text-link dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                  title="上传图片 (最多5张)"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`输入${TOOLS.find(t => t.id === activeTool)?.label || '通用'}相关内容...`}
                  className="flex-1 bg-transparent outline-none text-sm resize-none max-h-32 text-link dark:text-white placeholder:text-link/30 dark:placeholder:text-white/30"
                  rows={1}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || (!input.trim() && selectedImages.length === 0)}
                  className="p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-all disabled:opacity-30 disabled:hover:bg-emerald-600 shrink-0 shadow-md shadow-emerald-600/20 mb-0.5"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-center text-[10px] text-link/20 dark:text-white/20 px-2">
                AI 生成内容仅供参考，请结合实际情况进行判断和修改
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

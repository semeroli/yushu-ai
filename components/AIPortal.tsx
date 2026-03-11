
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Scroll, PenTool, BookOpen, Library, Copy, Check, Feather, Zap, ShieldCheck, AlertCircle, Image as ImageIcon, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { gemini, ToolType } from '../services/geminiService';

// Use a type-casted motion.div to resolve property 'initial' does not exist error
const MotionDiv = motion.div as any;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: ToolType;
  images?: string[]; // 修改：支持多张图片
}

const TOOLS = [
  { id: 'ancient', label: '文言文解析', icon: <Scroll className="w-4 h-4" />, color: 'text-orange-400' },
  { id: 'poetry', label: '古诗词鉴赏', icon: <Feather className="w-4 h-4" />, color: 'text-yellow-400' },
  { id: 'essay', label: '作文批改', icon: <PenTool className="w-4 h-4" />, color: 'text-pink-400' },
  { id: 'lesson', label: '智能教案', icon: <Library className="w-4 h-4" />, color: 'text-blue-400' },
  { id: 'reading', label: '名著导读', icon: <BookOpen className="w-4 h-4" />, color: 'text-purple-400' },
];

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

export const AIPortal: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '欢迎来到语枢智慧工作台。请选择工具或直接输入需求。本演示版共享 API 额度，如遇卡顿建议开启【专家模式】使用私有资源。' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolType>('general');
  const [isExpertMode, setIsExpertMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]); // 修改：存储选中的多张图片 Base64
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // 新增：文件输入引用

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, selectedImages]); // 依赖增加 selectedImages 以便预览时滚动

  const toggleExpertMode = async () => {
    if (typeof window.aistudio === 'undefined') {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '💡 专家模式说明：私有 Key 接入目前仅支持在 AI Studio 环境或配置了 API_KEY 环境变量的服务器上运行。' 
      }]);
      return;
    }

    if (!isExpertMode) {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
        }
        setIsExpertMode(true);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: '✨ 专家模式激活！已接入您的私有付费 Key，系统将启用 Gemini 3 Pro 旗舰模型为您提供深度解析。' 
        }]);
      } catch (e) {
        console.error("Key selection failed", e);
      }
    } else {
      setIsExpertMode(false);
      setMessages(prev => [...prev, { role: 'assistant', content: '已切回普通模式（共享额度）。' }]);
    }
  };

  // 修改：处理多张图片选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 限制总数，例如最多 5 张
    if (selectedImages.length + files.length > 5) {
      alert("最多只能上传 5 张图片");
      return;
    }

    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) { // 简单限制 5MB
        alert(`图片 ${file.name} 大小超过 5MB，已跳过`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSend = async (overridePrompt?: string, forceType?: ToolType) => {
    const textToSend = overridePrompt || input;
    const typeToUse = forceType || activeTool;
    const imagesToSend = [...selectedImages]; // 捕获当前的图片数组

    // 如果没有文本且没有图片，则不发送
    if ((!textToSend.trim() && imagesToSend.length === 0) || isLoading) return;

    setInput('');
    setSelectedImages([]); // 发送后清空图片预览
    if (fileInputRef.current) fileInputRef.current.value = ''; // 重置文件输入

    // 更新 UI 显示
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: textToSend, 
      type: typeToUse,
      images: imagesToSend.length > 0 ? imagesToSend : undefined 
    }]);
    setIsLoading(true);

    // 调用 Service，传入图片数组参数
    const response = await gemini.generateTeachingResource(textToSend, typeToUse, isExpertMode, imagesToSend.length > 0 ? imagesToSend : undefined);
    
    if (response === "ERROR_KEY_INVALID") {
      setIsExpertMode(false);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '⚠️ 专家模式凭证异常：您的 API Key 可能已过期或余额不足。请在弹出的对话框中重新关联一个有效的付费项目 Key。' 
      }]);
      
      if (typeof window.aistudio !== 'undefined') {
        try {
          await window.aistudio.openSelectKey();
          setIsExpertMode(true);
        } catch (e) {}
      }
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: response || "生成资源时遇到一点小麻烦，请稍后重试。" }]);
    }
    setIsLoading(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="experience" className="py-12 md:py-24 px-4 md:px-6 relative">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-6">
          <div className="text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-500/20">
              Intelligent Workspace
            </div>
            <h2 className="text-2xl md:text-5xl font-bold">语枢 <span className="text-emerald-500">智慧工作台</span></h2>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <button 
              onClick={toggleExpertMode}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-xs md:text-sm font-bold w-full md:w-auto ${
                isExpertMode 
                ? 'bg-purple-600/20 border-purple-500 text-purple-600 dark:text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]' 
                : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-ink/40 dark:text-white/40 hover:text-ink dark:hover:text-white'
              }`}
            >
              {isExpertMode ? <ShieldCheck className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              <span>{isExpertMode ? '专家模式运行中' : '切换专家模式 (私有 Key)'}</span>
            </button>
            {isExpertMode && (
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[10px] text-purple-400/60 hover:text-purple-400 underline transition-colors">
                结算账户文档说明
              </a>
            )}
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
                : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-ink/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10'
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
                <span className="font-semibold text-xs md:text-sm text-ink dark:text-white">语枢助手 {isExpertMode && <span className="text-[8px] md:text-[10px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded ml-1 font-bold tracking-tighter">GEMINI 3 PRO</span>}</span>
                <span className="text-[8px] md:text-[10px] text-ink/40 dark:text-white/40">当前工具：{TOOLS.find(t => t.id === activeTool)?.label || '通用模式'}</span>
              </div>
            </div>
            <button 
              onClick={() => setMessages([{ role: 'assistant', content: '工作台已重置。' }])}
              className="text-[10px] text-ink/30 dark:text-white/30 hover:text-ink dark:hover:text-white px-2 py-1 flex items-center gap-1"
            >
              清空上下文
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
                    {msg.role === 'user' ? <User className="w-3 h-3 md:w-4 md:h-4 text-white" /> : <Bot className="w-3 h-3 md:w-4 md:h-4 text-ink dark:text-white" />}
                  </div>
                  <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[80%]`}>
                    
                    {/* 显示用户发送的多张图片 */}
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
                      msg.role === 'user' ? 'bg-emerald-700 text-white rounded-tr-none shadow-lg shadow-emerald-900/10' : 'bg-white/80 dark:bg-white/5 border border-black/5 dark:border-white/10 text-ink dark:text-white/90 prose prose-invert max-w-none rounded-tl-none shadow-sm'
                    }`}>
                      <div className="whitespace-pre-wrap font-sans">
                        {msg.content}
                      </div>
                      
                      {msg.role === 'assistant' && i > 0 && (
                        <button 
                          onClick={() => handleCopy(msg.content)}
                          className="absolute top-2 right-2 p-1.5 bg-black/5 dark:bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copied ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3 text-ink/40 dark:text-white/40" />}
                        </button>
                      )}
                    </div>
                  </div>
                </MotionDiv>
              ))}
              {isLoading && (
                <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-ink/40 dark:text-white/40" />
                  </div>
                  <div className="p-4 md:p-5 rounded-2xl bg-white/80 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center gap-3">
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] md:text-xs text-ink/40 dark:text-white/40 tracking-widest">语枢正在智能构建教学资源...</span>
                  </div>
                </MotionDiv>
              )}
            </AnimatePresence>
          </div>

          <div className="p-4 md:p-6 border-t border-black/5 dark:border-white/5 bg-white/30 dark:bg-white/[0.03]">
            {/* 图片预览区域 */}
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
                            onClick={() => { 
                              setSelectedImages(prev => prev.filter((_, i) => i !== index));
                            }}
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
                {/* 隐藏的文件输入框 */}
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  className="hidden" 
                />
                
                {/* 上传按钮 */}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-lg transition-colors shrink-0 mb-0.5 ${selectedImages.length > 0 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-ink/40 dark:text-white/40 hover:text-ink dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'}`}
                  title="上传图片 (可多选，例如: 学生作文多页照片)"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  placeholder={selectedImages.length > 0 ? "已添加图片，可输入批改要求..." : "在此输入您的备课需求或粘贴文本..."}
                  className="w-full bg-transparent border-none text-xs md:text-sm text-ink dark:text-white focus:outline-none focus:ring-0 placeholder:text-ink/20 dark:placeholder:text-white/20 resize-none min-h-[44px] py-3 max-h-[120px]"
                  style={{ height: 'auto' }}
                />
                
                <button 
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && selectedImages.length === 0) || isLoading}
                  className="p-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/40 shrink-0 mb-0.5"
                >
                  <Send className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
              
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 px-1">
                <p className="text-[9px] md:text-[11px] text-ink/20 dark:text-white/20">
                  语枢 AI 可能会产生误差，请结合教材进行人工核校。
                </p>
                {isExpertMode && (
                  <span className="text-[9px] md:text-[10px] text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" /> 专家通道已连接
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

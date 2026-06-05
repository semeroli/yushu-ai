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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (selectedImages.length + files.length > 5) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ 附件数量不超过 5 张' }]);
      return;
    }

    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ 图片 ${file.name} 超过 5MB，请压缩后重试` }]);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImages(prev => [...prev, reader.result as string]);
      };
      reader.onerror = () => {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ 图片 ${file.name} 读取失败，请重试` }]);
      };
      reader.readAsDataURL(file);
    });
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
 <div className={`w-7 h-7 md:w-8 md:h-
...(truncated)...

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Scroll, PenTool, BookOpen, Library, Copy, Check, Feather, Image as ImageIcon, XCircle, ShieldCheck, Zap, Camera, Lock, ChevronDown, BarChart3, Trash2, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateTeachingResource, ToolType, GradeType } from '../services/geminiService';
import { chat as senseNovaChat, TOOL_PROMPTS } from '../services/senseNovaService';
import { MotionDiv } from '../lib/motion';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: ToolType;
  images?: string[];
  streaming?: boolean;  // 是否正在流式输出中（打字机效果）
}

interface EssayScores {
  language: number;   // /30
  insight: number;    // /30
  structure: number;  // /20
  material: number;   // /20
  total: number;      // /100
}

const GRADES: { value: GradeType; label: string }[] = [
  { value: 'primary', label: '小学' },
  { value: 'junior', label: '初中' },
  { value: 'senior', label: '高中' },
  { value: 'college', label: '大学' },
];

const TOOLS = [
  { id: 'ancient', label: '古诗文鉴赏', icon: <Scroll className="w-4 h-4" />, color: 'text-orange-400' },
  { id: 'poetry', label: '诗词创作助手', icon: <Feather className="w-4 h-4" />, color: 'text-yellow-400' },
  { id: 'essay', label: '作文批改', icon: <PenTool className="w-4 h-4" />, color: 'text-pink-400' },
  { id: 'lesson', label: '教案生成', icon: <Library className="w-4 h-4" />, color: 'text-blue-400' },
  { id: 'reading', label: '阅读理解', icon: <BookOpen className="w-4 h-4" />, color: 'text-purple-400' },
];

const SCORE_LABELS = ['语言表达', '立意深度', '结构逻辑', '素材运用'];

const cleanMarkdown = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[\*\-]\s+/gm, '')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    .replace(/___(.*?)___/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
};

// 提取作文分数（从 AI 返回的文本中解析）
const parseEssayScores = (text: string): EssayScores | null => {
  const totalMatch = text.match(/总分[：:]\s*(\d+)/);
  const langMatch = text.match(/语言表达[：:]\s*(\d+)/);
  const insightMatch = text.match(/立意深度[：:]\s*(\d+)/);
  const structMatch = text.match(/结构逻辑[：:]\s*(\d+)/);
  const matMatch = text.match(/素材运用[：:]\s*(\d+)/);
  if (!totalMatch) return null;
  return {
    language: parseInt(langMatch?.[1] || '0'),
    insight: parseInt(insightMatch?.[1] || '0'),
    structure: parseInt(structMatch?.[1] || '0'),
    material: parseInt(matMatch?.[1] || '0'),
    total: parseInt(totalMatch[1]),
  };
};

// SVG 雷达图（纯 SVG，无第三方依赖）
const RadarChart: React.FC<{ scores: EssayScores; languageScore: number; insightScore: number; structureScore: number; materialScore: number }> = ({ scores }) => {
  const labels = SCORE_LABELS;
  const values = [
    (scores.language / 30) * 100,
    (scores.insight / 30) * 100,
    (scores.structure / 20) * 100,
    (scores.material / 20) * 100,
  ];
  const maxValues = [100, 100, 100, 100];
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 80;
  const levels = 4;

  const polarToXY = (angle: number, radius: number) => ({
    x: cx + radius * Math.cos((angle - 90) * Math.PI / 180),
    y: cy + radius * Math.sin((angle - 90) * Math.PI / 180),
  });

  const getPoints = (vals: number[]) =>
    vals.map((v, i) => {
      const angle = (360 / vals.length) * i;
      return polarToXY(angle, (v / 100) * r);
    });

  const gridPoints = (level: number) =>
    getPoints(maxValues.map(() => (level / levels) * 100))
      .map(p => `${p.x},${p.y}`)
      .join(' ');

  const dataPoints = getPoints(values).map(p => `${p.x},${p.y}`).join(' ');

  const axisLines = labels.map((_, i) => {
    const angle = (360 / labels.length) * i;
    const outer = polarToXY(angle, r);
    return { x1: cx, y1: cy, x2: outer.x, y2: outer.y };
  });

  const axisLabels = labels.map((label, i) => {
    const angle = (360 / labels.length) * i;
    const pos = polarToXY(angle, r + 22);
    return { label, x: pos.x, y: pos.y, anchor: Math.abs(pos.x - cx) < 10 ? 'middle' : pos.x < cx ? 'end' : 'start' };
  });

  const color = scores.total >= 80 ? '#10b981' : scores.total >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
        <BarChart3 className="w-3 h-3" /> 四维评分雷达图
      </div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 网格背景 */}
        {Array.from({ length: levels }, (_, i) => i + 1).map(level => (
          <polygon key={level} points={gridPoints(level)} fill="none" stroke="currentColor"
            className="text-black/5 dark:text-white/10" strokeWidth="1" />
        ))}
        {/* 轴线 */}
        {axisLines.map((line, i) => (
          <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
            stroke="currentColor" className="text-black/10 dark:text-white/10" strokeWidth="1" />
        ))}
        {/* 数据区域 */}
        <polygon points={dataPoints} fill={color} fillOpacity="0.15" stroke={color}
          strokeWidth="2" strokeLinejoin="round" />
        {/* 数据点 */}
        {getPoints(values).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill={color} />
        ))}
        {/* 轴标签 */}
        {axisLabels.map((item, i) => {
          const v = [scores.language / 30, scores.insight / 30, scores.structure / 20, scores.material / 20][i];
          const frac = [30, 30, 20, 20][i];
          return (
            <text key={i} x={item.x} y={item.y} textAnchor={item.anchor} dominantBaseline="middle"
              fontSize="10" fill="currentColor" className="text-link dark:text-white/60">
              {item.label}
              <tspan x={item.x} dy="12" textAnchor={item.anchor} fontSize="9" fontWeight="bold" fill={color}>
                {Math.round(v * frac)}/{frac}
              </tspan>
            </text>
          );
        })}
      </svg>
      <div className="text-center">
        <span className="text-2xl font-black" style={{ color }}>{scores.total}</span>
        <span className="text-sm text-link/40 dark:text-white/40">/100分</span>
      </div>
    </div>
  );
};

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
  const [isCompressing, setIsCompressing] = useState(false);
  const [showGradeMenu, setShowGradeMenu] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<GradeType>('junior');
  const [essayScores, setEssayScores] = useState<EssayScores | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const gradeMenuRef = useRef<HTMLDivElement>(null);

  const historyKey = `yushu-history-${activeTool}`;

  // 恢复对话历史
  useEffect(() => {
    const saved = localStorage.getItem(historyKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Message[];
        if (parsed.length > 0) setMessages(parsed);
      } catch { /* ignore */ }
    } else {
      setMessages([{ role: 'assistant', content: '你好！我是语枢AI助手，为你提供专业的语文教学辅助服务。选择下方工具开始使用吧！' }]);
    }
    setEssayScores(null);
  }, [activeTool]);

  // 保存对话历史
  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem(historyKey, JSON.stringify(messages));
    }
  }, [messages, historyKey]);

  // 点击外部关闭年级菜单
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (gradeMenuRef.current && !gradeMenuRef.current.contains(e.target as Node)) {
        setShowGradeMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading, selectedImages, essayScores]);

  const handleClearHistory = () => {
    setMessages([{ role: 'assistant', content: '对话已清空，开始新的对话吧！' }]);
    localStorage.removeItem(historyKey);
    setEssayScores(null);
  };

  const toggleExpertMode = async () => {
    if (!isExpertMode) {
      setIsExpertMode(true);
      setMessages(prev => [...prev, { role: 'assistant', content: '✅ 专家模式已开启！现在你将使用更强大的模型获得更专业的教学资源生成服务。' }]);
    } else {
      setIsExpertMode(false);
      setMessages(prev => [...prev, { role: 'assistant', content: '已退出专家模式。' }]);
    }
  };

  // HEIC 转换
  const convertHeic = async (file: File): Promise<File> => {
    const heic2any = (await import('heic2any')).default;
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
    return new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
  };

  // 压缩图片
  const compressImage = async (file: File): Promise<string> => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = async () => {
        if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic')) {
          try {
            const converted = await convertHeic(file);
            img.src = URL.createObjectURL(converted);
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('HEIC conversion failed'));
          } catch { reject(new Error('HEIC conversion failed')); }
        } else { reject(new Error('Image load failed')); }
      };
    });
    URL.revokeObjectURL(objectUrl);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const maxSize = 2048;
    let { width, height } = img;
    if (width > maxSize || height > maxSize) {
      if (width > height) { height = Math.round(height * maxSize / width); width = maxSize; }
      else { width = Math.round(width * maxSize / height); height = maxSize; }
    }
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.85;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    const sizeInBytes = ((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3) / 4;
    if (sizeInBytes > 1024 * 1024) { quality = 0.6; dataUrl = canvas.toDataURL('image/jpeg', quality); }
    return dataUrl;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (selectedImages.length + files.length > 5) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ 附件数量不超过 5 张' }]);
      return;
    }
    setIsCompressing(true);
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
    setIsCompressing(false);
  };

  // 图片模式
  const handleImageTool = async () => {
    const imagesToSend = [...selectedImages];
    if (!imagesToSend.length || isLoading) return;

    const toolPrompts: Record<string, string> = {
      essay: '请详细批阅这篇作文，包括语言表达、立意深度、结构逻辑和素材运用四个方面，并给出预估分数（40-100分）和具体修改建议。',
      poetry: '请鉴赏图片中的诗词，包括创作背景、艺术特色、情感意境和语言技巧等方面。',
      ancient: '请鉴赏图片中的古诗文，包括出处背景、字词解释、句意翻译、情感主旨和艺术手法等方面。',
      lesson: '请根据图片内容设计一份教案，包括教学目标、重难点、教学过程和板书设计等环节。',
      reading: '请根据图片中的阅读材料，出几道阅读理解题目并给出答案和解析。',
    };
    const genPrompt = input.trim() || toolPrompts[activeTool] || '请分析这张图片的内容。';

    setInput('');
    setSelectedImages([]);
    setEssayScores(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';

    setMessages(prev => [...prev, {
      role: 'user', content: genPrompt, type: activeTool, images: imagesToSend,
    }]);
    setIsLoading(true);

    const response = await generateTeachingResource(
      genPrompt, activeTool, isExpertMode, imagesToSend, undefined, selectedGrade
    );

    if (response === 'ERROR_KEY_INVALID') {
      setIsExpertMode(false);
      setMessages(prev => [...prev, { role: 'assistant', content: '🔑 服务密钥无效，请联系管理员更新配置。' }]);
    } else {
      const scores = parseEssayScores(response);
      setEssayScores(scores);
      setMessages(prev => [...prev, { role: 'assistant', content: response || '服务暂时不可用，请稍后再试。' }]);
    }
    setIsLoading(false);
  };

  const handleSend = async (overridePrompt?: string, forceType?: ToolType) => {
    const textToSend = overridePrompt || input;
    const typeToUse = forceType || activeTool;
    const imagesToSend = [...selectedImages];

    if ((!textToSend.trim() && !imagesToSend.length) || isLoading) return;
    if (imagesToSend.length > 0) {
      await handleImageTool();
      return;
    }

    setIsLoading(true);
    setInput('');
    setSelectedImages([]);
    setEssayScores(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';

    // 构建带上下文的对话（限制最近 20 条避免 token 爆炸）
    const systemContent = TOOL_PROMPTS[typeToUse] || TOOL_PROMPTS.general;
    const recentMessages = messages.slice(-20);
    const historyMessages = recentMessages
      .filter(m => m.role !== 'user' || m.content.length > 0)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const fullMessages = [
      { role: 'system' as const, content: systemContent },
      ...historyMessages,
      { role: 'user' as const, content: textToSend },
    ];

    // 添加用户消息 + 空 assistant 占位（流式输出目标）
    const userMsgAdded: Message[] = [{ role: 'user', content: textToSend, type: typeToUse }];
    const assistantMsg: Message = { role: 'assistant', content: '', streaming: true };
    setMessages(prev => [...prev, ...userMsgAdded, assistantMsg]);

    let streamedContent = '';
    await senseNovaChat({
      messages: fullMessages,
      isExpertMode,
      onChunk: (chunk) => {
        streamedContent += chunk;
        setMessages(prev => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].streaming) { updated[i] = { ...updated[i], content: streamedContent }; break; }
          }
          return updated;
        });
      },
      onError: (errMsg) => {
        setMessages(prev => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].streaming) { updated[i] = { role: 'assistant', content: errMsg, streaming: false }; break; }
          }
          return updated;
        });
      },
    });

    // 结束流式状态
    setMessages(prev => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].streaming) {
          updated[i] = { role: 'assistant', content: streamedContent || '服务暂时不可用，请稍后再试。', streaming: false };
          break;
        }
      }
      return updated;
    });

    const scores = parseEssayScores(streamedContent);
    setEssayScores(scores);
    setIsLoading(false);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
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
            {/* 年级选择器 */}
            <div className="relative" ref={gradeMenuRef}>
              <button
                onClick={() => setShowGradeMenu(!showGradeMenu)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-black/10 dark:border-white/20 bg-black/5 dark:bg-white/5 text-sm font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-all"
              >
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                <span>{GRADES.find(g => g.value === selectedGrade)?.label}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showGradeMenu ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showGradeMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-full mt-2 bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/20 rounded-xl shadow-lg overflow-hidden z-50 min-w-[120px]"
                  >
                    {GRADES.map(g => (
                      <button
                        key={g.value}
                        onClick={() => { setSelectedGrade(g.value); setShowGradeMenu(false); setEssayScores(null); }}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors ${selectedGrade === g.value ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/10' : 'text-link dark:text-white/80'}`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={toggleExpertMode}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-xs md:text-sm font-bold w-full md:w-auto ${isExpertMode ? 'bg-purple-600/20 border-purple-500 text-purple-600 dark:text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]' : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-link/40 dark:text-white/40 hover:text-link dark:hover:text-white'}`}
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
              className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-xl border transition-all shrink-0 ${activeTool === tool.id ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20' : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-link/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10'}`}
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
                  {activeTool === 'essay' && ` · ${GRADES.find(g => g.value === selectedGrade)?.label}水平`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="text-[10px] text-link/30 dark:text-white/30 hover:text-red-400 px-2 py-1 flex items-center gap-1"
                title="清空对话"
              >
                <Trash2 className="w-3 h-3" />
                清空
              </button>
            </div>
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
                  <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === 'user' ? 'bg-emerald-700' : 'bg-black/10 dark:bg-white/10'}`}>
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
                    <div className={`p-4 md:p-5 rounded-2xl text-xs md:text-sm leading-relaxed relative group ${msg.role === 'user' ? 'bg-emerald-700 text-white rounded-tr-none shadow-lg shadow-emerald-900/10' : 'bg-white/80 dark:bg-white/5 border border-black/5 dark:border-white/10 text-link dark:text-white/90 prose prose-invert max-w-none rounded-tl-none shadow-sm'}`}>
                      <div className="whitespace-pre-wrap font-sans">
                        {msg.role === 'assistant' ? cleanMarkdown(msg.content) : msg.content}
                        {msg.streaming && <span className="inline-block w-0.5 h-4 ml-0.5 bg-emerald-500 align-middle animate-pulse" />}
                      </div>
                      {msg.role === 'assistant' && i > 0 && (
                        <button
                          onClick={() => handleCopy(cleanMarkdown(msg.content))}
                          className="absolute top-2 right-2 p-1.5 bg-black/5 dark:bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copied ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3 text-link/40 dark:text-white/40" />}
                        </button>
                      )}
                    </div>
                  </div>
                </MotionDiv>
              ))}
              {essayScores && (
                <MotionDiv initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-start">
                  <div className="bg-white/80 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                    <RadarChart scores={essayScores} languageScore={essayScores.language} insightScore={essayScores.insight} structureScore={essayScores.structure} materialScore={essayScores.material} />
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
                  className="flex flex-wrap gap-3 items-center"
                >
                  {selectedImages.map((img, index) => (
                    <div key={index} className="relative">
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
                  {isCompressing && (
                    <span className="text-[10px] md:text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> 压缩中...
                    </span>
                  )}
                </MotionDiv>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-3">
              <div className="relative flex items-end gap-2 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl md:rounded-2xl p-2 md:p-3 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all shadow-inner">
                <input
                  type="file" accept="image/*" multiple ref={fileInputRef}
                  onChange={handleFileSelect} className="hidden" />
                <input
                  type="file" accept="image/*" capture="environment" ref={cameraInputRef}
                  onChange={handleFileSelect} className="hidden" />
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-2 rounded-lg transition-colors shrink-0 mb-0.5 text-link/40 dark:text-white/40 hover:text-link dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
                  title="拍照上传"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-lg transition-colors shrink-0 mb-0.5 ${selectedImages.length > 0 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-link/40 dark:text-white/40 hover:text-link dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'}`}
                  title="上传图片 (最多5张)"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={`输入${TOOLS.find(t => t.id === activeTool)?.label || '通用'}相关内容...`}
                  className="flex-1 bg-transparent outline-none text-sm resize-none max-h-32 text-link dark:text-white placeholder:text-link/30 dark:placeholder:text-white/30"
                  rows={1}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || isCompressing || (!input.trim() && !selectedImages.length)}
                  className="p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-all disabled:opacity-30 disabled:hover:bg-emerald-600 shrink-0 shadow-md shadow-emerald-600/20 mb-0.5"
                >
                  {isCompressing || isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : selectedImages.length > 0 ? (
                    <span className="text-sm font-medium px-2">分析图片</span>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
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

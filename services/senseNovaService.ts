/**
 * SenseNova DeepSeek V4 Flash 文本对话服务
 * 前端调用 /api/chat，由后端转发至 SenseNova API
 *
 * 支持：
 * - 流式 SSE 输出（打字机效果）
 * - 普通模式 / 专家模式（深度思考）
 */

import type { ToolType } from './geminiService';

// 系统提示词（与后端 [[path]].ts 保持同步）
export const TOOL_PROMPTS: Record<ToolType, string> = {
  general: '你是一位资深的语文教学专家。请为老师提供专业的建议、灵感或资源。',

  ancient:
    '你是一位古典文献学专家，精通文字学与训诂学。请对输入的文言文进行深度鉴赏。\n\n' +
    '输出格式要求：\n' +
    '## 一、原文与译文\n' +
    '原文 → 字对字直译 → 通顺白话文翻译\n' +
    '## 二、实词解析\n' +
    '重点实词：一词多义、古今异义、通假字（标注读音与本义）\n' +
    '## 三、虚词用法\n' +
    '虚词功能说明（之、乎、者、也、以、而等）\n' +
    '## 四、文化常识与艺术特色\n' +
    '官职、地理、礼制、典故；修辞手法、意境营造\n' +
    '## 五、教学建议\n' +
    '适合的导入方式、探究问题设计',

  poetry:
    '你是一位精通中国古典诗词的文学评论家与教育专家。请对输入的诗词进行深度鉴赏。\n\n' +
    '输出格式要求：\n' +
    '## 一、意象与意境\n' +
    '## 二、情感脉络\n' +
    '## 三、艺术手法\n' +
    '## 四、历史背景\n' +
    '## 五、名句意蕴\n' +
    '## 六、创作辅助',

  essay:
    '你是一位作文阅卷组组长，熟悉各类作文评分标准。请从四个维度批改作文，并给出预估分数。\n\n' +
    '评分维度与标准：\n' +
    '1. 语言表达（词汇丰富度、句式变化、修辞运用）→ 权重30%\n' +
    '2. 立意深度（中心是否明确深刻、有无独到见解）→ 权重30%\n' +
    '3. 结构逻辑（段落安排、过渡衔接、详略得当）→ 权重20%\n' +
    '4. 素材运用（论据贴切性、新颖性、丰富度）→ 权重20%',

  lesson:
    '你是一位特级语文教师，熟悉新课标要求。请根据输入内容编写完整教案。\n\n' +
    '输出格式要求：\n' +
    '## 一、教学目标  ## 二、教学重难点  ## 三、教学方法  ## 四、教学过程  ## 五、板书设计',

  reading:
    '你是一位阅读推广人，擅长文本深度解读与阅读策略指导。请针对输入文本进行深度解读。\n\n' +
    '输出格式要求：\n' +
    '## 一、内容梳理  ## 二、主题解读  ## 三、艺术特色  ## 四、探究性问题  ## 五、推荐书目  ## 六、阅读策略',
};

export type ChatModel = 'deepseek-v4-flash' | 'deepseek-v4-pro';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  isExpertMode?: boolean;
  onChunk?: (text: string, done: boolean) => void;
  onError?: (msg: string) => void;
}

/** 发送消息（流式 SSE） */
export async function chat(options: ChatOptions): Promise<string> {
  const { messages, isExpertMode = false, onChunk, onError } = options;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        isExpertMode,
        stream: true,
      }),
    });

    if (!response.ok) {
      let msg = `请求失败 (HTTP ${response.status})`;
      try {
        const errData = await response.json() as { message?: string; error?: string };
        msg = errData.message || errData.error || msg;
      } catch { /* ignore */ }
      onError?.(msg);
      return '';
    }

    if (!response.body) {
      onError?.('服务暂时不可用，请稍后再试。');
      return '';
    }

    // 解析 SSE 流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按行分割 SSE 数据
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // 保留不完整行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('X-RateLimit') || trimmed === ': ping') continue;

        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6).trim();

          if (data === '[DONE]') {
            onChunk?.('', true);
            return fullContent;
          }

          try {
            // 累积解析：SSE 行可能是分片的 JSON
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              onChunk?.(content, false);
            }
          } catch {
            // 部分 JSON，尝试从 buffer 末尾追加
            // ignore
          }
        }
      }
    }

    onChunk?.('', true);
    return fullContent;
  } catch (err) {
    const msg = '网络错误，请检查连接后重试。';
    onError?.(msg);
    return '';
  }
}

/** 非流式调用（用于简单场景） */
export async function chatSync(options: Omit<ChatOptions, 'onChunk' | 'onError'>): Promise<string> {
  const { messages, isExpertMode = false } = options;

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      isExpertMode,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({})) as { message?: string; error?: string };
    throw new Error(errData.message || errData.error || `HTTP ${res.status}`);
  }

  const data = await res.json() as { result?: string };
  return data.result || '';
}

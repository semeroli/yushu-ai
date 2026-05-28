// src/services/geminiService.ts
import { marked } from 'marked';

export type ToolType =
  | 'general'
  | 'ancient'
  | 'essay'
  | 'lesson'
  | 'reading'
  | 'poetry';

/* ================= 系统提示词 ================= */
const TOOL_PROMPTS: Record<ToolType, string> = {
  general: '你是一位资深的语文教学专家。请为老师提供专业的建议、灵感或资源。',
  ancient:
    '你是一位古典文献学专家。请对输入的文言文进行精准翻译（字对字与意译）、重点实词解析、虚词用法说明，并提取文中的文化常识与艺术特色。',
  poetry:
    '你是一位精通中国古典诗词的文学评论家与教育专家。请对输入的诗词进行深度鉴赏...',
  essay:
    '你是一位作文阅卷组组长。请从“语言表达、立意深度、结构逻辑、素材运用”四个维度批改作文...',
  lesson:
    '你是一位特级语文教师。请根据输入的课文内容或题目，编写一份符合现代教育要求的教案...',
  reading:
    '你是一位阅读推广人。请针对特定书籍或文章，梳理人物关系图谱、核心情节脉络...',
};

/* ================= Marked 配置 ================= */
marked.setOptions({
  gfm: true,
  breaks: true,
});

/* ================= 核心服务类 ================= */
class GeminiService {
  async generateTeachingResource(
    prompt: string,
    type: ToolType = 'general',
    images: string[] = [],
    isPro: boolean = false
  ): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        systemPrompt: TOOL_PROMPTS[type],
        images,
        isPro,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error('语枢智能服务暂时不可用');
    }

    return response.body.getReader();
  }
}

/* ================= 单例导出（关键） ================= */
export const gemini = new GeminiService();

/* ================= Markdown 工具 ================= */
export function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';
  try {
    return marked.parse(markdown);
  } catch {
    return '<p class="md-error">内容解析失败</p>';
  }
}

import { marked } from 'marked';
import { ImagePart } from "@google/genai";

export type ToolType = "general" | "ancient" | "essay" | "lesson" | "reading" | "poetry";

const TOOL_PROMPTS: Record<ToolType, string> = {
  general: "你是一位资深的语文教学专家。请为老师提供专业的建议、灵感或资源。",
  ancient: "你是一位古典文献学专家。请对输入的文言文进行精准翻译（字对字与意译）、重点实词解析、虚词用法说明，并提取文中的文化常识与艺术特色。",
  poetry: "你是一位精通中国古典诗词的文学评论家与教育专家。请对输入的诗词进行深度鉴赏，重点分析：1. 意境与意象；2. 修辞手法与炼字艺术；3. 作者生平背景及创作时节；4. 核心情感与哲学内涵的深度表达。",
  essay: "你是一位作文阅卷组组长。请从“语言表达、立意深度、结构逻辑、素材运用”四个维度批改作文。如果是图片输入，请先识别图片中的文字内容。先给出综合评分（百分制），然后列出3个闪光点和2个改进建议，最后提供一段润色后的范文片段。",
  lesson: "你是一位特级语文教师。请根据输入的课文内容或题目，编写一份符合现代教育要求的教案。教案须包含：1. 教学目标（含核心素养）；2. 教学重难点；3. 教学步骤（导入、初读、研读、总结）；4. 课后作业设计。",
  reading: "你是一位阅读推广人。请针对特定书籍或文章，梳理人物关系图谱、核心情节脉络，并设计3个具有思维挑战性的深度探究问题。",
};

/**
 * ✅ 只替换 Renderer：文段模式（不改任何业务逻辑）
 */
const renderer = new marked.Renderer();

// 标题：带底部分割线
renderer.heading = (text, level) => {
  const sizeMap: Record<number, string> = {
    1: 'text-2xl',
    2: 'text-xl',
    3: 'text-lg',
    4: 'text-base',
    5: 'text-sm',
    6: 'text-xs',
  };
  return `<div class="${sizeMap[level]} md-h">${text}</div>`;
};

// 段落：宽松行高
renderer.paragraph = (text) => {
  return `<div class="md-p">${text}</div>`;
};

// 列表：去掉黑点，改成缩进文段
renderer.listitem = (text) => {
  return `<div class="md-li">${text}</div>`;
};

// 粗体：高亮关键词
renderer.strong = (text) => {
  return `<strong class="md-strong">${text}</strong>`;
};

// 分割线：淡灰色
renderer.hr = () => {
  return `<div class="md-hr"></div>`;
};

marked.setOptions({
  renderer,
  gfm: true,
  breaks: false,
});

export class GeminiService {
  async generateTeachingResource(
    prompt: string,
    type: ToolType = "general",
    isPro: boolean = false,
    imagesBase64?: string[]
  ): Promise<string> {
    try {
      const pureBase64Images = imagesBase64?.map(img => {
        return img.split(',')[1] || img;
      }) || [];

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          systemPrompt: TOOL_PROMPTS[type],
          isPro,
          images: pureBase64Images,
        }),
      });

      if (!response.ok) {
        return '<div class="md-error">语枢智能服务暂时不可用，请稍后再试。</div>';
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.replace("data:", "").trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullText += content;
          } catch {}
        }
      }

      return marked.parse(fullText);

    } catch {
      return '<div class="md-error">请求失败，请检查网络连接。</div>';
    }
  }
}

export const gemini = new GeminiService();

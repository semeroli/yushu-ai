export type ToolType = 'general' | 'ancient' | 'essay' | 'lesson' | 'reading' | 'poetry';

const TOOL_PROMPTS: Record<ToolType, string> = {
  general: "你是一位资深的语文教学专家。请为老师提供专业的建议、灵感或资源。",
  ancient: "你是一位古典文献学专家。请对输入的文言文进行精准翻译（字对字与意译）、重点实词解析、虚词用法说明，并提取文中的文化常识与艺术特色。",
  poetry: "你是一位精通中国古典诗词的文学评论家与教育专家。请对输入的诗词进行深度鉴赏，重点分析：1. 意境与意象；2. 修辞手法与炼字艺术；3. 作者生平背景及创作时节；4. 核心情感与哲学内涵的深度表达。",
  essay: "你是一位作文阅卷组组长。请从‘语言表达、立意深度、结构逻辑、素材运用’四个维度批改作文。如果是图片输入，请先识别图片中的文字内容。先给出综合评分（百分制），然后列出3个闪光点和2个改进建议，最后提供一段润色后的范文片段。",
  lesson: "你是一位特级语文教师。请根据输入的课文内容或题目，编写一份符合现代教育要求的教案。教案须包含：1. 教学目标（含核心素养）；2. 教学重难点；3. 教学步骤（导入、初读、研读、总结）；4. 课后作业设计。",
  reading: "你是一位阅读推广人。请针对特定书籍或文章，梳理人物关系图谱、核心情节脉络，并设计3个具有思维挑战性的深度探究问题。"
};

export class GeminiService {
  /**
   * 生成教学资源（DeepSeek-V4-Pro / ModelScope / CF Pages Env）
   */
  async generateTeachingResource(
    context: any,
    prompt: string,
    type: ToolType = 'general',
    isPro: boolean = false,
    imagesBase64?: string[]
  ): Promise<string> {
    try {
      const apiKey = context.env.MODELSCOPE_API_KEY;
      if (!apiKey) {
        return "ERROR_KEY_INVALID";
      }

      const systemInst = TOOL_PROMPTS[type] + " 请使用清晰的 Markdown 格式输出。";

      const contentParts: any[] = [];

      // ✅ 多模态：图片
      if (imagesBase64 && imagesBase64.length > 0) {
        imagesBase64.forEach(img => {
          const base64Data = img.split(',')[1];
          const mimeType = img.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
          contentParts.push({
            inlineData: {
              mimeType,
              data: base64Data
            }
          });
        });
      }

      const textPrompt = prompt.trim() || (imagesBase64?.length ? "请分析这些图片的内容。" : "");
      contentParts.push({ text: textPrompt });

      const payload = {
        model: 'deepseek-ai/DeepSeek-V4-Pro',
        messages: [
          { role: 'system', content: systemInst },
          { role: 'user', content: contentParts }
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: isPro ? 4096 : 2048
      };

      const response = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        if (response.status === 401) return "ERROR_KEY_INVALID";
        throw new Error(err.error?.message || '请求失败');
      }

      // ✅ 严格对齐 Python 示例的流式解析
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      let doneReasoning = false;
      let fullText = '';

      if (!reader) {
        return '暂无内容。';
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;

          const jsonStr = line.replace('data:', '').trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;

            if (delta?.reasoning_content && delta.reasoning_content !== '') {
              fullText += delta.reasoning_content;
            } else if (delta?.content && delta.content !== '') {
              if (!doneReasoning) {
                fullText += '\n\n === Final Answer ===\n';
                doneReasoning = true;
              }
              fullText += delta.content;
            }
          } catch {
            continue;
          }
        }
      }

      return fullText || '暂无内容。';
    } catch (error: any) {
      console.error('DeepSeek Error:', error);
      return '语枢智能服务暂时无法处理，请检查您的网络或稍后再试。';
    }
  }
}

export const gemini = new GeminiService();

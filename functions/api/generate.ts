import type { Handler } from '@netlify/functions';

const AGNES_API_KEY = process.env.AGNES_API_KEY;
const AGNES_API_BASE = 'https://apihub.agnes-ai.com/v1';

type ToolType = 'general' | 'ancient' | 'poetry' | 'lesson' | 'reading' | 'essay';

/* ================= 系统提示词（从原 geminiService.ts 移植） ================= */
const TOOL_PROMPTS: Record<ToolType, string> = {
  general: '你是一位资深的语文教学专家。请为老师提供专业的建议、灵感或资源。',

  ancient:
    '你是一位古典文献学专家，精通文字学与训诂学。请对输入的文言文进行：\n' +
    '1. 精准翻译（先字对字直译，再给出通顺的白话文翻译）\n' +
    '2. 重点实词解析（一词多义、古今异义、通假字）\n' +
    '3. 虚词用法说明（之、乎、者、也、以、而等）\n' +
    '4. 提取文中的文化常识（官职、地理、礼制、典故）与艺术特色（修辞、手法、意境）\n' +
    '请用清晰的结构化方式输出，便于老师直接用于课堂教学。',

  poetry:
    '你是一位精通中国古典诗词的文学评论家与教育专家。请对输入的诗词进行深度鉴赏，包括：\n' +
    '1. 意象分析（提取核心意象，分析象征意义）\n' +
    '2. 情感脉络（诗人情感变化轨迹）\n' +
    '3. 艺术手法（比喻、拟人、用典、炼字等）\n' +
    '4. 历史背景与创作缘起\n' +
    '5. 名句意蕴解读\n' +
    '如果是创作辅助，请先理解用户意图，再提供符合格律的诗词范例或修改建议。',

  essay:
    '你是一位作文阅卷组组长，熟悉各类作文评分标准。请从以下四个维度批改作文：\n' +
    '1. 语言表达（词汇丰富度、句式变化、修辞手法）\n' +
    '2. 立意深度（中心思想是否明确、深刻）\n' +
    '3. 结构逻辑（段落安排、过渡衔接、详略得当）\n' +
    '4. 素材运用（论据是否贴切、新颖）\n' +
    '请给出具体修改建议，并给出 40-100 分的预估分数和评语。',

  lesson:
    '你是一位特级语文教师，熟悉新课标要求。请根据输入的课文内容或题目，编写一份完整的教案，包括：\n' +
    '1. 教学目标（知识与技能、过程与方法、情感态度与价值观）\n' +
    '2. 教学重难点\n' +
    '3. 教学方法与学法指导\n' +
    '4. 教学过程（导入、初读、精读、拓展、小结、作业）\n' +
    '5. 板书设计\n' +
    '教案应符合学生的认知规律，注重互动性与探究性。',

  reading:
    '你是一位阅读推广人，擅长文本深度解读与阅读策略指导。请针对特定书籍或文章：\n' +
    '1. 梳理人物关系图谱与核心情节脉络\n' +
    '2. 解读主题思想与艺术特色\n' +
    '3. 设计 3-5 个有梯度的探究性问题\n' +
    '4. 推荐同类阅读书目（3-5 本）\n' +
    '5. 提供阅读策略指导（精读、略读、跳读的应用场景）',
};

interface GenerateRequest {
  prompt: string;
  toolType: ToolType;
  isExpertMode: boolean;
  images?: string[];
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!AGNES_API_KEY) {
    console.error('AGNES_API_KEY environment variable is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'KEY_INVALID' }) };
  }

  try {
    const body: GenerateRequest = JSON.parse(event.body || '{}');
    const { prompt, toolType, isExpertMode, images } = body;

    if (!prompt?.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing prompt' }) };
    }

    // 选择模型
    const model =
      images && images.length > 0 ? 'agnes-image-2.1-flash' : 'agnes-2.0-flash';

    // 构建用户消息内容（支持图片）
    const userContent: any[] = [{ type: 'text', text: prompt }];
    if (images && images.length > 0) {
      for (const img of images) {
        const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          userContent.push({
            type: 'image_url',
            image_url: { url: `data:${match[1]};base64,${match[2]}`, detail: 'high' },
          });
        }
      }
    }

    const messages = [
      { role: 'system', content: TOOL_PROMPTS[toolType] || TOOL_PROMPTS.general },
      { role: 'user', content: userContent },
    ];

    const requestBody: Record<string, any> = {
      model,
      messages,
      max_tokens: isExpertMode ? 4096 : 2048,
      temperature: isExpertMode ? 0.7 : 0.9,
    };

    if (isExpertMode) {
      requestBody.chat_template_kwargs = { enable_thinking: true };
    }

    const response = await fetch(`${AGNES_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AGNES_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Agnes API error:', response.status, errorData);
      if (response.status === 401 || response.status === 403) {
        return { statusCode: 401, body: JSON.stringify({ error: 'KEY_INVALID' }) };
      }
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'API request failed', details: errorData }),
      };
    }

    const data = await response.json();
    const result =
      data.choices?.[0]?.message?.content || '未获取到有效回复，请重试。';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result }),
    };
  } catch (error) {
    console.error('Generate function error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};

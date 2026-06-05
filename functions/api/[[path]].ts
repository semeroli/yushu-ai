/**
 * Cloudflare Pages Function - AI 生成接口
 * 路由: POST /api/generate
 * 平台: Cloudflare Pages
 */

const AGNES_API_BASE = 'https://apihub.agnes-ai.com/v1';

type ToolType = 'general' | 'ancient' | 'poetry' | 'lesson' | 'reading' | 'essay';

/* ================= 系统提示词 ================= */
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

// OCR 专用提示词
const OCR_PROMPT = '你是一位专业的文字识别助手。请完整、准确地识别图片中的文字内容，保持原文的段落和格式。只输出识别到的文字，不要添加任何分析、评论或解释。';

interface Env {
  AGNES_API_KEY?: string;
}

// 调用 Agnes API 的通用函数
async function callAgnesAPI(
  apiKey: string,
  messages: any[],
  maxTokens: number,
  temperature: number,
  isExpertMode: boolean
): Promise<string> {
  const requestBody: Record<string, any> = {
    model: 'agnes-2.0-flash',
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  if (isExpertMode) {
    requestBody.chat_template_kwargs = { enable_thinking: true };
  }

  const apiResponse = await fetch(`${AGNES_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!apiResponse.ok) {
    const errorData = await apiResponse.json().catch(() => ({}));
    console.error('Agnes API error:', apiResponse.status, errorData);
    throw new Error(`API error: ${apiResponse.status}`);
  }

  const data = await apiResponse.json();
  return data.choices?.[0]?.message?.content || '';
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.AGNES_API_KEY) {
    return new Response(JSON.stringify({ error: 'KEY_INVALID', debug: 'AGNES_API_KEY not set in env' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json() as {
      prompt?: string;
      toolType?: ToolType;
      isExpertMode?: boolean;
      images?: string[];
      action?: 'ocr' | 'generate';
      ocrText?: string;
    };
    const { prompt, toolType = 'general', isExpertMode = false, images, action = 'generate', ocrText } = body;

    // 有 ocrText 时 prompt 可以为空（后端会用默认批阅提示词）
    if (!prompt?.trim() && !ocrText?.trim()) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ========== 第一阶段：OCR 识别 ==========
    if (action === 'ocr') {
      if (!images || images.length === 0) {
        return new Response(JSON.stringify({ error: 'OCR requires images' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const userContent: any[] = [
        { type: 'text', text: prompt },
      ];

      for (const img of images) {
        let imageUrl = img;
        if (!imageUrl.startsWith('data:image/')) {
          imageUrl = `data:image/jpeg;base64,${imageUrl}`;
        }
        userContent.push({
          type: 'image_url',
          image_url: { url: imageUrl },
        });
      }

      const messages = [
        { role: 'system', content: OCR_PROMPT },
        { role: 'user', content: userContent },
      ];

      console.log('OCR: Recognizing text from', images.length, 'images');

      const result = await callAgnesAPI(
        env.AGNES_API_KEY,
        messages,
        4096,
        0.3,
        false
      );

      if (!result) {
        return new Response(JSON.stringify({ error: 'OCR failed: empty result' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ocrText: result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ========== 第二阶段：生成批阅意见 ==========
    let finalPrompt = prompt;

    // 如果有 OCR 文本，加到提示词中（此时不再传图片，避免 Agnes API 格式错误）
    if (ocrText?.trim()) {
      finalPrompt = `【作文原文】\n${ocrText.trim()}\n\n【批阅要求】\n${prompt}`;
    }

    const userContent: any[] = [{ type: 'text', text: finalPrompt }];

    // 只有在没有 OCR 文本且有图片时，才传图片（纯图片识别模式）
    if (!ocrText?.trim() && images && images.length > 0) {
      for (const img of images) {
        let imageUrl = img;
        if (!imageUrl.startsWith('data:image/')) {
          imageUrl = `data:image/jpeg;base64,${imageUrl}`;
        }
        userContent.push({
          type: 'image_url',
          image_url: { url: imageUrl },
        });
      }
    }

    const messages = [
      { role: 'system', content: TOOL_PROMPTS[toolType] || TOOL_PROMPTS.general },
      { role: 'user', content: userContent },
    ];

    console.log('Generate: toolType=', toolType, '| hasOCR=', !!ocrText, '| images=', images?.length || 0);

    const result = await callAgnesAPI(
      env.AGNES_API_KEY,
      messages,
      isExpertMode ? 4096 : 2048,
      isExpertMode ? 0.7 : 0.9,
      isExpertMode
    );

    if (!result) {
      return new Response(JSON.stringify({ error: 'Empty response' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Generate function error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', message: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// 处理非 POST 请求
export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
};

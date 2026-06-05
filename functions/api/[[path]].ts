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

interface Env {
  AGNES_API_KEY?: string;
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
    const body = await request.json() as { prompt?: string; toolType?: ToolType; isExpertMode?: boolean; images?: string[] };
    const { prompt, toolType = 'general', isExpertMode = false, images } = body;

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 统一使用 agnes-2.0-flash（支持多模态）
    const model = 'agnes-2.0-flash';

    // 构建用户消息内容（支持图片）
    const userContent: any[] = [];

    // 如果有图片，提示模型先识别文字
    if (images && images.length > 0) {
      userContent.push({
        type: 'text',
        text: `${prompt}\n\n（如果上传了图片，请先识别图片中的文字内容，再进行分析。）`,
      });

      // 添加图片
      for (const img of images) {
        // 确保是完整的 data URL 格式
        let imageUrl = img;
        if (!imageUrl.startsWith('data:image/')) {
          imageUrl = `data:image/jpeg;base64,${imageUrl}`;
        }
        userContent.push({
          type: 'image_url',
          image_url: { url: imageUrl },
        });
      }
    } else {
      userContent.push({ type: 'text', text: prompt });
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

    console.log('Calling Agnes API with model:', model, '| Images:', images?.length || 0);

    // 调用 Agnes API
    const apiResponse = await fetch(`${AGNES_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.AGNES_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json().catch(() => ({}));
      console.error('Agnes API error:', apiResponse.status, errorData);
      if (apiResponse.status === 401 || apiResponse.status === 403) {
        return new Response(JSON.stringify({ error: 'KEY_INVALID', details: errorData }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'API request failed', details: errorData }), {
        status: apiResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await apiResponse.json();
    const result = data.choices?.[0]?.message?.content || '';

    if (!result) {
      return new Response(JSON.stringify({ error: 'Empty response', raw: JSON.stringify(data).slice(0, 500) }), {
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

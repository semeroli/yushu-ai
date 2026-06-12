/**
 * Cloudflare Pages Function - AI 生成接口
 * 路由: POST /api/generate
 * 平台: Cloudflare Pages
 */

const AGNES_API_BASE = 'https://apihub.agnes-ai.com/v1';

type ToolType = 'general' | 'ancient' | 'poetry' | 'lesson' | 'reading' | 'essay';

/* ================= 系统提示词（含 Few-shot 示例） ================= */
const TOOL_PROMPTS: Record<ToolType, string> = {
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
    '适合的导入方式、探究问题设计\n\n' +
    '示例输出片段：\n' +
    '「永州之野产异蛇」→「永州」地名，「之」结构助词「的」，「异」奇异，「产」出产。白话：永州的郊野出产一种奇异的蛇。文化常识：永州属唐代贬谪之地，柳宗元借此暗喻官场险恶。',

  poetry:
    '你是一位精通中国古典诗词的文学评论家与教育专家。请对输入的诗词进行深度鉴赏。\n\n' +
    '输出格式要求：\n' +
    '## 一、意象与意境\n' +
    '核心意象提取 → 象征意义 → 意境整体感受\n' +
    '## 二、情感脉络\n' +
    '诗人情感变化轨迹（起承转合）\n' +
    '## 三、艺术手法\n' +
    '比喻、拟人、用典、炼字、对仗等（标注具体诗句）\n' +
    '## 四、历史背景\n' +
    '创作缘起、诗人境遇、时代特征\n' +
    '## 五、名句意蕴\n' +
    '千古名句的多重解读\n' +
    '## 六、创作辅助（如需）\n' +
    '符合格律的诗词范例或修改建议\n\n' +
    '示例输出片段：\n' +
    '「大漠孤烟直，长河落日圆」→ 意象：大漠（辽阔荒凉）、孤烟（孤独坚毅）、长河（壮美永恒）、落日（苍茫沉郁）。手法：「直」「圆」二字炼字精妙，一纵一横构成立体空间。情感：从荒凉中见壮美，边塞诗人的开阔胸襟。',

  essay:
    '你是一位作文阅卷组组长，熟悉各类作文评分标准。请从四个维度批改作文，并给出预估分数。\n\n' +
    '评分维度与标准：\n' +
    '1. 语言表达（词汇丰富度、句式变化、修辞运用）→ 权重30%\n' +
    '2. 立意深度（中心是否明确深刻、有无独到见解）→ 权重30%\n' +
    '3. 结构逻辑（段落安排、过渡衔接、详略得当）→ 权重20%\n' +
    '4. 素材运用（论据贴切性、新颖性、丰富度）→ 权重20%\n\n' +
    '输出格式要求：\n' +
    '## 总分：XX/100\n' +
    '- 语言表达：XX/30\n' +
    '- 立意深度：XX/30\n' +
    '- 结构逻辑：XX/20\n' +
    '- 素材运用：XX/20\n' +
    '## 总评语\n' +
    '一句话概括全文优劣\n' +
    '## 分维度评语与修改建议\n' +
    '每个维度：优点 → 不足 → 具体修改建议（引用原文句子）\n' +
    '## 亮点摘录\n' +
    '2-3个写得好的句子或段落\n\n' +
    '示例输出片段：\n' +
    '总分：72/100\n' +
    '- 语言表达：22/30 → 句式较单一，建议「春天来了」改为「当第一缕春风拂过枝头，沉睡的花蕾悄然苏醒」\n' +
    '- 立意深度：20/30 → 中心明确但缺乏深度，「坚持就是胜利」可深化为「坚持的意义不在于结果，而在于过程中对自我的重塑」\n' +
    '- 结构逻辑：15/20 → 首尾呼应较好，但第二段与第三段缺乏过渡\n' +
    '- 素材运用：15/20 → 仅用了一个名人故事，建议补充反面素材形成对比',

  lesson:
    '你是一位特级语文教师，熟悉新课标要求。请根据输入内容编写完整教案。\n\n' +
    '输出格式要求：\n' +
    '## 一、教学目标\n' +
    '知识与技能 | 过程与方法 | 情感态度与价值观\n' +
    '## 二、教学重难点\n' +
    '重点（2-3条） | 难点（1-2条）\n' +
    '## 三、教学方法\n' +
    '主导方法 + 学法指导\n' +
    '## 四、教学过程\n' +
    '1. 导入（3-5分钟）→ 情境创设或悬念设置\n' +
    '2. 初读（5-8分钟）→ 整体感知、梳理脉络\n' +
    '3. 精读（15-20分钟）→ 重点句段品析、探究问题\n' +
    '4. 拓展（8-10分钟）→ 联系生活或跨文本比较\n' +
    '5. 小结（3分钟）→ 回扣目标\n' +
    '6. 作业 → 分层设计（基础+拓展）\n' +
    '## 五、板书设计\n' +
    '结构化板书示意图\n\n' +
    '示例输出片段：\n' +
    '导入：播放《春江花月夜》音频，提问「听到这段音乐，你脑海中浮现了什么画面？」→ 从听觉切入，唤起学生对春天意象的感性认知，为阅读《春》搭建情感桥梁。',

  reading:
    '你是一位阅读推广人，擅长文本深度解读与阅读策略指导。请针对输入文本进行深度解读。\n\n' +
    '输出格式要求：\n' +
    '## 一、内容梳理\n' +
    '人物关系图谱 | 核心情节脉络\n' +
    '## 二、主题解读\n' +
    '2-3个主题角度，每个附简要论证\n' +
    '## 三、艺术特色\n' +
    '叙事手法、语言风格、象征隐喻\n' +
    '## 四、探究性问题\n' +
    '3-5个有梯度的探究问题（基础→深入→开放）\n' +
    '## 五、推荐书目\n' +
    '3-5本同类阅读书目（附一句话推荐理由）\n' +
    '## 六、阅读策略\n' +
    '精读、略读、跳读的具体应用场景\n\n' +
    '示例输出片段：\n' +
    '探究性问题：\n' +
    '1. 基础：文中哪些细节暗示了主人公的内心矛盾？\n' +
    '2. 深入：作者为何选择这种叙事视角？换一种视角会怎样？\n' +
    '3. 开放：如果你是主人公，在那个关键抉择时刻你会怎么做？为什么？',
};

// 旧的 OCR 专用提示词已合并到主流程，不再单独使用

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
    const { prompt, toolType = 'general', isExpertMode = false, images, ocrText } = body;

    if (!prompt?.trim() && !ocrText?.trim() && !images?.length) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ========== 一步完成：图片直接 + 文字分析 ==========
    let finalPrompt = prompt;

    // 如果有 OCR 文本（前端已识别），加到提示词中
    if (ocrText?.trim()) {
      finalPrompt = `【原文】\n${ocrText.trim()}\n\n【要求】\n${prompt}`;
    }

    // 有图片但没有 OCR 文本时，提示词加上图片识别指引
    if (images?.length && !ocrText?.trim()) {
      const imageGuide: Record<ToolType, string> = {
        general: '请先识别图片中的文字内容，然后进行分析。',
        essay: '请先完整识别图片中的作文文字，然后从四个维度进行批改并评分。',
        poetry: '请先识别图片中的诗词文字，然后进行深度鉴赏。',
        ancient: '请先识别图片中的古诗文文字，然后进行全文鉴赏分析。',
        lesson: '请先识别图片中的文字内容，然后据此设计教案。',
        reading: '请先识别图片中的阅读材料文字，然后出题并解析。',
      };
      finalPrompt = `${imageGuide[toolType] || imageGuide.general}\n\n${finalPrompt}`;
    }

    const userContent: any[] = [{ type: 'text', text: finalPrompt }];

    // 有图片时直接传给模型（一步完成识别+分析）
    if (images && images.length > 0) {
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

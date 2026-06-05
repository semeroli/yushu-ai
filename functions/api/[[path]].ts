import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  AGNES_API_KEY: string;
}

const TOOL_PROMPTS: Record<string, string> = {
  ancient: `你是一位资深语文教育专家，擅长古诗文教学。请对提供的古诗文进行专业鉴赏，包括：
1. 作品背景与作者简介
2. 原文逐句解析（重点词汇、句式结构）
3. 艺术特色分析（修辞手法、表现技巧）
4. 思想情感解读
5. 教学建议（适合年级、教学重点、拓展活动）

请用中文回答，语言专业且易懂，适合教师备课参考。`,
  poetry: `你是一位古典诗词创作指导专家。请根据用户的需求：
1. 如果是创作请求：提供创作思路、格律要求、意象选择建议，并给出示范作品
2. 如果是修改请求：分析原作的格律、意境、用词问题，给出具体修改建议
3. 如果是赏析请求：从格律、意象、情感等角度进行专业解读

请用中文回答，注重实用性和教学价值。`,
  essay: `你是一位经验丰富的作文批改专家。请对提供的作文进行：
1. 总体评价（立意、结构、语言等方面的优缺点）
2. 逐段点评（具体指出问题和亮点）
3. 评分参考（按中考/高考标准给出预估分数区间）
4. 修改建议（具体可操作的改进方案）
5. 升格示范（对关键段落给出修改示例）

请用中文回答，评语要具体、有建设性，便于学生理解和改进。`,
  lesson: `你是一位优秀的语文教学设计专家。请根据提供的教学内容生成完整的教案，包括：
1. 教学目标（知识与技能、过程与方法、情感态度价值观）
2. 教学重难点
3. 教学准备
4. 教学过程（详细到每个环节的时间分配、师生活动、设计意图）
5. 板书设计
6. 作业设计
7. 教学反思要点

请用中文回答，教案要详实、可操作，符合新课程标准。`,
  reading: `你是一位阅读理解训练专家。请根据提供的阅读材料：
1. 设计5-8道阅读理解题（涵盖理解、分析、评价等不同层次）
2. 提供参考答案和评分标准
3. 给出解题思路指导
4. 标注每道题考查的能力点和对应课标要求

请用中文回答，题目设计要科学合理，难度适中。`,
  general: `你是一位专业的语文教学助手。请根据用户的问题提供：
1. 清晰准确的解答
2. 相关的教学资源推荐
3. 实用的教学建议

请用中文回答，语言专业、简洁、实用。`
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  try {
    const { prompt, type = 'general', expertMode, hasImage } = await request.json() as {
      prompt: string;
      type?: string;
      expertMode?: boolean;
      hasImage?: boolean;
    };

    if (!env.AGNES_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = TOOL_PROMPTS[type] || TOOL_PROMPTS.general;
    const model = hasImage ? 'agnes-image-2.1-flash' : 'agnes-2.0-flash';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    const requestBody: any = {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 4096
    };

    if (expertMode) {
      requestBody.enable_thinking = true;
    }

    const response = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.AGNES_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Agnes API error:', errorData);
      
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: 'Invalid API key' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No response';

    return new Response(JSON.stringify({ response: content }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return onRequestPost(context);
};

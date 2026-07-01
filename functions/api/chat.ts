/**
 * Cloudflare Pages Function - SenseNova DeepSeek V4 Flash 文本对话接口
 * 路由: POST /api/chat
 * 平台: Cloudflare Pages
 *
 * 功能:
 * - 流式输出（SSE），打字机体验
 * - 支持普通模式 / 专家模式（深度思考）
 * - IP 级别速率限制（复用 [[path]].ts 的 KV/内存降级逻辑）
 * - 复用安全响应头
 */

const SENSENOVA_BASE = 'https://token.sensenova.cn/v1';

// ================== 速率限制（复用内存 Map，无需 KV）===================
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;  // 文本对话频率可稍高

function getClientIP(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    request.headers.get('X-Real-IP') ||
    '127.0.0.1'
  );
}

async function checkRateLimit(request: Request): Promise<{ allowed: boolean; remaining: number }> {
  const ip = getClientIP(request);
  const now = Date.now();
  let state = inMemoryStore.get(ip);
  if (!state || now >= state.resetAt) {
    state = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }
  const newCount = state.count + 1;
  if (newCount > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  state.count = newCount;
  inMemoryStore.set(ip, state);
  return { allowed: true, remaining: RATE_LIMIT_MAX - newCount };
}

// ================== 统一安全头 ==================
const SECURE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function jsonResponse(data: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...SECURE_HEADERS, ...extraHeaders },
  });
}

// ================== Env ==================
interface Env {
  SENSENOVA_API_KEY?: string;
  SENSENOVA_MODEL?: string;             // 默认 deepseek-v4-flash
  SENSENOVA_THINKING_API_KEY?: string;   // 专家模式用 deepseek-v4-pro
}

// ================== 主处理 ==================
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // 速率限制
  const rl = await checkRateLimit(request);
  const rlHeaders: Record<string, string> = {
    'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
    'X-RateLimit-Remaining': String(rl.remaining),
  };
  if (!rl.allowed) {
    return jsonResponse({ error: 'RATE_LIMIT_EXCEEDED', message: '请求过于频繁，请稍后再试。' }, 429);
  }

  // API Key 检查
  if (!env.SENSENOVA_API_KEY) {
    return jsonResponse({ error: 'SERVICE_ERROR' }, 503, rlHeaders);
  }

  try {
    const body = await request.json() as {
      messages?: unknown[];
      prompt?: string;        // 兼容旧格式：传入 prompt 而非 messages
      systemPrompt?: string;
      isExpertMode?: boolean;
      stream?: boolean;
    };

    const { messages: rawMessages, prompt, systemPrompt, isExpertMode = false, stream = true } = body;

    // 两种调用方式：
    // 1. 传 messages（OpenAI 格式）—— 直接透传
    // 2. 传 prompt（简化格式）—— 自动组装 messages
    let apiMessages: unknown[];

    if (rawMessages && Array.isArray(rawMessages) && rawMessages.length > 0) {
      apiMessages = rawMessages;
    } else if (prompt) {
      apiMessages = [];
      if (systemPrompt) {
        apiMessages.push({ role: 'system', content: systemPrompt });
      }
      apiMessages.push({ role: 'user', content: prompt });
    } else {
      return jsonResponse({ error: 'INVALID_REQUEST', message: 'messages 或 prompt 至少必须提供一个。' }, 400);
    }

    // 选择模型
    const model = isExpertMode
      ? (env.SENSENOVA_THINKING_API_KEY ? (env.SENSENOVA_MODEL?.replace('flash', 'pro') || 'deepseek-v4-pro') : 'deepseek-v4-flash')
      : (env.SENSENOVA_API_KEY ? (env.SENSENOVA_MODEL || 'deepseek-v4-flash') : 'deepseek-v4-flash');

    const apiKey = isExpertMode
      ? (env.SENSENOVA_THINKING_API_KEY || env.SENSENOVA_API_KEY)
      : env.SENSENOVA_API_KEY;

    const requestBody: Record<string, unknown> = {
      model,
      messages: apiMessages,
      stream,
      max_tokens: isExpertMode ? 4096 : 2048,
      temperature: isExpertMode ? 0.7 : 0.9,
    };

    // 专家模式：开启深度思考
    if (isExpertMode) {
      requestBody.reasoning_level = 'high';
    }

    // 非流式：直接返回
    if (!stream) {
      const apiRes = await fetch(`${SENSENOVA_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!apiRes.ok) {
        console.error('SenseNova API error:', apiRes.status);
        return jsonResponse({ error: 'SERVICE_ERROR' }, 502);
      }

      const data = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content || '';
      return jsonResponse({ result: content, model }, 200, rlHeaders);
    }

    // 流式：代理 SSE
    const apiRes = await fetch(`${SENSENOVA_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!apiRes.ok) {
      console.error('SenseNova API error:', apiRes.status);
      return jsonResponse({ error: 'SERVICE_ERROR' }, 502);
    }

    if (!apiRes.body) {
      return jsonResponse({ error: 'EMPTY_RESPONSE' }, 502);
    }

    // 将上游 SSE 透传给客户端，同时注入安全头
    const encoder = new TextEncoder();
    const upstream = apiRes.body;
    const readable = new ReadableStream({
      async start(controller) {
        const reader = upstream.getReader();
        const decoder = new TextDecoder();

        // 先发送安全头（在 SSE data 之前一次性发送）
        const safePrefix = `data: [SAFE_HEADER]X-RateLimit-Remaining:${rl.remaining}|X-RateLimit-Limit:${RATE_LIMIT_MAX}\n\n`;
        controller.enqueue(encoder.encode(safePrefix));

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-RateLimit-Remaining': String(rl.remaining),
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
      },
    });
  } catch (err) {
    console.error('Chat function error:', err);
    return jsonResponse({ error: 'SERVICE_ERROR' }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
};

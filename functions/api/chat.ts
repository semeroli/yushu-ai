/**
 * Cloudflare Pages Function - AI 文本对话接口（智谱 / 魔塔社区，用 AI_PROVIDER 切换）
 * 路由: POST /api/chat
 * 平台: Cloudflare Pages
 *
 * 功能:
 * - 流式输出（SSE），打字机体验（OpenAI 兼容格式，前端无需改动）
 * - 模型候选链：按顺序尝试，先成功者胜（平台改模型名也能自动绕过）
 * - 每次尝试带握手超时，避免上游挂着不回被平台掐断
 * - IP 级别速率限制 + 安全响应头
 */

const ZHIPU_BASE = 'https://open.bigmodel.cn/api/paas/v4';
const MODELSCOPE_BASE = 'https://api-inference.modelscope.cn/v1';

type AIProvider = 'zhipu' | 'modelscope';
interface AISettings {
  provider: AIProvider;
  base: string;
  apiKey?: string;
  keyEnv: string;
  textModels: string[];
  visionModels: string[];
  expertModels: string[];
}

// 解析逗号分隔的模型列表；为空则用内置默认链（按顺序尝试，先成功者胜）
function parseList(raw: any, fallback: string[]): string[] {
  const list = String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : fallback;
}

// 根据环境变量决定用哪个大模型供应商。
// AI_PROVIDER=modelscope 时走魔塔社区（免费模型）；缺省走智谱。
// 两者均为 OpenAI 兼容接口，请求/响应格式一致。
function resolveAISettings(env: any): AISettings {
  const provider = (env.AI_PROVIDER || 'zhipu').toString().toLowerCase();
  if (provider === 'modelscope') {
    // 默认链取自「实测可用」的魔塔免费模型（2026-10-10 校准）
    const text = parseList(env.MODELSCOPE_MODEL, [
      'Qwen/Qwen3.8-Flash-Next',
      'deepseek-ai/DeepSeek-V4.1-Flash',
      'Shanghai_AI_Laboratory/Intern-S2-Preview',
    ]);
    const vision = parseList(env.MODELSCOPE_VISION_MODEL, [
      'deepseek-ai/DeepSeek-V4-Flash-Vision-Exp',
      'Shanghai_AI_Laboratory/Intern-S2-Preview',
    ]);
    return {
      provider: 'modelscope',
      base: MODELSCOPE_BASE,
      apiKey: env.MODELSCOPE_API_KEY,
      keyEnv: 'MODELSCOPE_API_KEY',
      textModels: text,
      visionModels: vision,
      expertModels: parseList(env.MODELSCOPE_EXPERT_MODEL, text),
    };
  }
  const text = parseList(env.ZHIPU_MODEL, ['glm-4-flash']);
  return {
    provider: 'zhipu',
    base: ZHIPU_BASE,
    apiKey: env.ZHIPU_API_KEY,
    keyEnv: 'ZHIPU_API_KEY',
    textModels: text,
    visionModels: parseList(env.ZHIPU_VISION_MODEL, ['glm-4v-plus']),
    expertModels: parseList(env.ZHIPU_EXPERT_MODEL, text),
  };
}

// 依次尝试模型候选链，返回第一个成功（2xx）的上游响应；全部失败返回 null。
// 每次尝试带 30 秒「握手」超时：避免某个模型挂着不回、把请求拖到被平台掐断（CF 502）。
async function openUpstream(
  base: string,
  apiKey: string,
  models: string[],
  payload: Record<string, unknown>
): Promise<{ res: Response | null; errors: string[] }> {
  const errors: string[] = [];
  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ ...payload, model }),
        signal: controller.signal,
      });
      if (!res.ok) {
        clearTimeout(timer);
        const note = (await res.text().catch(() => '')).slice(0, 160).replace(/\s+/g, ' ');
        errors.push(`${model} HTTP ${res.status} ${note}`);
        console.error(`Upstream ${model} error ${res.status}: ${note}`);
        continue;
      }
      clearTimeout(timer); // 握手成功，后续不再套超时
      return { res, errors };
    } catch (e: any) {
      clearTimeout(timer);
      const reason = e?.name === 'AbortError' ? '握手超时' : String(e?.message || e);
      errors.push(`${model} ${reason}`);
      console.error(`Upstream ${model} failed: ${reason}`);
      continue;
    }
  }
  return { res: null, errors };
}

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
  AI_PROVIDER?: string;          // 'zhipu'（默认）| 'modelscope'
  ZHIPU_API_KEY?: string;
  ZHIPU_MODEL?: string;          // 普通模式默认模型（如 glm-4-flash）
  ZHIPU_EXPERT_MODEL?: string;   // 专家模式使用的更强模型（可选，缺省回退到默认模型）
  MODELSCOPE_API_KEY?: string;
  MODELSCOPE_MODEL?: string;          // 魔塔文本默认模型
  MODELSCOPE_VISION_MODEL?: string;   // 魔塔视觉默认模型
  MODELSCOPE_EXPERT_MODEL?: string;   // 魔塔专家模型（可选）
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

  // 供应商与 Key 检查
  const ai = resolveAISettings(env);
  if (!ai.apiKey) {
    return jsonResponse({ error: 'SERVICE_ERROR', message: `${ai.keyEnv} 未配置` }, 503, rlHeaders);
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

    const models = isExpertMode ? ai.expertModels : ai.textModels;
    const apiKey = ai.apiKey as string;

    const payload: Record<string, unknown> = {
      messages: apiMessages,
      stream,
      max_tokens: isExpertMode ? 4096 : 2048,
      temperature: isExpertMode ? 0.7 : 0.9,
    };

    // 非流式：依次尝试候选模型，返回第一个成功的正文
    if (!stream) {
      const { res: apiRes, errors } = await openUpstream(ai.base, apiKey, models, { ...payload, stream: false });
      if (!apiRes) {
        return jsonResponse({ error: 'SERVICE_ERROR', detail: errors.join(' | ').slice(0, 300) }, 502, rlHeaders);
      }
      const data = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content || '';
      return jsonResponse({ result: content }, 200, rlHeaders);
    }

    // 流式：依次尝试候选模型，谁先握手成功就用谁，把它的 SSE 透传给客户端
    const { res: apiRes, errors } = await openUpstream(ai.base, apiKey, models, payload);

    if (!apiRes || !apiRes.body) {
      return jsonResponse({ error: 'SERVICE_ERROR', detail: errors.join(' | ').slice(0, 300) }, 502, rlHeaders);
    }

    // 将上游 SSE 直接透传给客户端：直接返回上游响应体，
    // 不再自行构造 ReadableStream（避免依赖 streams_enable_constructors 兼容标志，
    // 该标志在 Cloudflare Pages 中常需去控制台手动开启，不可靠）。
    // 前端 SSE 解析器对非 data: 行天然容错，去掉前缀 SAFE_HEADER 不影响功能。
    return new Response(apiRes.body, {
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

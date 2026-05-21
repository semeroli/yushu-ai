interface PagesFunction {
  (context: {
    request: Request;
    params: Record<string, string | string[]>;
    env: Record<string, any>;
  }): Promise<Response> | Response;
}

export const onRequest: PagesFunction = async (context) => {
  const { request, params, env } = context;

  /* ---------------- 安全加固（完全保留） ---------------- */
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  const isAllowedOrigin = referer && (
    referer.includes('localhost') ||
    referer.includes('127.0.0.1') ||
    (host && referer.includes(host))
  );

  if (!isAllowedOrigin) {
    return new Response(JSON.stringify({
      error: 'Unauthorized access',
      message: '语枢代理服务：拒绝非法外部调用。'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /* ---------------- 解析路径 ---------------- */
  const path = Array.isArray(params.path) ? params.path.join('/') : params.path;

  /* ---------------- 构造魔塔 API URL ---------------- */
  const targetUrl = new URL(`https://api-inference.modelscope.cn/${path}`);

  /* ---------------- 复制查询参数 ---------------- */
  const clientUrl = new URL(request.url);
  clientUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  /* ---------------- 注入魔塔 API Key ---------------- */
  if (!targetUrl.searchParams.has('key') && env.MODELSCOPE_API_KEY) {
    targetUrl.searchParams.set('key', env.MODELSCOPE_API_KEY);
  }

  /* ---------------- 过滤 Header ---------------- */
  const filteredHeaders = new Headers();
  const forbiddenHeaders = [
    'host', 'cf-connecting-ip', 'cf-ray', 'cf-visitor',
    'x-forwarded-for', 'x-real-ip', 'referer'
  ];

  request.headers.forEach((value, key) => {
    if (!forbiddenHeaders.includes(key.toLowerCase())) {
      filteredHeaders.set(key, value);
    }
  });

  /* ---------------- 转发请求 ---------------- */
  try {
    const modifiedRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers: filteredHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.clone().blob()
        : null,
      redirect: 'follow',
    });

    const response = await fetch(modifiedRequest);
    const newResponse = new Response(response.body, response);

    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return newResponse;
  } catch (err) {
    return new Response(JSON.stringify({
      error: '语枢代理服务转发失败',
      details: err instanceof Error ? err.message : String(err)
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

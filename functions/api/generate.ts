export const onRequestPost: PagesFunction<{ MODELSCOPE_API_KEY: string }> = async ({
  request,
  env,
}) => {
  console.log("✅ /api/generate invoked");

  /* ---------------- CORS ---------------- */
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  /* ---------------- 解析参数 ---------------- */
  let body: any;
  try {
    body = await request.json();
  } catch {
    console.error("❌ Invalid JSON body");
    return json({ error: "请求体必须是 JSON" }, 400);
  }

  const {
    prompt,
    systemPrompt = "你是一位资深的语文教学专家。",
    isPro = false,
    images = [],
  } = body;

  if (!prompt) {
    console.error("❌ Missing prompt");
    return json({ error: "prompt 不能为空" }, 400);
  }

  /* ---------------- 读取 Key ---------------- */
  const apiKey = env.MODELSCOPE_API_KEY;
  if (!apiKey) {
    console.error("❌ MODELSCOPE_API_KEY is missing");
    return json({ error: "MODELSCOPE_API_KEY 未配置" }, 500);
  }

  /* ---------------- 构造消息（严格对齐 ModelScope） ---------------- */
  const contentParts: any[] = [];

  if (Array.isArray(images) && images.length > 0) {
    images.forEach((img: string) => {
      const base64Data = img.split(",")[1];
      const mimeType = img.match(/data:([^;]+);/)?.[1] || "image/jpeg";
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${base64Data}`,
        },
      });
    });
  }

  contentParts.push({
    type: "text",
    text: prompt,
  });

  /* ---------------- 调用 DeepSeek ---------------- */
  console.log("🚀 Calling ModelScope API...");
  const res = await fetch(
    "https://api-inference.modelscope.cn/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V4-Pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contentParts },
        ],
        temperature: 0.7,
        max_tokens: isPro ? 4096 : 2048,
        stream: true,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("❌ ModelScope API Error:", err);
    return json({ error: "AI 服务异常", detail: err }, 500);
  }

  console.log("✅ Streaming started");

  /* ---------------- 流式透传 ---------------- */
  return new Response(res.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

/* ================= 工具 ================= */
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

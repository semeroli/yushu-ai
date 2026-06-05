export type ToolType = 'general' | 'ancient' | 'poetry' | 'lesson' | 'reading' | 'essay';

/**
 * OCR 识别图片中的文字
 * 调用后端 /api/generate?action=ocr
 */
export async function ocrImages(images: string[], prompt: string): Promise<string> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      toolType: 'general',
      isExpertMode: false,
      images,
      action: 'ocr',
    }),
  });

  if (!res.ok) {
    console.error('OCR request failed:', res.status);
    return '';
  }

  const data = await res.json();

  if (data.error === 'KEY_INVALID') {
    return 'ERROR_KEY_INVALID';
  }

  return data.ocrText || '';
}

/**
 * 调用后端代理接口，转发至 agnes-ai 多模态大模型
 * API 文档: https://agnes-ai.com/doc/agnes-20-flash
 *
 * Agnes API 特性:
 * - 基础模型: agnes-2.0-flash
 * - 支持多模态（图片 + 文字）
 * - OpenAI 兼容格式
 * - 专家模式启用 enable_thinking
 */
export async function generateTeachingResource(
  prompt: string,
  toolType: ToolType,
  isExpertMode: boolean,
  images?: string[],
  ocrText?: string
): Promise<string> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      toolType,
      isExpertMode,
      images,
      ocrText,
      action: 'generate',
    }),
  });

  if (!res.ok) {
    return `服务暂时不可用，请稍后再试。(HTTP ${res.status})`;
  }

  const data = await res.json();

  if (data.error === 'KEY_INVALID') {
    return 'ERROR_KEY_INVALID';
  }

  return data.result || '未获取到有效回复，请重试。';
}

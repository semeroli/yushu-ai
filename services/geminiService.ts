export type ToolType = 'general' | 'ancient' | 'poetry' | 'lesson' | 'reading' | 'essay';
export type GradeType = 'primary' | 'junior' | 'senior' | 'college';

export async function generateTeachingResource(
  prompt: string,
  toolType: ToolType,
  isExpertMode: boolean,
  images?: string[],
  ocrText?: string,
  grade?: GradeType
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
      grade: grade || 'junior',
    }),
  });

  if (res.status === 403) {
    return 'ACCESS_CODE_INVALID';
  }

  if (!res.ok) {
    return `服务暂时不可用，请稍后再试。(HTTP ${res.status})`;
  }

  const data = await res.json();
  if (data.error === 'KEY_INVALID') return 'ERROR_KEY_INVALID';
  return data.result || '未获取到有效回复，请重试。';
}

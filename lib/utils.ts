/**
 * P2 修复: 简化 cn() — 项目未使用 clsx/tailwind-merge，
 * 无需过度封装。保留基本实现以兼容现有调用点。
 */

type ClassValue = string | number | boolean | undefined | null | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat(Infinity)
    .filter((x): x is string => typeof x === 'string' && x.length > 0)
    .join(' ');
}

import { formatDecimal, parseDecimal } from './solver/decimal';

/**
 * 数值展示：保留至多 3 位小数并去掉多余的 0。
 *
 * 字符串按录入的十进制原文经 BigInt 定点精确舍入：即使整数部分超出双精度
 * 表示范围（如 9999999999999999.9），也不会被 Number() 舍入成上限值；
 * number 入参维持双精度下的旧展示行为（决胜启发式等近似场景）。
 */
export function fmt(x: number | string): string {
  if (typeof x === 'string') {
    const d = parseDecimal(x);
    if (d !== null) return formatDecimal(d, 3);
  }
  const n = typeof x === 'string' ? Number(x) : x;
  if (!Number.isFinite(n)) return '—';
  const v = Math.round(n * 1000) / 1000;
  return Object.is(v, -0) ? '0' : String(v);
}

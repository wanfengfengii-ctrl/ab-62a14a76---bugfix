import { formatDecimal, parseDecimal } from './solver/decimal';

/** 数值展示：保留至多 3 位小数并去掉多余的 0。 */
export function fmt(x: number | string): string {
  const n = typeof x === 'string' ? Number(x) : x;
  if (!Number.isFinite(n)) return '—';
  const v = Math.round(n * 1000) / 1000;
  return Object.is(v, -0) ? '0' : String(v);
}

/**
 * 按录入的十进制值精确展示（BigInt 定点直接格式化）：
 * 整数部分超出双精度表示范围时（如 9999999999999999.9 会被 Number
 * 舍入为 10000000000000000），仍呈现录入原文对应的精确数值。
 * 非法输入回退到普通展示。
 */
export function fmtExact(x: number | string): string {
  const d = parseDecimal(typeof x === 'string' ? x : String(x));
  if (d === null) return fmt(x);
  return formatDecimal(d);
}

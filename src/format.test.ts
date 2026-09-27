import { describe, expect, it } from 'vitest';
import { fmt } from './format';

describe('fmt · 展示格式化', () => {
  it('常规 number 维持至多 3 位小数并去尾零', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(-0)).toBe('0');
    expect(fmt(1)).toBe('1');
    expect(fmt(1.2345)).toBe('1.235');
    expect(fmt(0.1)).toBe('0.1');
    expect(fmt(NaN)).toBe('—');
    expect(fmt(Infinity)).toBe('—');
  });

  it('字符串按精确十进制舍入：超大整数部分的小数差不被双精度吞没', () => {
    // 回归：9999999999999999.9 经 Number() 会舍入成 10000000000000000
    expect(fmt('9999999999999999.9')).toBe('9999999999999999.9');
    expect(fmt('10000000000000000')).toBe('10000000000000000');
    expect(fmt('0.100')).toBe('0.1');
    expect(fmt('0')).toBe('0');
    // 至多 3 位小数：精确四舍五入
    expect(fmt('1.2345')).toBe('1.235');
    expect(fmt('9999999999999999.9996')).toBe('10000000000000000');
    expect(fmt('2500000000000000.025')).toBe('2500000000000000.025');
  });
});

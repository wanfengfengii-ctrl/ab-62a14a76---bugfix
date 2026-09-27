import { describe, expect, it } from 'vitest';
import { fmt, fmtExact } from './format';

describe('fmt', () => {
  it('保留至多 3 位小数并去掉多余的 0', () => {
    expect(fmt(1)).toBe('1');
    expect(fmt(0.1 + 0.2)).toBe('0.3');
    expect(fmt(2.5)).toBe('2.5');
    expect(fmt(-0)).toBe('0');
    expect(fmt(NaN)).toBe('—');
    expect(fmt('12.3456')).toBe('12.346');
  });
});

describe('fmtExact', () => {
  it('按录入十进制值精确展示，不受双精度舍入影响', () => {
    // Number('9999999999999999.9') === 1e16：字符串原文必须精确呈现。
    expect(fmtExact('9999999999999999.900')).toBe('9999999999999999.9');
    expect(fmtExact('10000000000000000')).toBe('10000000000000000');
    expect(fmtExact('0.100')).toBe('0.1');
    expect(fmtExact('-7.50')).toBe('-7.5');
  });

  it('非法输入回退到普通展示', () => {
    expect(fmtExact('abc')).toBe('—');
  });
});

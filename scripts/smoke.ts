/**
 * 一次性冒烟脚本（verify 服务）：
 *  1. 对裁决业务模块跑确定性用例（可行 / 不可行）；
 *  2. 探测已启动页面的健康端点 /healthz；
 *  3. 探测首页可访问。
 * 全部通过以退出码 0 结束，否则退出码 1。
 */
import { adjudicate } from '../src/solver/adjudicate';
import type { Scenario } from '../src/solver/types';

const base = `http://${process.env.WEB_HOST ?? 'web'}:${process.env.WEB_PORT ?? '8080'}`;

let failures = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

// ---------- 1. 裁决业务模块冒烟 ----------

// 可行场景：余量 5 的方案中 b1@M2 + b2@M1 总代价 8 最小，次序按录入序号决胜。
const feasibleScenario: Scenario = {
  rails: [
    { id: 'L', name: 'L', coordinate: -2 },
    { id: 'M1', name: 'M1', coordinate: 0 },
    { id: 'M2', name: 'M2', coordinate: 0 },
    { id: 'R', name: 'R', coordinate: 2 },
  ],
  blocks: [
    { id: 'b1', name: 'b1', mass: 2, options: [{ railId: 'M1', cost: 8 }, { railId: 'M2', cost: 3 }, { railId: 'R', cost: 1 }] },
    { id: 'b2', name: 'b2', mass: 2, options: [{ railId: 'M1', cost: 5 }, { railId: 'M2', cost: 6 }, { railId: 'L', cost: 1 }] },
  ],
  limits: { maxLoad: 100, minTorque: -5, maxTorque: 5 },
};

const r1 = adjudicate(feasibleScenario);
check(r1.feasible, '裁决模块：可行场景应判定为可行');
if (r1.feasible) {
  check(r1.plan.steps.length === 2, '裁决模块：方案应覆盖全部配重（每块恰用一次）');
  check(
    r1.plan.steps.every((s) => Math.abs(s.cumulativeTorque) <= 5 + 1e-9 && s.cumulativeMass <= 100 + 1e-9),
    '裁决模块：每个前缀状态均满足载荷与力矩限制',
  );
  check(Math.abs(r1.plan.totalCost - 8) < 1e-9, `裁决模块：总安装代价应为 8（实际 ${r1.plan.totalCost}）`);
  check(Math.abs(r1.plan.minTorqueMargin - 5) < 1e-9, `裁决模块：力矩余量应为 5（实际 ${r1.plan.minTorqueMargin}）`);
  check(
    r1.plan.steps[0].railId === 'M2' && r1.plan.steps[1].railId === 'M1',
    '裁决模块：挂装位置与次序应符合决胜规则（b1@M2 → b2@M1）',
  );
}

// 不可行场景：深度 1 即止步，最深前缀为 b1@R（余量最大），剩余选择同时触发载荷与力矩限制。
const infeasibleScenario: Scenario = {
  rails: [{ id: 'R', name: 'R', coordinate: 1 }],
  blocks: [
    { id: 'b1', name: 'b1', mass: 3, options: [{ railId: 'R', cost: 1 }] },
    { id: 'b2', name: 'b2', mass: 4, options: [{ railId: 'R', cost: 1 }] },
    { id: 'b3', name: 'b3', mass: 5, options: [{ railId: 'R', cost: 1 }] },
  ],
  limits: { maxLoad: 6, minTorque: -5, maxTorque: 5 },
};

const r2 = adjudicate(infeasibleScenario);
check(!r2.feasible, '裁决模块：不可行场景应判定为不可行');
if (!r2.feasible) {
  check(r2.report.witnessPrefix.length === 1, '裁决模块：应给出最深可行已选前缀（长度 1）');
  check(
    r2.report.witnessPrefix[0]?.blockIndex === 0,
    '裁决模块：已选前缀应取余量最大的 b1',
  );
  check(
    r2.report.violations.length === 2 &&
      r2.report.violations.every((v) => v.kinds.includes('load') && v.kinds.includes('torque-high')),
    '裁决模块：应列出剩余选择触发的载荷/力矩限制',
  );
}

// 小数边界场景：4 块 0.2500000001 总质量 1.0000000004，按录入十进制值已超上限 1，
// 必须判无可行方案；前三步为安全前缀，第 4 步两个导轨选择均报告总载荷超限。
const decimalBoundaryScenario: Scenario = {
  rails: [
    { id: 'M1', name: 'M1', coordinate: 0 },
    { id: 'M2', name: 'M2', coordinate: 0 },
  ],
  blocks: [0, 1, 2, 3].map((i) => ({
    id: `b${i}`,
    name: `b${i}`,
    mass: 0.2500000001,
    options: [
      { railId: 'M1', cost: 1 },
      { railId: 'M2', cost: 1 },
    ],
  })),
  limits: { maxLoad: 1, minTorque: 0, maxTorque: 0 },
};

const r3 = adjudicate(decimalBoundaryScenario);
check(!r3.feasible, '裁决模块：总质量 1.0000000004 对上限 1 应判定为不可行');
if (!r3.feasible) {
  check(
    r3.report.witnessPrefix.length === 3 &&
      r3.report.witnessPrefix.every((s) => s.cumulativeTorque === 0 && s.loadMargin >= 0),
    '裁决模块：小数边界场景的前三步应为安全前缀（长度 3）',
  );
  check(
    r3.report.violations.length === 2 &&
      r3.report.violations.every((v) => v.blockIndex === 3 && v.kinds.length === 1 && v.kinds[0] === 'load'),
    '裁决模块：第 4 步的两个导轨选择均应报告总载荷超限',
  );
}

// 超大整数部分十进制场景：4 块 2500000000000000.025 按录入十进制值合计 10000000000000000.100
// （整数部分已超出双精度表示范围），对上限 10000000000000000 真实超限 0.1，
// 必须判无可行方案；前三块为安全前缀，第 4 块的两个导轨选择均报告总载荷超限。
const hugeDecimalScenario: Scenario = {
  rails: [
    { id: 'M1', name: 'M1', coordinate: 0 },
    { id: 'M2', name: 'M2', coordinate: 0 },
  ],
  blocks: [0, 1, 2, 3].map((i) => ({
    id: `h${i}`,
    name: `h${i}`,
    mass: '2500000000000000.025',
    options: [
      { railId: 'M1', cost: 1 },
      { railId: 'M2', cost: 1 },
    ],
  })),
  limits: { maxLoad: '10000000000000000', minTorque: 0, maxTorque: 0 },
};

const r4 = adjudicate(hugeDecimalScenario);
check(!r4.feasible, '裁决模块：超大十进制总质量 10000000000000000.100 对上限 1e16 应判定为不可行');
if (!r4.feasible) {
  check(
    r4.report.witnessPrefix.length === 3 &&
      r4.report.witnessPrefix.every((s) => s.cumulativeTorque === 0 && s.loadMargin >= 0),
    '裁决模块：超大十进制场景的前三块应构成安全挂装前缀（长度 3）',
  );
  check(
    r4.report.violations.length === 2 &&
      r4.report.violations.every((v) => v.blockIndex === 3 && v.kinds.length === 1 && v.kinds[0] === 'load'),
    '裁决模块：第 4 块的两个导轨选择均应报告总载荷超限',
  );
}

// 超大整数部分但仍有 0.1 余量的可行场景：4 块 2499999999999999.975 精确合计
// 9999999999999999.900（双精度会舍入成 1e16），真实载荷余量 0.1，必须判可行；
// 逐步余量与最终摘要须一致显示精确质量 9999999999999999.9 与余量 0.1。
const hugeFeasibleScenario: Scenario = {
  rails: [
    { id: 'M1', name: 'M1', coordinate: 0 },
    { id: 'M2', name: 'M2', coordinate: 0 },
  ],
  blocks: [0, 1, 2, 3].map((i) => ({
    id: `f${i}`,
    name: `f${i}`,
    mass: '2499999999999999.975',
    options: [
      { railId: 'M1', cost: 0 },
      { railId: 'M2', cost: 0 },
    ],
  })),
  limits: { maxLoad: '10000000000000000', minTorque: 0, maxTorque: 0 },
};

const r5 = adjudicate(hugeFeasibleScenario);
check(r5.feasible, '裁决模块：超大十进制总质量 9999999999999999.900（余量 0.1）应判定为可行');
if (r5.feasible) {
  const lastStep = r5.plan.steps[r5.plan.steps.length - 1];
  check(
    lastStep.exact.cumulativeMass === '9999999999999999.9' && lastStep.exact.loadMargin === '0.1',
    `裁决模块：逐步信息应精确显示质量 9999999999999999.9 与余量 0.1（实际 ${lastStep.exact.cumulativeMass}，余量 ${lastStep.exact.loadMargin}）`,
  );
  check(
    r5.plan.exact.finalMass === '9999999999999999.9' &&
      r5.plan.exact.loadMargin === '0.1' &&
      r5.plan.exact.finalMass === lastStep.exact.cumulativeMass &&
      r5.plan.exact.loadMargin === lastStep.exact.loadMargin,
    `裁决模块：摘要应与逐步一致（实际质量 ${r5.plan.exact.finalMass}，余量 ${r5.plan.exact.loadMargin}）`,
  );
}

// 对照：真正恰好达到上限（4 × 2500000000000000 = 1e16）仍判可行且余量精确为 0。
const hugeExactScenario: Scenario = {
  rails: [
    { id: 'M1', name: 'M1', coordinate: 0 },
    { id: 'M2', name: 'M2', coordinate: 0 },
  ],
  blocks: [0, 1, 2, 3].map((i) => ({
    id: `x${i}`,
    name: `x${i}`,
    mass: '2500000000000000',
    options: [
      { railId: 'M1', cost: 0 },
      { railId: 'M2', cost: 0 },
    ],
  })),
  limits: { maxLoad: '10000000000000000', minTorque: 0, maxTorque: 0 },
};

const r6 = adjudicate(hugeExactScenario);
check(
  r6.feasible && r6.plan.exact.finalMass === '10000000000000000' && r6.plan.exact.loadMargin === '0',
  '裁决模块：恰好达到上限的方案应判可行且余量精确显示 0',
);

// ---------- 2. 已启动页面健康端点冒烟 ----------

const deadline = Date.now() + 60_000;
let health: { status?: string } | null = null;
while (Date.now() < deadline) {
  try {
    const res = await fetch(`${base}/healthz`);
    if (res.ok) {
      health = (await res.json()) as { status?: string };
      break;
    }
  } catch {
    // 页面尚未就绪，继续等待
  }
  await new Promise((r) => setTimeout(r, 1000));
}
check(health !== null && health.status === 'ok', `健康端点 ${base}/healthz 应返回 status=ok`);

// ---------- 3. 首页可访问 ----------

try {
  const res = await fetch(`${base}/`);
  const html = await res.text();
  check(res.ok && html.includes('id="root"'), `首页 ${base}/ 应返回包含挂载点的 HTML`);
} catch {
  check(false, `首页 ${base}/ 请求失败`);
}

if (failures > 0) {
  console.error(`\nsmoke: ${failures} 项未通过`);
  process.exit(1);
}
console.log('\nsmoke: 全部通过');

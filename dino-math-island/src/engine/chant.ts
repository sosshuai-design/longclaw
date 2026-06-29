// 乘法口诀文本（九九表口径）。与 scripts/gen-curriculum.mjs 的逻辑一致，
// 既用于口诀馆兜底，也保证 curriculum 里没有的格子（如 1×1）也能正确朗读。

const ONES = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 把乘积读成中文：10 读「一十」，其余按常规 */
export function cnNumber(p: number): string {
  if (p < 10) return ONES[p - 1];
  if (p === 10) return "一十";
  if (p < 20) return "十" + ONES[p - 10 - 1];
  const tens = Math.floor(p / 10);
  const one = p % 10;
  return ONES[tens - 1] + "十" + (one ? ONES[one - 1] : "");
}

/** 一句口诀：小数在前，积<10 用「得」（如 二三得六 / 三四十二 / 九九八十一） */
export function chantText(a: number, b: number): string {
  const small = Math.min(a, b);
  const big = Math.max(a, b);
  const p = a * b;
  const prefix = ONES[small - 1] + ONES[big - 1];
  return p < 10 ? `${prefix}得${cnNumber(p)}` : `${prefix}${cnNumber(p)}`;
}

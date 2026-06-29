// 自适应难度（开发文档 §5.1）。目标把成功率稳定在 75%–85%（心流通道）。
// 纯逻辑，可单测。参数集中成常量，便于后续按真实数据调。

export const UP_STREAK = 3; // 连续答对几题升档
export const DOWN_STREAK = 2; // 连续答错几题降档
export const TARGET = 0.78;

export interface AdaptiveState {
  level: number;
  maxLevel: number; // 该知识点档数（受 Settings.maxDifficulty 限制后）
  window: boolean[]; // 最近若干题对错（调档后清空，避免抖动）
}

export type AdjustDir = "up" | "down" | null;

/** 开局摸底：用前 N 题答对数初始化难度档 */
export function initLevelFromCalibration(corrects: number, maxLevel: number): number {
  // 0~1 对 → L1；2 对 → L2；3 对 → L3（不超过 maxLevel）
  const lvl = corrects <= 1 ? 1 : corrects === 2 ? 2 : 3;
  return Math.min(lvl, Math.max(1, maxLevel));
}

export function createAdaptiveState(level: number, maxLevel: number): AdaptiveState {
  return { level: Math.min(Math.max(level, 1), maxLevel), maxLevel, window: [] };
}

/** 每答一题后评估是否调档；返回方向（升/降/不变） */
export function evaluate(state: AdaptiveState, correct: boolean): AdjustDir {
  state.window.push(correct);

  const tail = (n: number) => state.window.slice(-n);
  const allTrue = (n: number) => state.window.length >= n && tail(n).every((x) => x);
  const allFalse = (n: number) => state.window.length >= n && tail(n).every((x) => !x);

  if (allTrue(UP_STREAK) && state.level < state.maxLevel) {
    state.level += 1;
    state.window = []; // 冷却
    return "up";
  }
  if (allFalse(DOWN_STREAK) && state.level > 1) {
    state.level -= 1;
    state.window = [];
    return "down";
  }
  return null;
}

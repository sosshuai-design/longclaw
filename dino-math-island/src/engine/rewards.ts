// 金币 / 宝箱 / 宠物进化（开发文档 §5.4 / §6.1 / §6.3）。无任何付费抽卡。

export function coinsForCorrect(level: number): number {
  return 5 + level;
}

export interface ChestResult {
  coins: number;
  gotSticker: boolean;
  stickerId: number;
}

/** 一轮结束开宝箱 */
export function openChest(correct: number, total: number): ChestResult {
  const perfect = correct === total && total > 0;
  const coins = 10 + Math.floor(Math.random() * 31) + (perfect ? 20 : 0); // 10~40 (+20 满分)
  const gotSticker = Math.random() < 0.5;
  const stickerId = Math.floor(Math.random() * 24); // 贴纸册 0..23
  return { coins, gotSticker, stickerId };
}

// —— 宠物进化：阈值由 masteredCount 决定 ——
export interface PetStage {
  index: number;
  at: number;
  emoji: string;
  name: string;
}

export const PET_STAGES: PetStage[] = [
  { index: 0, at: 0, emoji: "🥚", name: "恐龙蛋" },
  { index: 1, at: 1, emoji: "🐣", name: "破壳龙" },
  { index: 2, at: 3, emoji: "🦎", name: "幼龙" },
  { index: 3, at: 6, emoji: "🦕", name: "长颈龙" },
  { index: 4, at: 10, emoji: "🐲", name: "飞龙" },
];

export function petStageFor(masteredCount: number): PetStage {
  let stage = PET_STAGES[0];
  for (const s of PET_STAGES) if (masteredCount >= s.at) stage = s;
  return stage;
}

/** 距离下一次进化还需几个掌握点（已满级返回 null） */
export function nextEvolveInfo(masteredCount: number): { need: number; next: PetStage } | null {
  const next = PET_STAGES.find((s) => s.at > masteredCount);
  if (!next) return null;
  return { need: next.at - masteredCount, next };
}

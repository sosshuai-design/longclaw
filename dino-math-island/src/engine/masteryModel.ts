// 掌握度模型（开发文档 §5.2）。纯逻辑，可单测。

import type { MasteryRecord, MasteryStatus } from "./types";

const DAY = 24 * 60 * 60 * 1000;
const REVIEW_INTERVALS_DAYS = [1, 3, 7, 16]; // 间隔重复

export function newRecord(kpId: string): MasteryRecord {
  return {
    kpId,
    score: 0,
    status: "locked",
    lastPracticed: 0,
    attempts: 0,
    corrects: 0,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function deriveStatus(r: MasteryRecord, threshold: number): MasteryStatus {
  if (r.score >= threshold) return "mastered";
  if (r.score > 0) return "learning";
  return "locked";
}

/** 答题后更新一条掌握度记录，返回新对象（不可变） */
export function onAnswer(
  record: MasteryRecord,
  correct: boolean,
  responseMs: number,
  threshold: number,
  now = Date.now()
): MasteryRecord {
  const base = correct ? 12 : -8;
  const speedBonus = correct && responseMs < 4000 ? 3 : 0;
  const score = clamp(record.score + base + speedBonus, 0, 100);
  const next: MasteryRecord = {
    ...record,
    score,
    attempts: record.attempts + 1,
    corrects: record.corrects + (correct ? 1 : 0),
    lastPracticed: now,
  };
  next.status = deriveStatus(next, threshold);
  if (next.status === "mastered") {
    next.nextReviewAt = now + REVIEW_INTERVALS_DAYS[0] * DAY;
  }
  return next;
}

/** 每日衰减：未练习的已掌握项掉分，跌破阈值转 review */
export function applyDailyDecay(
  record: MasteryRecord,
  threshold: number,
  decay = 2,
  now = Date.now()
): MasteryRecord {
  if (record.status !== "mastered") return record;
  if (now - record.lastPracticed < DAY) return record;
  const score = clamp(record.score - decay, 0, 100);
  const next = { ...record, score };
  next.status = score < threshold ? "review" : "mastered";
  return next;
}

/** 统计已掌握知识点数（驱动宠物进化） */
export function countMastered(mastery: Record<string, MasteryRecord>): number {
  return Object.values(mastery).filter((r) => r.status === "mastered").length;
}

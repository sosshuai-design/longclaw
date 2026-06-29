// 看板统计辅助（纯函数）。开发文档 §6.6。

import type { Curriculum, DayStat, KnowledgePoint, MasteryRecord, Profile } from "./types";
import { kpById } from "./curriculum";

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export function todayKey(now = Date.now()): string {
  return dateKey(new Date(now));
}

export function yesterdayKey(now = Date.now()): string {
  return dateKey(new Date(now - DAY));
}

const EMPTY: DayStat = { answered: 0, correct: 0, timeMs: 0 };

export function statOf(daily: Record<string, DayStat>, key: string): DayStat {
  return daily[key] ?? EMPTY;
}

export function accuracy(s: DayStat): number {
  return s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
}

/** 最近 n 天（从旧到新）：用于本周时长柱状图 */
export function lastNDays(
  daily: Record<string, DayStat>,
  n = 7,
  now = Date.now()
): { key: string; label: string; stat: DayStat }[] {
  const out: { key: string; label: string; stat: DayStat }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    const key = dateKey(d);
    out.push({ key, label: `周${WEEKDAY[d.getDay()]}`, stat: statOf(daily, key) });
  }
  return out;
}

/** 本周新掌握的知识点数（lastPracticed 在最近 7 天内且已掌握） */
export function newlyMasteredThisWeek(
  mastery: Record<string, MasteryRecord>,
  now = Date.now()
): number {
  return Object.values(mastery).filter(
    (r) => r.status === "mastered" && now - r.lastPracticed < 7 * DAY
  ).length;
}

/** 错题：有过做错的知识点（attempts>corrects），按错误次数降序 */
export function mistakeList(
  cur: Curriculum,
  mastery: Record<string, MasteryRecord>
): { kp: KnowledgePoint; wrong: number }[] {
  return Object.values(mastery)
    .map((r) => ({ kp: kpById(cur, r.kpId), wrong: r.attempts - r.corrects }))
    .filter((x): x is { kp: KnowledgePoint; wrong: number } => !!x.kp && x.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong);
}

/** 当天首次练习时更新连续天数 */
export function nextStreak(profile: Profile, now = Date.now()): number {
  const today = todayKey(now);
  if (profile.lastActiveDay === today) return profile.streakDays; // 今天已记
  if (profile.lastActiveDay === yesterdayKey(now)) return profile.streakDays + 1;
  return 1;
}

// 加载 / 解析 curriculum-content.json，并提供查询辅助。

import type { Curriculum, KnowledgePoint, Unit, MasteryRecord } from "./types";

let cache: Curriculum | null = null;

/** 从 public/ 加载课程内容（只加载一次） */
export async function loadCurriculum(
  url = `${import.meta.env.BASE_URL}curriculum-content.json`
): Promise<Curriculum> {
  if (cache) return cache;
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`课程文件加载失败：HTTP ${res.status}`);
  const data = (await res.json()) as Curriculum;
  if (!data?.knowledgePoints?.length) throw new Error("课程内容为空或格式不对。");
  cache = data;
  return data;
}

export function kpById(cur: Curriculum, id: string): KnowledgePoint | undefined {
  return cur.knowledgePoints.find((k) => k.id === id);
}

/** 某单元的知识点，按课程顺序 */
export function kpsByUnit(cur: Curriculum, unit: Unit): KnowledgePoint[] {
  return cur.knowledgePoints
    .filter((k) => k.unit === unit)
    .sort((a, b) => a.order - b.order);
}

/** 前置是否都已掌握（决定知识点 / 单元是否解锁） */
export function isKpUnlocked(
  kp: KnowledgePoint,
  mastery: Record<string, MasteryRecord>
): boolean {
  return kp.prerequisites.every((pid) => mastery[pid]?.status === "mastered");
}

/** 选出某单元本轮要练的知识点：按顺序第一个「未掌握且已解锁」的，否则该单元最后一个 */
export function pickKpForUnit(
  cur: Curriculum,
  unit: Unit,
  mastery: Record<string, MasteryRecord>
): KnowledgePoint | undefined {
  const kps = kpsByUnit(cur, unit);
  const next = kps.find(
    (k) => isKpUnlocked(k, mastery) && mastery[k.id]?.status !== "mastered"
  );
  return next ?? kps[kps.length - 1];
}

/** 单元的第一个知识点（按顺序） */
export function firstKpOfUnit(cur: Curriculum, unit: Unit): KnowledgePoint | undefined {
  return kpsByUnit(cur, unit)[0];
}

/** 单元是否解锁：以该单元第一个知识点的前置是否都已掌握为准（开发文档 §6.1） */
export function isUnitUnlocked(
  cur: Curriculum,
  unit: Unit,
  mastery: Record<string, MasteryRecord>
): boolean {
  const first = firstKpOfUnit(cur, unit);
  return !!first && isKpUnlocked(first, mastery);
}

/** 解锁某单元还差哪些前置（返回知识点中文名，用于锁定提示） */
export function unitLockBlockers(
  cur: Curriculum,
  unit: Unit,
  mastery: Record<string, MasteryRecord>
): string[] {
  const first = firstKpOfUnit(cur, unit);
  if (!first) return [];
  return first.prerequisites
    .filter((pid) => mastery[pid]?.status !== "mastered")
    .map((pid) => kpById(cur, pid)?.name ?? pid);
}

/** 单元综合掌握度（0..100，该单元所有知识点平均分） */
export function unitMasteryPct(
  cur: Curriculum,
  unit: Unit,
  mastery: Record<string, MasteryRecord>
): number {
  const kps = kpsByUnit(cur, unit);
  if (kps.length === 0) return 0;
  const sum = kps.reduce((acc, k) => acc + (mastery[k.id]?.score ?? 0), 0);
  return Math.round(sum / kps.length);
}

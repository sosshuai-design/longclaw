// 课程引擎：加载 curriculum-content.json，并把每座小岛展开成一组题目。
//
// 这一层是「内容」与「玩法」之间的桥梁：
//   - 想换课程，只改 curriculum-content.json；
//   - 想加题型，去 activities.js 注册，再在 JSON 里用它的 activityType。

import { ACTIVITIES, hasActivity } from "./activities.js";

const DEFAULTS = {
  questionsPerIsland: 5,
  starsThresholds: [3, 4, 5],
};

/** 加载并校验课程内容 */
export async function loadCurriculum(url = "./curriculum-content.json") {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`课程文件加载失败：HTTP ${res.status}`);
  const data = await res.json();

  const meta = { ...DEFAULTS, ...(data.meta || {}) };
  const islands = (data.islands || []).map((isle) => ({
    ...isle,
    config: isle.config || {},
    supported: hasActivity(isle.activityType),
  }));

  const usable = islands.filter((i) => i.supported);
  if (usable.length === 0) {
    throw new Error("课程里没有可用的关卡（activityType 都不被支持）。");
  }
  const skipped = islands.filter((i) => !i.supported);
  if (skipped.length) {
    console.warn(
      "[恐龙数学岛] 跳过暂不支持的题型：",
      skipped.map((i) => `${i.id}(${i.activityType})`).join(", ")
    );
  }

  return { meta, islands: usable };
}

/**
 * 把一座小岛展开成本次游玩的题目列表。
 * @returns {{activity:object, question:object}[]}
 */
export function buildSession(island, meta) {
  const activity = ACTIVITIES[island.activityType];
  const count = island.config.questions ?? meta.questionsPerIsland ?? 5;
  const session = [];
  for (let i = 0; i < count; i++) {
    session.push({ activity, question: activity.generate(island.config) });
  }
  return session;
}

/** 根据首次答对数量算星星（0~3） */
export function starsFor(firstTryCorrect, meta) {
  const th = meta.starsThresholds || DEFAULTS.starsThresholds;
  return th.reduce((stars, need) => stars + (firstTryCorrect >= need ? 1 : 0), 0);
}

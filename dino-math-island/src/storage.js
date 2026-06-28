// 进度存储：记录每座小岛获得的最高星数（localStorage）。

const KEY = "dino-math-progress";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch (_) {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (_) {
    /* 存储不可用就算了，不影响游玩 */
  }
}

/** 取某座岛的最高星数（0~3） */
export function getStars(islandId) {
  return readAll()[islandId] || 0;
}

/** 记录一次成绩，只在比历史更高时更新 */
export function recordStars(islandId, stars) {
  const all = readAll();
  if ((all[islandId] || 0) < stars) {
    all[islandId] = stars;
    writeAll(all);
  }
}

/** 所有岛累计星数 */
export function totalStars() {
  return Object.values(readAll()).reduce((a, b) => a + b, 0);
}

/** 清空全部进度（家长设置里用） */
export function resetProgress() {
  writeAll({});
}

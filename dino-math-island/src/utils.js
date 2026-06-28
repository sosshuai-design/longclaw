// 通用小工具：DOM 构造、随机数、洗牌、取数等。

/** 创建元素的简写：el('div', {class:'x'}, [child1, '文本']) */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "dataset") {
      Object.assign(node.dataset, v);
    } else {
      node.setAttribute(k, v);
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

/** 清空一个节点 */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** [min, max] 闭区间随机整数 */
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 数组随机一项 */
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 原地 Fisher–Yates 洗牌，返回同一数组 */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 生成 [start, end] 闭区间的整数数组 */
export function range(start, end) {
  const out = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

/**
 * 生成一组互不相同的「数字选项」，必定包含 correct。
 * count 个，全部落在 [min, max] 内（会自动扩展边界以凑够数量）。
 */
export function numberChoices(correct, count, min, max) {
  const set = new Set([correct]);
  let lo = min;
  let hi = max;
  // 防止区间太小凑不够选项
  while (hi - lo + 1 < count) {
    if (lo > 0) lo--;
    else hi++;
  }
  let guard = 0;
  while (set.size < count && guard++ < 200) {
    set.add(randInt(lo, hi));
  }
  return shuffle([...set]);
}

/** 等待 ms 毫秒 */
export function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 活动（题型）注册表。
// 每种题型提供 generate(config)->question 和 render(question, ctx)。
// ctx = { stageEl, choicesEl, ui }，其中 ui = { setPrompt, answer, pop }。
//
// 所有视觉元素都用 emoji，无需任何图片资源——在手机/平板/电脑浏览器都能直接跑。

import { el, randInt, pick, shuffle, numberChoices } from "./utils.js";

// 主题素材
const DINOS = ["🦕", "🦖", "🐊", "🦎", "🐉"];
const EGG = "🥚";
const SHAPE_EMOJI = {
  圆形: "🔵",
  正方形: "🟦",
  三角形: "🔺",
  星形: "⭐",
  心形: "💜",
};

// ---------- 渲染小工具 ----------

/** 一堆 emoji（用于舞台散点） */
function scatter(stageEl, emoji, n) {
  for (let i = 0; i < n; i++) {
    const t = el("span", { class: "token", text: emoji });
    t.style.animationDelay = `${i * 0.05}s`;
    stageEl.appendChild(t);
  }
}

/** 紧凑的一组 emoji（用于选项里） */
function groupNode(emoji, n) {
  const wrap = el("span", { class: "grp" });
  for (let i = 0; i < n; i++) wrap.appendChild(el("span", { class: "mini", text: emoji }));
  return wrap;
}

/** 生成一个选项按钮并接好点击 */
function choiceBtn(content, isCorrect, ui) {
  const btn = el("button", { class: "choice", type: "button" });
  if (typeof content === "string") btn.textContent = content;
  else btn.appendChild(content);
  btn.addEventListener("click", () => ui.answer(isCorrect, btn));
  return btn;
}

function setCols(choicesEl, n) {
  choicesEl.className = "choices cols-" + Math.min(Math.max(n, 2), 4);
}

// ---------- 题型 ----------

const counting = {
  skill: "counting",
  generate(cfg) {
    const n = randInt(cfg.min ?? 1, cfg.max ?? 5);
    return {
      n,
      emoji: pick(DINOS),
      options: numberChoices(n, cfg.choices ?? 3, cfg.min ?? 1, cfg.max ?? 5),
    };
  },
  render(q, { stageEl, choicesEl, ui }) {
    scatter(stageEl, q.emoji, q.n);
    ui.setPrompt("数一数，有几只？");
    setCols(choicesEl, q.options.length);
    q.options.forEach((opt) =>
      choicesEl.appendChild(choiceBtn(String(opt), opt === q.n, ui))
    );
  },
};

const numberMatch = {
  skill: "number-recognition",
  generate(cfg) {
    const min = cfg.min ?? 1;
    const max = cfg.max ?? 10;
    const n = randInt(min, max);
    const counts = numberChoices(n, cfg.choices ?? 3, min, max);
    return { n, emoji: pick(DINOS), counts };
  },
  render(q, { stageEl, choicesEl, ui }) {
    stageEl.appendChild(el("div", { class: "big-digit", text: String(q.n) }));
    ui.setPrompt(`哪一堆是 ${q.n} 只？`);
    setCols(choicesEl, q.counts.length);
    q.counts.forEach((c) =>
      choicesEl.appendChild(choiceBtn(groupNode(q.emoji, c), c === q.n, ui))
    );
  },
};

const compare = {
  skill: "comparison",
  generate(cfg) {
    const min = cfg.min ?? 1;
    const max = cfg.max ?? 9;
    let a = randInt(min, max);
    let b = randInt(min, max);
    while (b === a) b = randInt(min, max);
    return { a, b, emoji: pick(DINOS), mode: cfg.mode === "less" ? "less" : "more" };
  },
  render(q, { stageEl, choicesEl, ui }) {
    stageEl.appendChild(el("div", { class: "token", text: "⚖️" }));
    ui.setPrompt(q.mode === "less" ? "哪边更少？" : "哪边更多？");
    const want = q.mode === "less" ? Math.min(q.a, q.b) : Math.max(q.a, q.b);
    setCols(choicesEl, 2);
    // 左右两组
    [q.a, q.b].forEach((count) =>
      choicesEl.appendChild(choiceBtn(groupNode(q.emoji, count), count === want, ui))
    );
  },
};

const shapes = {
  skill: "shapes",
  generate(cfg) {
    const pool = (cfg.pool && cfg.pool.length ? cfg.pool : Object.keys(SHAPE_EMOJI)).filter(
      (s) => SHAPE_EMOJI[s]
    );
    const target = pick(pool);
    const others = shuffle(pool.filter((s) => s !== target));
    const opts = shuffle([target, ...others.slice(0, (cfg.choices ?? 3) - 1)]);
    return { target, opts };
  },
  render(q, { stageEl, choicesEl, ui }) {
    stageEl.appendChild(el("div", { class: "big-digit", text: SHAPE_EMOJI[q.target] }));
    ui.setPrompt(`找一找：${q.target}`);
    setCols(choicesEl, q.opts.length);
    q.opts.forEach((s) =>
      choicesEl.appendChild(choiceBtn(SHAPE_EMOJI[s], s === q.target, ui))
    );
  },
};

const pattern = {
  skill: "patterns",
  generate(cfg) {
    const kinds = ["AB", "ABC", "AAB", "ABB"];
    const kind = pick(kinds);
    const palette = shuffle([...DINOS]).slice(0, 3);
    const map = { A: palette[0], B: palette[1], C: palette[2] };
    const unit = kind.split("").map((c) => map[c]);
    const visible = randInt(4, 6);
    const seq = [];
    for (let i = 0; i < visible; i++) seq.push(unit[i % unit.length]);
    const answer = unit[visible % unit.length];
    // 选项：用到的不同 emoji，凑够数量
    const used = [...new Set(unit)];
    const opts = new Set(used);
    while (opts.size < (cfg.choices ?? 3)) opts.add(pick(DINOS));
    return { seq, answer, opts: shuffle([...opts]) };
  },
  render(q, { stageEl, choicesEl, ui }) {
    q.seq.forEach((e, i) => {
      const t = el("span", { class: "token", text: e });
      t.style.animationDelay = `${i * 0.05}s`;
      stageEl.appendChild(t);
    });
    stageEl.appendChild(el("span", { class: "token", text: "❓" }));
    ui.setPrompt("接下来是哪一个？");
    setCols(choicesEl, q.opts.length);
    q.opts.forEach((e) =>
      choicesEl.appendChild(choiceBtn(e, e === q.answer, ui))
    );
  },
};

const addition = {
  skill: "addition",
  generate(cfg) {
    const maxSum = cfg.maxSum ?? 5;
    const a = randInt(1, maxSum - 1);
    const b = randInt(1, maxSum - a);
    const sum = a + b;
    return {
      a,
      b,
      sum,
      emoji: pick(DINOS),
      options: numberChoices(sum, cfg.choices ?? 3, 1, maxSum),
    };
  },
  render(q, { stageEl, choicesEl, ui }) {
    for (let i = 0; i < q.a; i++) stageEl.appendChild(el("span", { class: "token", text: q.emoji }));
    stageEl.appendChild(el("span", { class: "op", text: "➕" }));
    for (let i = 0; i < q.b; i++) stageEl.appendChild(el("span", { class: "token", text: q.emoji }));
    stageEl.appendChild(el("span", { class: "op", text: "=" }));
    stageEl.appendChild(el("span", { class: "token", text: "❓" }));
    ui.setPrompt("一共有几只？");
    setCols(choicesEl, q.options.length);
    q.options.forEach((opt) =>
      choicesEl.appendChild(choiceBtn(String(opt), opt === q.sum, ui))
    );
  },
};

const subtraction = {
  skill: "subtraction",
  generate(cfg) {
    const max = cfg.max ?? 5;
    const m = randInt(2, max);
    const s = randInt(1, m - 1);
    const result = m - s;
    return {
      m,
      s,
      result,
      emoji: pick(DINOS),
      options: numberChoices(result, cfg.choices ?? 3, 0, max),
    };
  },
  render(q, { stageEl, choicesEl, ui }) {
    for (let i = 0; i < q.m; i++) {
      const gone = i >= q.m - q.s;
      const t = el("span", { class: "token" + (gone ? " gone" : ""), text: q.emoji });
      t.style.animationDelay = `${i * 0.05}s`;
      stageEl.appendChild(t);
    }
    stageEl.appendChild(el("span", { class: "op", text: "👋" }));
    ui.setPrompt(`走了 ${q.s} 只，还剩几只？`);
    setCols(choicesEl, q.options.length);
    q.options.forEach((opt) =>
      choicesEl.appendChild(choiceBtn(String(opt), opt === q.result, ui))
    );
  },
};

export const ACTIVITIES = {
  counting,
  "number-match": numberMatch,
  compare,
  shapes,
  pattern,
  addition,
  subtraction,
};

/** 某岛是否有对应的题型实现 */
export function hasActivity(type) {
  return Object.prototype.hasOwnProperty.call(ACTIVITIES, type);
}

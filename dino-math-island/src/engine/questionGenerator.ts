// 按知识点 + 难度档生成题目（纯逻辑，可单测）。开发文档 §5.3 / §8。

import type { DifficultyLevel, KnowledgePoint, Question, QuestionType, Op } from "./types";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function hasFlag(level: DifficultyLevel, f: string): boolean {
  return !!level.flags?.includes(f);
}
function divisorsOf(level: DifficultyLevel): number[] {
  const f = level.flags?.find((x) => x.startsWith("divisors:"));
  if (!f) return [2, 5];
  return f
    .slice("divisors:".length)
    .split(",")
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n));
}

/** 生成 3 个互不相同的选项（含正确答案，已打乱、非负） */
function makeOptions(answer: number, count = 3): number[] {
  const opts = new Set<number>([answer]);
  for (const d of shuffle([1, -1, 2, -2, 3, -3, 10, -10, 5, -5])) {
    if (opts.size >= count) break;
    const v = answer + d;
    if (v >= 0) opts.add(v);
  }
  let n = answer + 1;
  while (opts.size < count) {
    if (n >= 0) opts.add(n);
    n++;
  }
  return shuffle([...opts]);
}

const ones = (n: number) => n % 10;

// —— 各单元的 (a,b) 采样 ——
function genAddition(level: DifficultyLevel): { a: number; b: number } {
  const [lo, hi] = level.numberRange;
  const minSum = Math.max(lo, 1);
  for (let t = 0; t < 200; t++) {
    const sum = randInt(minSum, hi);
    const a = randInt(0, sum);
    const b = sum - a;
    if (hasFlag(level, "carry") && ones(a) + ones(b) < 10) continue;
    if (hasFlag(level, "noCarry") && ones(a) + ones(b) >= 10) continue;
    return { a, b };
  }
  return { a: Math.floor(hi / 2), b: Math.ceil(hi / 2) };
}

function genSubtraction(level: DifficultyLevel): { a: number; b: number } {
  const [lo, hi] = level.numberRange; // minuend 范围
  for (let t = 0; t < 200; t++) {
    const m = randInt(Math.max(lo, 1), hi);
    const b = randInt(0, m);
    const needBorrow = ones(m) < ones(b);
    if (hasFlag(level, "borrow") && !needBorrow) continue;
    if (hasFlag(level, "noBorrow") && needBorrow) continue;
    return { a: m, b };
  }
  return { a: hi, b: Math.floor(hi / 2) };
}

function tableOf(kp: KnowledgePoint): number {
  const m = /^MUL_T(\d)$/.exec(kp.id);
  if (m) return parseInt(m[1], 10);
  return randInt(2, 9); // MUL_MIXED
}

/** 主入口：根据知识点和某个难度档生成一道题 */
export function generateQuestion(kp: KnowledgePoint, level: DifficultyLevel): Question {
  const type: QuestionType = pick(level.questionTypes);
  let a = 0;
  let b = 0;
  let answer = 0;
  let op: Op = "+";
  let visualKind = kp.teachingModel;

  switch (kp.unit) {
    case "subtraction": {
      ({ a, b } = genSubtraction(level));
      answer = a - b;
      op = "-";
      break;
    }
    case "multiplication": {
      const t = tableOf(kp);
      const k = randInt(level.numberRange[0], level.numberRange[1]);
      a = t;
      b = k;
      answer = a * b;
      op = "×";
      visualKind = "array";
      break;
    }
    case "division": {
      const d = pick(divisorsOf(level));
      const q = randInt(level.numberRange[0], level.numberRange[1]);
      a = d * q;
      b = d;
      answer = q;
      op = "÷";
      visualKind = "array";
      break;
    }
    case "addition":
    default: {
      ({ a, b } = genAddition(level));
      answer = a + b;
      op = "+";
      break;
    }
  }

  const opWord = { "+": "加", "-": "减", "×": "乘", "÷": "除以" }[op];
  const promptText = `${a} ${opWord} ${b} 等于几？`;

  // 实物图示：数值不大时给出（开发文档 §8.4，>24 不出图示）
  let visual: Question["visual"];
  if (op === "×" && a * b <= 24) visual = { kind: "array", a, b };
  else if (op === "÷" && a <= 24) visual = { kind: "array", a: answer, b, quotient: answer };
  else if ((op === "+" || op === "-") && a <= 20 && b <= 20 && a + b <= 24) {
    // numberline 在 V1 用 groups 占位
    visual = { kind: visualKind === "array" ? "groups" : visualKind, a, b };
  }

  return {
    kpId: kp.id,
    type,
    a,
    b,
    op,
    answer,
    options: makeOptions(answer),
    visual,
    promptText,
    level: level.level,
  };
}

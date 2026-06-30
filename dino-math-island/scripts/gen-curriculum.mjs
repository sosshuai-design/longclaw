// 生成 public/curriculum-content.json —— 占位课程内容。
//
// ⚠️ 这是按《开发文档-恐龙数学岛.md》§4 类型定义、§8 课程设计「重建」出来的占位数据，
//    用来让 Phase 0/1 能真正跑起来。等你的真实 curriculum-content.json 到了，
//    直接覆盖 public/ 下同名文件即可（引擎从该 JSON 读取，无需改任何代码）。
//
// 用法：node scripts/gen-curriculum.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "curriculum-content.json");

const ONES = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 把乘积读成中文（九九表口径：10 读「一十」） */
function cnProduct(p) {
  if (p < 10) return ONES[p - 1];
  if (p === 10) return "一十";
  if (p < 20) return "十" + ONES[p - 10 - 1];
  const tens = Math.floor(p / 10);
  const one = p % 10;
  return ONES[tens - 1] + "十" + (one ? ONES[one - 1] : "");
}

/** 一句口诀：小数在前，积<10 用「得」 */
function chantLine(t, k) {
  const small = Math.min(t, k);
  const big = Math.max(t, k);
  const p = t * k;
  const prefix = ONES[small - 1] + ONES[big - 1];
  return p < 10 ? `${prefix}得${cnProduct(p)}` : `${prefix}${cnProduct(p)}`;
}

/** 某张乘法表（t×1..t×9）的全部口诀 */
function chantFor(t) {
  return Array.from({ length: 9 }, (_, i) => chantLine(t, i + 1));
}

const lvl = (level, questionTypes, numberRange, flags) => ({
  level,
  questionTypes,
  numberRange,
  ...(flags ? { flags } : {}),
});

// 加减法的难度阶梯：题型由「看图→算式→填空」，数值范围逐档放大
const addSubLadder = (ranges, flag) => [
  lvl(1, ["pictureChoice"], ranges[0], flag ? [flag] : undefined),
  lvl(2, ["equationChoice"], ranges[1], flag ? [flag] : undefined),
  lvl(3, ["equationChoice"], ranges[2], flag ? [flag] : undefined),
  lvl(4, ["fillBlank"], ranges[3], flag ? [flag] : undefined),
];

// 乘法表难度阶梯：先放开乘数 1~3，再到 1~9；题型递进
const mulLadder = () => [
  lvl(1, ["pictureChoice"], [1, 3]),
  lvl(2, ["equationChoice"], [1, 6]),
  lvl(3, ["equationChoice"], [1, 9]),
  lvl(4, ["fillBlank"], [1, 9]),
];

// 除法难度阶梯：numberRange 表示商的范围，divisors 编码进 flags
const divLadder = (divisors) => {
  const f = [`divisors:${divisors.join(",")}`];
  return [
    lvl(1, ["pictureChoice"], [1, 5], f),
    lvl(2, ["equationChoice"], [1, 9], f),
    lvl(3, ["fillBlank"], [1, 9], f),
  ];
};

const kp = (o) => ({ masteryThreshold: 80, ...o });

const knowledgePoints = [
  kp({
    id: "ADD_WITHIN_10", unit: "addition", name: "10以内加法", order: 1,
    prerequisites: [], teachingModel: "groups",
    levels: addSubLadder([[0, 5], [0, 8], [0, 10], [0, 10]], "noCarry"),
  }),
  kp({
    id: "SUB_WITHIN_10", unit: "subtraction", name: "10以内减法", order: 2,
    prerequisites: ["ADD_WITHIN_10"], teachingModel: "groups",
    levels: addSubLadder([[0, 5], [0, 8], [0, 10], [0, 10]], "noBorrow"),
  }),
  kp({
    id: "ADD_WITHIN_20", unit: "addition", name: "20以内进位加法", order: 3,
    prerequisites: ["ADD_WITHIN_10"], teachingModel: "numberline",
    levels: addSubLadder([[10, 13], [10, 15], [10, 18], [10, 20]], "carry"),
  }),
  kp({
    id: "SUB_WITHIN_20", unit: "subtraction", name: "20以内退位减法", order: 4,
    prerequisites: ["SUB_WITHIN_10", "ADD_WITHIN_20"], teachingModel: "numberline",
    levels: addSubLadder([[11, 14], [11, 16], [11, 18], [11, 20]], "borrow"),
  }),
  kp({ id: "MUL_T2", unit: "multiplication", name: "2的乘法口诀", order: 5, prerequisites: ["ADD_WITHIN_20"], teachingModel: "array", levels: mulLadder(), chant: chantFor(2) }),
  kp({ id: "MUL_T5", unit: "multiplication", name: "5的乘法口诀", order: 6, prerequisites: ["MUL_T2"], teachingModel: "array", levels: mulLadder(), chant: chantFor(5) }),
  kp({ id: "MUL_T3", unit: "multiplication", name: "3的乘法口诀", order: 7, prerequisites: ["MUL_T2"], teachingModel: "array", levels: mulLadder(), chant: chantFor(3) }),
  kp({ id: "MUL_T4", unit: "multiplication", name: "4的乘法口诀", order: 8, prerequisites: ["MUL_T3"], teachingModel: "array", levels: mulLadder(), chant: chantFor(4) }),
  kp({ id: "MUL_T6", unit: "multiplication", name: "6的乘法口诀", order: 9, prerequisites: ["MUL_T5"], teachingModel: "array", levels: mulLadder(), chant: chantFor(6) }),
  kp({ id: "MUL_T7", unit: "multiplication", name: "7的乘法口诀", order: 10, prerequisites: ["MUL_T6"], teachingModel: "array", levels: mulLadder(), chant: chantFor(7) }),
  kp({ id: "MUL_T8", unit: "multiplication", name: "8的乘法口诀", order: 11, prerequisites: ["MUL_T7"], teachingModel: "array", levels: mulLadder(), chant: chantFor(8) }),
  kp({ id: "MUL_T9", unit: "multiplication", name: "9的乘法口诀", order: 12, prerequisites: ["MUL_T8"], teachingModel: "array", levels: mulLadder(), chant: chantFor(9) }),
  kp({
    id: "MUL_MIXED", unit: "multiplication", name: "表内乘法综合", order: 13,
    prerequisites: ["MUL_T9"], teachingModel: "array",
    levels: [lvl(1, ["equationChoice"], [1, 5]), lvl(2, ["equationChoice"], [1, 9]), lvl(3, ["fillBlank"], [1, 9])],
  }),
  kp({ id: "DIV_BY_2_5", unit: "division", name: "用2/5口诀求商", order: 14, prerequisites: ["MUL_T5"], teachingModel: "array", levels: divLadder([2, 5]) }),
  kp({ id: "DIV_BY_3_4", unit: "division", name: "用3/4口诀求商", order: 15, prerequisites: ["MUL_T4", "DIV_BY_2_5"], teachingModel: "array", levels: divLadder([3, 4]) }),
  kp({ id: "DIV_BY_6_9", unit: "division", name: "用6-9口诀求商", order: 16, prerequisites: ["MUL_T9", "DIV_BY_3_4"], teachingModel: "array", levels: divLadder([6, 7, 8, 9]) }),
  kp({
    id: "ADD_WITHIN_100", unit: "addition", name: "100以内加法", order: 17,
    prerequisites: ["ADD_WITHIN_20"], teachingModel: "numberline",
    levels: [
      lvl(1, ["equationChoice"], [10, 50], ["noCarry"]),
      lvl(2, ["equationChoice"], [10, 99], ["noCarry"]),
      lvl(3, ["equationChoice"], [10, 99], ["carry"]),
      lvl(4, ["fillBlank"], [10, 99], ["carry"]),
    ],
  }),
  kp({
    id: "SUB_WITHIN_100", unit: "subtraction", name: "100以内减法", order: 18,
    prerequisites: ["SUB_WITHIN_20"], teachingModel: "numberline",
    levels: [
      lvl(1, ["equationChoice"], [20, 50], ["noBorrow"]),
      lvl(2, ["equationChoice"], [20, 99], ["noBorrow"]),
      lvl(3, ["equationChoice"], [20, 99], ["borrow"]),
      lvl(4, ["fillBlank"], [20, 99], ["borrow"]),
    ],
  }),
];

// V1：在 20/100 以内加减的最高难度档解锁「应用题」(wordProblem)
for (const id of ["ADD_WITHIN_20", "SUB_WITHIN_20", "ADD_WITHIN_100", "SUB_WITHIN_100"]) {
  const k = knowledgePoints.find((x) => x.id === id);
  const last = k.levels[k.levels.length - 1];
  if (!last.questionTypes.includes("wordProblem")) {
    last.questionTypes = [...last.questionTypes, "wordProblem"];
  }
}

const data = {
  meta: {
    title: "恐龙数学岛",
    titleEn: "Dino Math Island",
    version: "0.1.0-placeholder",
    language: "zh-CN",
    ageRange: "5-8",
    scene: "classroom",
    note: "占位课程：由开发文档 §4/§8 重建，待替换为真实 curriculum-content.json。",
    roundQuestions: 8,
    calibrationQuestions: 3,
    masteryThresholdDefault: 80,
    adaptive: { upStreak: 3, downStreak: 2, target: 0.78, maxLevelDefault: 4 },
    units: ["addition", "subtraction", "multiplication", "division"],
  },
  knowledgePoints,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`✅ wrote ${OUT}`);
console.log(`   knowledgePoints: ${knowledgePoints.length}`);
console.log(`   示例口诀 (7的表): ${chantFor(7).join("，")}`);

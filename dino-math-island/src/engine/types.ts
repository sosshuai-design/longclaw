// 全部类型定义（开发文档 §4）。引擎层与 UI 共用。

// —— 课程内容（来自 curriculum-content.json）——
export type Unit =
  | "addition"
  | "subtraction"
  | "multiplication"
  | "division"
  | "mixed";

export type QuestionType =
  | "pictureChoice"
  | "equationChoice"
  | "fillBlank"
  | "pictureToEquation"
  | "wordProblem";

export type TeachingModel = "groups" | "array" | "numberline" | "tableChant";

export type Op = "+" | "-" | "×" | "÷";

export interface DifficultyLevel {
  level: number; // 1..N，数字越大越难
  questionTypes: QuestionType[]; // 该档可出的题型
  numberRange: [number, number]; // 数值范围（含义随 unit 解释）
  flags?: string[]; // 如 "carry"(进位) "borrow"(退位) "noCarry" "divisors:2,5"
}

export interface KnowledgePoint {
  id: string; // 如 "ADD_WITHIN_20"
  unit: Unit;
  name: string; // 中文名
  order: number; // 课程总顺序
  prerequisites: string[]; // 前置知识点 id（决定解锁）
  teachingModel: TeachingModel;
  masteryThreshold: number; // 视为「已掌握」的分数，默认 80
  levels: DifficultyLevel[]; // 难度阶梯
  chant?: string[]; // 乘法口诀文本（仅乘法表用）
}

export interface CurriculumMeta {
  title: string;
  titleEn?: string;
  version: string;
  language: string;
  ageRange?: string;
  scene?: string;
  roundQuestions: number; // 一轮题数（默认 8）
  calibrationQuestions: number; // 摸底题数（默认 3）
  masteryThresholdDefault: number;
  adaptive: { upStreak: number; downStreak: number; target: number; maxLevelDefault: number };
  units: Unit[];
  [k: string]: unknown;
}

export interface Curriculum {
  meta: CurriculumMeta;
  knowledgePoints: KnowledgePoint[];
}

// —— 运行时 ——
export interface VisualSpec {
  kind: TeachingModel;
  a: number;
  b: number;
  quotient?: number;
}

export interface Question {
  kpId: string;
  type: QuestionType;
  a: number;
  b: number;
  op: Op;
  answer: number;
  options: number[]; // 选择题选项（含正确答案，已打乱）
  visual?: VisualSpec;
  promptText: string; // 朗读文本，如 "8 加 7 等于几？"
  level: number; // 出题时的难度档（用于金币计算等）
}

// —— 掌握度 ——
export type MasteryStatus = "locked" | "learning" | "mastered" | "review";

export interface MasteryRecord {
  kpId: string;
  score: number; // 0..100
  status: MasteryStatus;
  lastPracticed: number; // 时间戳
  nextReviewAt?: number; // 间隔重复排程
  attempts: number;
  corrects: number;
}

// —— 档案与全局状态 ——
export interface Profile {
  id: string;
  name: string;
  avatar: string;
  coins: number;
  masteredCount: number; // 已掌握知识点数（驱动宠物进化）
  stickers: number[]; // 已获贴纸索引
  streakDays: number;
  difficultyByKp: Record<string, number>; // 每个知识点当前难度档
  mastery: Record<string, MasteryRecord>;
}

export interface Settings {
  sound: boolean;
  dailyTimeLimitMin: number;
  maxDifficulty: number;
  enabledUnits: Unit[];
  eyeRestReminder: boolean;
}

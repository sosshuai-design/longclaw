// 共享 UI 常量：单元主题色/图标/文案（用 hex 内联，避免 Tailwind 动态类被裁剪）。

import type { Unit } from "./engine/types";

export interface UnitMeta {
  label: string;
  emoji: string;
  hex: string;
  op: string;
}

export const UNIT_META: Record<Exclude<Unit, "mixed">, UnitMeta> = {
  addition: { label: "加法岛", emoji: "➕", hex: "#FF8A5B", op: "加" },
  subtraction: { label: "减法岛", emoji: "➖", hex: "#4FB286", op: "减" },
  multiplication: { label: "乘法岛", emoji: "✖️", hex: "#5B8DEF", op: "乘" },
  division: { label: "除法岛", emoji: "➗", hex: "#C173E0", op: "除以" },
};

export const COLORS = {
  correct: "#2FB36B",
  wrong: "#F2685E",
  coin: "#FFB531",
  ink: "#3A2F5B",
} as const;

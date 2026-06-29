import type { MasteryRecord } from "../engine/types";

// 着色阈值：未学灰 / <40 红 / 40–74 黄 / ≥75 绿（开发文档 §6.6）
function colorFor(score: number, learned: boolean): string {
  if (!learned || score <= 0) return "#E6E1F0"; // 未学
  if (score < 40) return "#F2685E";
  if (score < 75) return "#FFC83D";
  return "#2FB36B";
}

const LEGEND = [
  { c: "#E6E1F0", t: "未学" },
  { c: "#F2685E", t: "<40" },
  { c: "#FFC83D", t: "40–74" },
  { c: "#2FB36B", t: "≥75" },
];

/**
 * 9×9 乘法口诀掌握度热力图。
 * 我们的掌握度按「整张乘法表」为知识点（MUL_T2..T9），
 * 故每个格子 (r,c) 取较大因数所属表 MUL_T{max(r,c)} 的分数着色。
 */
export default function MasteryHeatmap({ mastery }: { mastery: Record<string, MasteryRecord> }) {
  return (
    <div>
      <div className="inline-block">
        {/* 列号 */}
        <div className="flex">
          <div style={{ width: 30 }} />
          {Array.from({ length: 9 }, (_, j) => (
            <div key={j} className="text-center text-xs text-ink/50" style={{ width: 38 }}>
              {j + 1}
            </div>
          ))}
        </div>
        {Array.from({ length: 9 }, (_, r) => r + 1).map((row) => (
          <div key={row} className="flex items-center">
            <div className="text-xs text-ink/50 text-right pr-1" style={{ width: 30 }}>
              {row}
            </div>
            {Array.from({ length: 9 }, (_, c) => c + 1).map((col) => {
              const table = Math.max(row, col);
              const rec = mastery[`MUL_T${table}`];
              const learned = table === 1 || !!rec;
              const score = table === 1 ? 100 : rec?.score ?? 0;
              return (
                <div
                  key={col}
                  title={`${col}×${row}=${row * col}（${score} 分）`}
                  className="grid place-items-center rounded-md text-[11px] font-bold"
                  style={{ width: 34, height: 30, margin: 2, background: colorFor(score, learned), color: score >= 40 && learned ? "#fff" : "#7a6f97" }}
                >
                  {row * col}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-3 flex-wrap">
        {LEGEND.map((l) => (
          <div key={l.t} className="flex items-center gap-1 text-xs text-ink/60">
            <span className="rounded" style={{ width: 14, height: 14, background: l.c, display: "inline-block" }} />
            {l.t}
          </div>
        ))}
      </div>
    </div>
  );
}

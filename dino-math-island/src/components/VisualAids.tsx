import type { Op, VisualSpec } from "../engine/types";

const TOKEN = "🦕";

function Tokens({ n, faded = 0 }: { n: number; faded?: number }) {
  return (
    <div className="flex flex-wrap gap-1 justify-center max-w-[260px]">
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          style={{ fontSize: 34, lineHeight: 1, filter: i >= n - faded ? "grayscale(1)" : "none", opacity: i >= n - faded ? 0.3 : 1 }}
        >
          {TOKEN}
        </span>
      ))}
    </div>
  );
}

/** 实物图示（开发文档 §6.2 / §8.4）。groups=加减、array=乘除。 */
export default function VisualAids({ visual, op }: { visual: VisualSpec; op: Op }) {
  if (visual.kind === "array") {
    // a 行 × b 列
    return (
      <div
        className="grid gap-1 justify-center"
        style={{ gridTemplateColumns: `repeat(${visual.b}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {Array.from({ length: visual.a * visual.b }, (_, i) => (
          <span key={i} style={{ fontSize: 30, lineHeight: 1 }}>
            {TOKEN}
          </span>
        ))}
      </div>
    );
  }

  // groups（含 numberline 的 V1 占位）
  if (op === "-") {
    return <Tokens n={visual.a} faded={visual.b} />;
  }
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden>
      <Tokens n={visual.a} />
      <span style={{ fontSize: 34 }}>➕</span>
      <Tokens n={visual.b} />
    </div>
  );
}

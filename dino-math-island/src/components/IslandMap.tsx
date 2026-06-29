import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import type { Unit } from "../engine/types";
import { useCurriculum } from "../App";
import { useGameStore } from "../store/gameStore";
import { unitMasteryPct } from "../engine/curriculum";
import { UNIT_META, PHASE1_UNITS } from "../ui";

const UNIT_ORDER: Exclude<Unit, "mixed">[] = [
  "addition",
  "subtraction",
  "multiplication",
  "division",
];

/** 冒险地图：四座岛 + 口诀馆入口（开发文档 §6.1 中栏） */
export default function IslandMap() {
  const cur = useCurriculum();
  const mastery = useGameStore((s) => s.profile.mastery);
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 gap-5">
      {UNIT_ORDER.map((unit) => {
        const meta = UNIT_META[unit];
        const pct = unitMasteryPct(cur, unit, mastery);
        const unlocked = PHASE1_UNITS.includes(unit);
        return (
          <motion.button
            key={unit}
            whileTap={unlocked ? { scale: 0.97 } : undefined}
            onClick={() => unlocked && navigate(`/play/${unit}`)}
            className="relative rounded-3xl p-6 text-left shadow-soft overflow-hidden"
            style={{ background: "#fff", cursor: unlocked ? "pointer" : "not-allowed", opacity: unlocked ? 1 : 0.6 }}
          >
            <div className="absolute top-0 left-0 right-0 h-2" style={{ background: meta.hex }} />
            <div className="flex items-center gap-3">
              <div className="text-5xl">{meta.emoji}</div>
              <div>
                <div className="text-2xl font-extrabold text-ink">{meta.label}</div>
                <div className="text-sm text-ink/60">综合掌握度 {pct}%</div>
              </div>
              {!unlocked && <div className="ml-auto text-3xl">🔒</div>}
            </div>
            <div className="mt-4 h-3 rounded-full bg-bg overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.hex }} />
            </div>
            {!unlocked && (
              <div className="mt-2 text-xs font-bold" style={{ color: meta.hex }}>
                Phase 2 开放
              </div>
            )}
          </motion.button>
        );
      })}

      {/* 口诀馆入口（Phase 2） */}
      <div className="col-span-2 rounded-3xl p-5 shadow-soft flex items-center gap-3 opacity-60" style={{ background: "#fff" }}>
        <div className="text-4xl">📖</div>
        <div className="text-xl font-extrabold text-ink">乘法口诀馆</div>
        <div className="ml-auto text-2xl">🔒</div>
        <div className="text-xs font-bold" style={{ color: "#F2B441" }}>Phase 2 开放</div>
      </div>
    </div>
  );
}

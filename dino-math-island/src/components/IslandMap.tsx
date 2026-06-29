import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import type { Unit } from "../engine/types";
import { useCurriculum } from "../App";
import { useGameStore } from "../store/gameStore";
import { unitMasteryPct, isUnitUnlocked, unitLockBlockers } from "../engine/curriculum";
import { UNIT_META } from "../ui";

const UNIT_ORDER: Exclude<Unit, "mixed">[] = [
  "addition",
  "subtraction",
  "multiplication",
  "division",
];

/** 冒险地图：四座岛 + 口诀馆入口（开发文档 §6.1 中栏）。按前置掌握度解锁。 */
export default function IslandMap() {
  const cur = useCurriculum();
  const mastery = useGameStore((s) => s.profile.mastery);
  const settings = useGameStore((s) => s.settings);
  const navigate = useNavigate();

  // 内容范围开关：只显示被启用的单元
  const units = UNIT_ORDER.filter((u) => settings.enabledUnits.includes(u));

  return (
    <div className="grid grid-cols-2 gap-5">
      {units.map((unit) => {
        const meta = UNIT_META[unit];
        const pct = unitMasteryPct(cur, unit, mastery);
        const unlocked = settings.unlockAll || isUnitUnlocked(cur, unit, mastery);
        const blockers = unlocked ? [] : unitLockBlockers(cur, unit, mastery);
        return (
          <motion.button
            key={unit}
            whileTap={unlocked ? { scale: 0.97 } : undefined}
            onClick={() => unlocked && navigate(`/play/${unit}`)}
            className="relative rounded-3xl p-6 text-left shadow-soft overflow-hidden"
            style={{ background: "#fff", cursor: unlocked ? "pointer" : "not-allowed", opacity: unlocked ? 1 : 0.65 }}
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
                先掌握「{blockers.join("、") || "前置知识点"}」才能解锁
              </div>
            )}
          </motion.button>
        );
      })}

      {/* 口诀馆入口（教学板，随时可用） */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate("/chant")}
        className="col-span-2 rounded-3xl p-5 shadow-soft flex items-center gap-3"
        style={{ background: "#fff" }}
      >
        <div className="text-4xl">📖</div>
        <div className="text-xl font-extrabold text-ink">乘法口诀馆</div>
        <div className="ml-auto text-sm font-bold" style={{ color: "#F2B441" }}>点格朗读口诀 →</div>
      </motion.button>
    </div>
  );
}

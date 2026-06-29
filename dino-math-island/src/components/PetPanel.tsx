import { motion } from "framer-motion";
import { useGameStore } from "../store/gameStore";
import { petStageFor, nextEvolveInfo } from "../engine/rewards";

/** 宠物面板：随 masteredCount 进化 + 成长条 + 小统计（开发文档 §6.1 左栏） */
export default function PetPanel() {
  const profile = useGameStore((s) => s.profile);
  const stage = petStageFor(profile.masteredCount);
  const info = nextEvolveInfo(profile.masteredCount);

  const progress = info
    ? Math.min(100, Math.round(((profile.masteredCount - stage.at) / (info.next.at - stage.at)) * 100))
    : 100;

  return (
    <div className="bg-surface rounded-3xl shadow-soft p-6 flex flex-col items-center gap-4">
      <motion.div
        key={stage.index}
        initial={{ scale: 0.6, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        className="text-[88px] leading-none animate-bob"
      >
        {stage.emoji}
      </motion.div>
      <div className="text-xl font-extrabold text-ink">{stage.name}</div>

      <div className="w-full">
        <div className="h-4 rounded-full bg-bg overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "#5B8DEF" }} />
        </div>
        <div className="text-sm text-ink/60 mt-1 text-center">
          {info ? `再掌握 ${info.need} 个知识点就能进化成「${info.next.name}」` : "已完全进化！🎉"}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 w-full mt-1">
        <Stat label="已掌握" value={profile.masteredCount} />
        <Stat label="贴纸" value={profile.stickers.length} />
        <Stat label="连续天" value={profile.streakDays} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-bg rounded-2xl py-2 text-center">
      <div className="text-2xl font-extrabold text-ink">{value}</div>
      <div className="text-xs text-ink/60">{label}</div>
    </div>
  );
}

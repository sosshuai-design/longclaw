import PetPanel from "../components/PetPanel";
import IslandMap from "../components/IslandMap";
import { useGameStore } from "../store/gameStore";

/** 基地 / 冒险地图（开发文档 §6.1）。PC 三栏。 */
export default function BasePage() {
  const stickers = useGameStore((s) => s.profile.stickers.length);

  return (
    <div className="max-w-6xl mx-auto w-full p-4 md:p-6 grid gap-6 md:grid-cols-[280px_1fr_240px]">
      {/* 左：宠物 */}
      <div className="order-2 md:order-1">
        <PetPanel />
      </div>

      {/* 中：地图 */}
      <div className="order-1 md:order-2">
        <h1 className="text-3xl font-extrabold text-ink mb-1">选一座岛开始冒险 🗺️</h1>
        <p className="text-ink/60 mb-5">点击小岛进入闯关，每答对一题都有金币！</p>
        <IslandMap />
      </div>

      {/* 右：今日目标 / 贴纸册 */}
      <div className="order-3 flex flex-col gap-4">
        <div className="bg-surface rounded-3xl shadow-soft p-5 text-center">
          <div className="text-sm text-ink/60 mb-2">今日目标</div>
          <div className="relative w-28 h-28 mx-auto grid place-items-center">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#EDE8F7" strokeWidth="12" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#5B8DEF" strokeWidth="12" strokeLinecap="round" strokeDasharray="264" strokeDashoffset="264" />
            </svg>
            <div className="absolute text-xl font-extrabold text-ink">加油!</div>
          </div>
          <div className="text-xs text-ink/50 mt-2">闯关数据看板将在 Phase 3 开放</div>
        </div>

        <div className="bg-surface rounded-3xl shadow-soft p-5 flex items-center gap-3">
          <div className="text-4xl">🏅</div>
          <div>
            <div className="font-extrabold text-ink">贴纸册</div>
            <div className="text-sm text-ink/60">已收集 {stickers} 张</div>
          </div>
        </div>
      </div>
    </div>
  );
}

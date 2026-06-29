import { useMemo, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { Unit } from "../engine/types";
import { useGameStore } from "../store/gameStore";
import { openChest, petStageFor, type ChestResult } from "../engine/rewards";
import { playWin } from "../audio/sfx";
import { speak } from "../audio/speech";
import Confetti from "../components/Confetti";

interface ResultState {
  unit: Unit;
  kpId: string;
  correct: number;
  total: number;
  coins: number;
  masteredStart: number;
}

/** 结算 / 宝箱（开发文档 §6.3） */
export default function ResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ResultState | null;

  const claimChest = useGameStore((s) => s.claimChest);
  const masteredNow = useGameStore((s) => s.profile.masteredCount);
  const sound = useGameStore((s) => s.settings.sound);

  const [opened, setOpened] = useState(false);
  const [chest, setChest] = useState<ChestResult | null>(null);

  // 计算一次宝箱结果（不在 render 里重复随机）
  const pending = useMemo(() => (state ? openChest(state.correct, state.total) : null), [state]);

  if (!state || !pending) return <Navigate to="/" replace />;

  const perfect = state.correct === state.total && state.total > 0;
  const evolved = masteredNow > state.masteredStart;
  const pet = petStageFor(masteredNow);

  const open = () => {
    if (opened) return;
    setChest(pending);
    claimChest(pending);
    setOpened(true);
    playWin();
    speak(perfect ? "太厉害了，全部答对！" : "闯关成功，真棒！", sound);
  };

  return (
    <div className="h-full grid place-items-center p-6 text-center relative">
      {opened && <Confetti />}
      <div className="max-w-md w-full flex flex-col items-center gap-5">
        <div className="text-2xl font-extrabold text-ink">闯关成功！</div>
        <div className="text-lg text-ink/70">
          本轮答对 <span className="font-extrabold text-correct">{state.correct}</span> / {state.total} 题
          {perfect && <span className="ml-1">满分 🎉</span>}
        </div>

        {!opened ? (
          <motion.button
            onClick={open}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="text-[120px] leading-none"
            aria-label="打开宝箱"
          >
            🎁
          </motion.button>
        ) : (
          <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3">
            <div className="text-[100px] leading-none">🧰</div>
            <div className="text-2xl font-extrabold" style={{ color: "#FFB531" }}>
              🪙 +{chest?.coins}
            </div>
            {chest?.gotSticker && <div className="text-lg font-bold text-ink">获得新贴纸 🏅</div>}
            {evolved && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-1 text-lg font-extrabold text-ink">
                宠物进化成「{pet.name}」{pet.emoji}！
              </motion.div>
            )}
          </motion.div>
        )}

        <div className="flex gap-4 mt-2">
          <button
            onClick={() => navigate(`/play/${state.unit}`, { replace: true })}
            className="rounded-full px-7 py-4 text-xl font-extrabold text-white shadow-pop"
            style={{ background: "#FF8A5B" }}
          >
            再来一轮 🔁
          </button>
          <button
            onClick={() => navigate("/", { replace: true })}
            className="rounded-full px-7 py-4 text-xl font-extrabold text-white shadow-pop"
            style={{ background: "#8a7fc0" }}
          >
            回基地 🏠
          </button>
        </div>
      </div>
    </div>
  );
}

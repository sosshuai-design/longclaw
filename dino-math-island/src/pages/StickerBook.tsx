import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGameStore } from "../store/gameStore";

// 24 张贴纸（与 rewards.openChest 的 stickerId 0..23 对应）
const STICKERS = [
  "🦕", "🦖", "🐲", "🦴", "🥚", "🌋", "🌴", "🪨",
  "⭐", "🌈", "🍃", "🐚", "🦎", "🐊", "🍀", "🌸",
  "🏆", "🎈", "🎁", "🔥", "💎", "🚀", "🌟", "👑",
];

/** 贴纸册（开发文档 §6.1 / Phase 4）：闯关开宝箱掉落的贴纸都收在这里。 */
export default function StickerBook() {
  const navigate = useNavigate();
  const owned = useGameStore((s) => s.profile.stickers);

  return (
    <div className="max-w-3xl mx-auto w-full p-4 md:p-6">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => navigate("/")} className="rounded-2xl bg-white shadow-pop px-4 py-2 font-bold text-ink">← 返回</button>
        <h1 className="text-2xl font-extrabold text-ink">贴纸册 🏅</h1>
        <div className="ml-auto text-sm text-ink/60">已收集 {owned.length} / {STICKERS.length}</div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
        {STICKERS.map((s, i) => {
          const has = owned.includes(i);
          return (
            <motion.div
              key={i}
              whileHover={has ? { scale: 1.08, rotate: 4 } : undefined}
              className="aspect-square rounded-3xl grid place-items-center shadow-soft text-5xl"
              style={{ background: has ? "#fff" : "#EAE5F3", filter: has ? "none" : "grayscale(1)", opacity: has ? 1 : 0.5 }}
            >
              {has ? s : "❓"}
            </motion.div>
          );
        })}
      </div>

      {owned.length === 0 && (
        <p className="text-center text-ink/50 mt-6">还没有贴纸～ 去闯关开宝箱就能收集啦！</p>
      )}
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useCurriculum } from "../App";
import { kpById } from "../engine/curriculum";
import { chantText } from "../engine/chant";
import { useGameStore } from "../store/gameStore";
import { speak } from "../audio/speech";
import { playCoin } from "../audio/sfx";

const CHANT_HEX = "#F2B441";

/** 乘法口诀馆（开发文档 §6.4）：三角形小九九表，点格朗读口诀，可当老师讲课的互动板书。 */
export default function ChantPage() {
  const cur = useCurriculum();
  const navigate = useNavigate();
  const sound = useGameStore((s) => s.settings.sound);
  const [sel, setSel] = useState<{ i: number; j: number } | null>(null);
  const [line, setLine] = useState<string>("点一点格子，听一听口诀～");

  // 优先用 curriculum 里的口诀文本（MUL_T{i}.chant），缺失则本地计算
  const chantFor = (i: number, j: number): string => {
    const kp = kpById(cur, `MUL_T${i}`);
    return kp?.chant?.[j - 1] ?? chantText(i, j);
  };

  const onCell = (i: number, j: number) => {
    setSel({ i, j });
    const text = chantFor(i, j);
    setLine(`${j} × ${i} = ${i * j}　「${text}」`);
    playCoin();
    speak(text, sound);
  };

  return (
    <div className="max-w-5xl mx-auto w-full p-4 md:p-6">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => navigate("/")} className="rounded-2xl bg-white shadow-pop px-4 py-2 font-bold text-ink">
          ← 返回
        </button>
        <h1 className="text-2xl font-extrabold text-ink">乘法口诀馆 📖</h1>
        <div className="ml-auto text-sm text-ink/50">点击任意格子朗读口诀</div>
      </div>

      {/* 朗读条 */}
      <div className="rounded-3xl shadow-soft p-4 mb-5 text-center text-2xl font-extrabold" style={{ background: "#fff", color: CHANT_HEX }}>
        {line}
      </div>

      {/* 三角形小九九：行 i=1..9，列 j=1..i */}
      <div className="flex flex-col items-center gap-2">
        {Array.from({ length: 9 }, (_, r) => r + 1).map((i) => (
          <div key={i} className="flex gap-2 justify-center flex-wrap">
            {Array.from({ length: i }, (_, c) => c + 1).map((j) => {
              const active = sel?.i === i && sel?.j === j;
              return (
                <motion.button
                  key={`${i}-${j}`}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => onCell(i, j)}
                  className="rounded-2xl font-extrabold shadow-pop grid place-items-center"
                  style={{
                    width: 92,
                    height: 60,
                    background: active ? CHANT_HEX : "#fff",
                    color: active ? "#fff" : "#3A2F5B",
                    fontSize: 20,
                  }}
                  aria-label={`${j} 乘 ${i} 等于 ${i * j}`}
                >
                  {j}×{i}={i * j}
                </motion.button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

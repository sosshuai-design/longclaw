import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 教师 / 家长门（开发文档 §6.5）：答对一道两位数加法才放行，防止学生误入。 */
export default function GatePage() {
  const navigate = useNavigate();
  const q = useMemo(() => {
    const a = randInt(11, 49);
    const b = randInt(11, 49);
    return { a, b, answer: a + b };
  }, []);
  const [val, setVal] = useState("");
  const [wrong, setWrong] = useState(false);

  const submit = () => {
    if (parseInt(val, 10) === q.answer) navigate("/dashboard", { replace: true });
    else {
      setWrong(true);
      setVal("");
      setTimeout(() => setWrong(false), 500);
    }
  };

  return (
    <div className="h-full grid place-items-center p-6">
      <motion.div
        animate={wrong ? { x: [0, -10, 10, -8, 8, 0] } : { x: 0 }}
        className="bg-surface rounded-3xl shadow-soft p-8 w-full max-w-md text-center"
      >
        <div className="text-4xl mb-2">🔐</div>
        <h1 className="text-xl font-extrabold text-ink">教师 / 家长验证</h1>
        <p className="text-ink/60 mt-1 mb-5">请先算出下面这道题</p>
        <div className="text-equation text-ink mb-4">
          {q.a} + {q.b} = ?
        </div>
        <input
          autoFocus
          inputMode="numeric"
          value={val}
          onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-40 text-center text-3xl font-extrabold rounded-2xl border-4 px-3 py-2"
          style={{ borderColor: wrong ? "#F2685E" : "#E3DEF0" }}
          aria-label="答案"
        />
        <div className="mt-5 flex gap-3 justify-center">
          <button onClick={submit} className="rounded-full px-7 py-3 text-lg font-extrabold text-white shadow-pop" style={{ background: "#5B8DEF" }}>
            进入 →
          </button>
          <button onClick={() => navigate("/")} className="rounded-full px-7 py-3 text-lg font-bold text-ink bg-bg">
            取消
          </button>
        </div>
        {wrong && <div className="mt-3 text-wrong font-bold">答案不对，再试一次</div>}
      </motion.div>
    </div>
  );
}

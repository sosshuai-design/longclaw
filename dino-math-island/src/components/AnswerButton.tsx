import { motion } from "framer-motion";
import { COLORS } from "../ui";

export type AnswerState = "idle" | "correct" | "wrong" | "dim";

interface Props {
  value: number;
  index: number; // 键盘序号 1/2/3
  state: AnswerState;
  disabled?: boolean;
  onPick: () => void;
}

export default function AnswerButton({ value, index, state, disabled, onPick }: Props) {
  const bg =
    state === "correct" ? COLORS.correct : state === "wrong" ? COLORS.wrong : "#FFFFFF";
  const color = state === "correct" || state === "wrong" ? "#fff" : COLORS.ink;

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onPick}
      whileTap={{ scale: 0.96 }}
      animate={state === "wrong" ? { x: [0, -10, 10, -8, 8, 0] } : { x: 0 }}
      transition={{ duration: 0.35 }}
      className="relative rounded-3xl shadow-pop font-extrabold grid place-items-center select-none"
      style={{
        background: bg,
        color,
        minHeight: "112px",
        fontSize: "44px",
        opacity: state === "dim" ? 0.45 : 1,
      }}
      aria-label={`选项 ${index}：${value}`}
    >
      <span
        className="absolute top-2 left-3 text-base font-bold rounded-full px-2"
        style={{ background: "rgba(0,0,0,0.06)", color: COLORS.ink, opacity: state === "idle" ? 1 : 0.3 }}
      >
        {index}
      </span>
      {value}
    </motion.button>
  );
}

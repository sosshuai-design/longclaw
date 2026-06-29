import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { statOf, todayKey } from "../engine/stats";

const EYE_REST_MS = 15 * 60 * 1000; // 每 15 分钟提醒看远处

/** 护眼休息 + 每日时长提醒（开发文档 §6.6 / §11 Phase 4）。 */
export default function RestReminder() {
  const settings = useGameStore((s) => s.settings);
  const daily = useGameStore((s) => s.profile.daily);
  const [show, setShow] = useState<null | "eye" | "limit">(null);
  const [limitDismissed, setLimitDismissed] = useState(false);

  // 每日时长上限
  const todayMs = statOf(daily, todayKey()).timeMs;
  const overLimit = settings.dailyTimeLimitMin > 0 && todayMs >= settings.dailyTimeLimitMin * 60_000;

  useEffect(() => {
    if (overLimit && !limitDismissed && show === null) setShow("limit");
  }, [overLimit, limitDismissed, show]);

  // 护眼提醒：每 15 分钟一次
  useEffect(() => {
    if (!settings.eyeRestReminder) return;
    const t = setInterval(() => setShow((cur) => cur ?? "eye"), EYE_REST_MS);
    return () => clearInterval(t);
  }, [settings.eyeRestReminder]);

  if (!show) return null;

  const isLimit = show === "limit";
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center" style={{ background: "rgba(58,47,91,0.55)" }}>
      <div className="bg-surface rounded-3xl shadow-soft p-8 text-center w-[min(420px,88vw)]">
        <div className="text-6xl mb-2">{isLimit ? "⏰" : "🌳"}</div>
        <h2 className="text-2xl font-extrabold text-ink">{isLimit ? "今天练习时间到啦" : "护眼小休息"}</h2>
        <p className="text-ink/70 mt-2">
          {isLimit
            ? "已经练习了不少啦，先休息休息，明天再来冒险吧！"
            : "抬头看看远处的窗外，眨眨眼睛，休息 20 秒～"}
        </p>
        <button
          onClick={() => {
            if (isLimit) setLimitDismissed(true);
            setShow(null);
          }}
          className="mt-5 rounded-full px-7 py-3 text-lg font-extrabold text-white shadow-pop"
          style={{ background: "#4FB286" }}
        >
          {isLimit ? "知道啦" : "休息好了 ✓"}
        </button>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import type { KnowledgePoint, Question, Unit } from "../engine/types";
import { useCurriculum } from "../App";
import { pickKpForUnit, isUnitUnlocked } from "../engine/curriculum";
import { generateQuestion } from "../engine/questionGenerator";
import {
  createAdaptiveState,
  evaluate,
  initLevelFromCalibration,
  type AdaptiveState,
} from "../engine/adaptiveDifficulty";
import { coinsForCorrect } from "../engine/rewards";
import { useGameStore } from "../store/gameStore";
import { UNIT_META, COLORS } from "../ui";
import { playCorrect, playWrong, playCoin } from "../audio/sfx";
import { speak } from "../audio/speech";
import VisualAids from "../components/VisualAids";
import AnswerButton, { type AnswerState } from "../components/AnswerButton";
import DifficultyMeter from "../components/DifficultyMeter";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export default function PlayPage() {
  const cur = useCurriculum();
  const navigate = useNavigate();
  const { unit } = useParams<{ unit: Unit }>();

  const settings = useGameStore((s) => s.settings);
  const mastery = useGameStore((s) => s.profile.mastery);
  const masteredCount = useGameStore((s) => s.profile.masteredCount);
  const recordAnswer = useGameStore((s) => s.recordAnswer);

  const roundQuestions = (cur.meta.roundQuestions as number) ?? 8;
  const calibrationN = (cur.meta.calibrationQuestions as number) ?? 3;

  // 选定本轮知识点（加/减），并算难度上限
  const kp = useMemo<KnowledgePoint | undefined>(() => {
    if (!unit || unit === "mixed") return undefined;
    if (!settings.enabledUnits.includes(unit)) return undefined;
    if (!settings.unlockAll && !isUnitUnlocked(cur, unit, mastery)) return undefined;
    return pickKpForUnit(cur, unit, mastery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  const meta = unit && unit !== "mixed" ? UNIT_META[unit] : undefined;
  const maxLevel = kp ? clamp(settings.maxDifficulty, 1, kp.levels.length) : 1;

  // —— 可变的轮次态用 ref，避免闭包陈旧 —— //
  const curLevel = useRef(1);
  const adaptive = useRef<AdaptiveState | null>(null);
  const calCorrect = useRef(0);
  const roundCorrect = useRef(0);
  const roundCoins = useRef(0);
  const startedAt = useRef(0);
  const masteredStart = useRef(masteredCount);
  const timers = useRef<number[]>([]);

  // —— 驱动渲染的状态 —— //
  const [qIndex, setQIndex] = useState(0);
  const [phase, setPhase] = useState<"calibration" | "main">("calibration");
  const [question, setQuestion] = useState<Question | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [toast, setToast] = useState<string>("");

  const genAt = useCallback(
    (level1: number) => {
      if (!kp) return null;
      const lv = kp.levels[clamp(level1, 1, maxLevel) - 1];
      return generateQuestion(kp, lv);
    },
    [kp, maxLevel]
  );

  const showQuestion = useCallback(
    (q: Question | null) => {
      setQuestion(q);
      setPicked(null);
      setLocked(false);
      startedAt.current = Date.now();
      if (q) speak(q.promptText, settings.sound);
    },
    [settings.sound]
  );

  // 初始化第一题
  useEffect(() => {
    if (!kp) {
      navigate("/", { replace: true });
      return;
    }
    curLevel.current = clamp(
      useGameStore.getState().profile.difficultyByKp[kp.id] ?? 2,
      1,
      maxLevel
    );
    masteredStart.current = useGameStore.getState().profile.masteredCount;
    showQuestion(genAt(curLevel.current));
    return () => timers.current.forEach((t) => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kp]);

  const finishRound = useCallback(() => {
    const total = roundQuestions - calibrationN;
    navigate("/result", {
      replace: true,
      state: {
        unit,
        kpId: kp?.id,
        correct: roundCorrect.current,
        total,
        coins: roundCoins.current,
        masteredStart: masteredStart.current,
      },
    });
  }, [navigate, unit, kp, roundQuestions, calibrationN]);

  const advance = useCallback(() => {
    const nextIndex = qIndex + 1;

    // 摸底结束 → 定档、进入正式
    if (phase === "calibration" && nextIndex >= calibrationN) {
      const startLv = initLevelFromCalibration(calCorrect.current, maxLevel);
      curLevel.current = startLv;
      adaptive.current = createAdaptiveState(startLv, maxLevel);
      setPhase("main");
      setToast("");
      setQIndex(nextIndex);
      showQuestion(genAt(curLevel.current));
      return;
    }

    if (nextIndex >= roundQuestions) {
      finishRound();
      return;
    }
    setQIndex(nextIndex);
    showQuestion(genAt(curLevel.current));
  }, [qIndex, phase, calibrationN, roundQuestions, maxLevel, genAt, showQuestion, finishRound]);

  const onPick = useCallback(
    (value: number) => {
      if (locked || !question || !kp) return;
      setLocked(true);
      setPicked(value);
      const correct = value === question.answer;
      const responseMs = Date.now() - startedAt.current;

      if (correct) {
        playCorrect();
        speak("答对啦", settings.sound);
      } else {
        playWrong();
        speak(`正确答案是 ${question.answer}`, settings.sound);
      }

      if (phase === "calibration") {
        if (correct) calCorrect.current += 1;
        setToast("摸底中…");
      } else {
        // 正式题：计奖励 + 掌握度 + 自适应
        recordAnswer({
          kpId: kp.id,
          correct,
          responseMs,
          level: question.level,
          masteryThreshold: kp.masteryThreshold,
        });
        if (correct) {
          roundCorrect.current += 1;
          roundCoins.current += coinsForCorrect(question.level);
          playCoin();
        }
        if (adaptive.current) {
          const dir = evaluate(adaptive.current, correct);
          curLevel.current = adaptive.current.level;
          if (dir === "up") setToast("难度升级 ⬆️");
          else if (dir === "down") setToast("放慢一点 ⬇️");
          else setToast(correct ? "答对啦！" : `正确答案：${question.answer}`);
        }
      }

      const delay = correct ? 850 : 1500; // 答错多停一会，绝不卡关
      const t = window.setTimeout(advance, delay);
      timers.current.push(t);
    },
    [locked, question, kp, phase, settings.sound, recordAnswer, advance]
  );

  // 键盘 1/2/3
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!question || locked) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < question.options.length) onPick(question.options[idx]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [question, locked, onPick]);

  if (!kp || !meta || !question) return null;

  const stateFor = (value: number): AnswerState => {
    if (!locked) return "idle";
    if (value === question.answer) return "correct";
    if (value === picked) return "wrong";
    return "dim";
  };

  const progress = Math.round(((qIndex + 1) / roundQuestions) * 100);
  // 题型阶梯（§8.3）：看图题才突出实物图示，算式/填空题更抽象
  const showVisual =
    !!question.visual &&
    (question.type === "pictureChoice" || question.type === "pictureToEquation");
  const isWord = question.type === "wordProblem"; // 应用题（V1）：读题，不显算式

  return (
    <div className="h-full flex flex-col p-4 md:p-6 max-w-6xl mx-auto w-full">
      {/* 顶部：返回 / 进度 / 本轮金币 */}
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => navigate("/")} className="rounded-2xl bg-white shadow-pop px-4 py-2 font-bold text-ink">
          ← 返回
        </button>
        <div className="flex-1 h-4 rounded-full bg-white overflow-hidden shadow-inner">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: meta.hex }} />
        </div>
        <div className="rounded-2xl bg-coin/15 px-4 py-2 font-extrabold text-ink">🪙 {roundCoins.current}</div>
      </div>

      <div className="flex-1 grid md:grid-cols-2 gap-6 items-stretch">
        {/* 左舞台 */}
        <div className="bg-surface rounded-3xl shadow-soft p-6 flex flex-col items-center justify-center gap-6" style={{ borderTop: `8px solid ${meta.hex}` }}>
          {isWord ? (
            <div className="flex flex-col items-center gap-4">
              <div className="text-5xl">📖🦕</div>
              <p className="text-3xl font-extrabold text-ink leading-relaxed text-center px-2">
                {question.promptText}
              </p>
              {locked && (
                <div className="text-2xl font-extrabold" style={{ color: COLORS.correct }}>
                  答案：{question.answer}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="min-h-[120px] grid place-items-center">
                {showVisual && question.visual ? (
                  <VisualAids visual={question.visual} op={question.op} />
                ) : (
                  <div className="text-6xl">{meta.emoji}</div>
                )}
              </div>
              <div className="text-equation text-ink flex items-center gap-3 flex-wrap justify-center">
                <span>{question.a}</span>
                <span>{question.op}</span>
                <span>{question.b}</span>
                <span>=</span>
                <span
                  className="inline-grid place-items-center rounded-2xl"
                  style={{
                    minWidth: 90,
                    borderBottom: locked ? "none" : "6px dashed #C9C0E0",
                    color: locked ? COLORS.correct : "#C9C0E0",
                  }}
                >
                  {locked ? question.answer : "?"}
                </span>
              </div>
            </>
          )}
          <button
            onClick={() => speak(question.promptText, settings.sound)}
            className="rounded-2xl bg-bg px-5 py-2 font-bold text-ink/80"
          >
            🔊 再读一遍
          </button>
        </div>

        {/* 右答题区 */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <DifficultyMeter level={curLevel.current} maxLevel={maxLevel} hex={meta.hex} />
            <div className="text-sm font-bold text-ink/50">{phase === "calibration" ? "摸底定档" : `第 ${qIndex - calibrationN + 1} / ${roundQuestions - calibrationN} 题`}</div>
          </div>

          <div className="min-h-[40px] text-center">
            <motion.span
              key={toast}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-extrabold"
              style={{ color: locked ? (picked === question.answer ? COLORS.correct : COLORS.wrong) : COLORS.ink }}
            >
              {toast || (phase === "calibration" ? "我们先来几道热身题～" : "选出正确答案吧！")}
            </motion.span>
          </div>

          <div className="grid grid-cols-2 gap-4 flex-1 content-center">
            {question.options.map((opt, i) => (
              <AnswerButton key={`${qIndex}-${i}-${opt}`} value={opt} index={i + 1} state={stateFor(opt)} disabled={locked} onPick={() => onPick(opt)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

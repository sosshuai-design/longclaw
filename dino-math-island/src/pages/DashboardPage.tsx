import { useNavigate } from "react-router-dom";
import type { Unit } from "../engine/types";
import { useCurriculum } from "../App";
import { useGameStore } from "../store/gameStore";
import { kpsByUnit } from "../engine/curriculum";
import { statOf, accuracy, todayKey, lastNDays, newlyMasteredThisWeek, mistakeList } from "../engine/stats";
import MasteryHeatmap from "../components/MasteryHeatmap";
import { UNIT_META } from "../ui";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface rounded-3xl shadow-soft p-5 text-center">
      <div className="text-3xl font-extrabold text-ink">{value}</div>
      <div className="text-sm text-ink/60 mt-1">{label}</div>
      {hint && <div className="text-xs text-ink/40 mt-0.5">{hint}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-3xl shadow-soft p-5">
      <h2 className="text-lg font-extrabold text-ink mb-3">{title}</h2>
      {children}
    </div>
  );
}

/** 掌握度看板（开发文档 §6.6）。 */
export default function DashboardPage() {
  const cur = useCurriculum();
  const navigate = useNavigate();
  const profile = useGameStore((s) => s.profile);
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const toggleUnit = useGameStore((s) => s.toggleUnit);
  const resetProfile = useGameStore((s) => s.resetProfile);

  const today = statOf(profile.daily, todayKey());
  const week = lastNDays(profile.daily, 7);
  const maxMs = Math.max(1, ...week.map((d) => d.stat.timeMs));
  const addSubKps = [...kpsByUnit(cur, "addition"), ...kpsByUnit(cur, "subtraction")];
  const mistakes = mistakeList(cur, profile.mastery);

  const ALL_UNITS: Exclude<Unit, "mixed">[] = ["addition", "subtraction", "multiplication", "division"];

  return (
    <div className="max-w-5xl mx-auto w-full p-4 md:p-6 flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/")} className="rounded-2xl bg-white shadow-pop px-4 py-2 font-bold text-ink">← 返回</button>
        <h1 className="text-2xl font-extrabold text-ink">教师 / 家长中心 📊</h1>
      </div>

      {/* 顶部统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="今日练习时长" value={`${(today.timeMs / 60000).toFixed(1)} 分`} />
        <StatCard label="今日正确率" value={`${accuracy(today)}%`} hint={`${today.correct}/${today.answered} 题`} />
        <StatCard label="本周新掌握" value={`${newlyMasteredThisWeek(profile.mastery)}`} hint="个知识点" />
        <StatCard label="连续天数" value={`${profile.streakDays}`} hint="天" />
      </div>

      {/* 9×9 热力图 */}
      <Section title="乘法口诀掌握度热力图">
        <MasteryHeatmap mastery={profile.mastery} />
        <p className="text-xs text-ink/40 mt-2">按整张乘法表着色（同一行/列共享该表掌握度）。</p>
      </Section>

      {/* 加减横条 + 本周时长 */}
      <div className="grid md:grid-cols-2 gap-5">
        <Section title="加减知识点掌握度">
          <div className="flex flex-col gap-2">
            {addSubKps.map((kp) => {
              const score = profile.mastery[kp.id]?.score ?? 0;
              const hex = UNIT_META[kp.unit as "addition" | "subtraction"].hex;
              return (
                <div key={kp.id} className="flex items-center gap-2">
                  <div className="text-sm text-ink/70 w-32 shrink-0 truncate">{kp.name}</div>
                  <div className="flex-1 h-4 rounded-full bg-bg overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${score}%`, background: hex }} />
                  </div>
                  <div className="text-xs text-ink/50 w-9 text-right">{score}</div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="本周练习时长">
          <div className="flex items-stretch gap-2 h-32">
            {week.map((d) => (
              <div key={d.key} className="flex-1 flex flex-col justify-end items-center gap-1">
                <div className="text-[10px] text-ink/50">{d.stat.timeMs ? `${Math.round(d.stat.timeMs / 60000)}` : ""}</div>
                <div className="w-full rounded-t-lg" style={{ height: `${(d.stat.timeMs / maxMs) * 100}%`, minHeight: d.stat.timeMs ? 4 : 0, background: "#5B8DEF" }} />
                <div className="text-[10px] text-ink/50">{d.label}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* 错题 + 复习挑战 */}
      <Section title="错题（按知识点）">
        {mistakes.length === 0 ? (
          <div className="text-ink/50">还没有错题，太棒了！</div>
        ) : (
          <>
            <div className="flex flex-col gap-1 mb-3">
              {mistakes.slice(0, 6).map((m) => (
                <div key={m.kp.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink/80">{m.kp.name}</span>
                  <span className="text-wrong font-bold">错 {m.wrong} 次</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate(`/play/${mistakes[0].kp.unit}`)}
              className="rounded-full px-6 py-3 font-extrabold text-white shadow-pop"
              style={{ background: "#FF8A5B" }}
            >
              一键生成复习挑战 🎯
            </button>
          </>
        )}
      </Section>

      {/* 设置 */}
      <Section title="设置">
        <div className="flex flex-col gap-4">
          <Toggle label="声音 / 朗读" on={settings.sound} onClick={toggleSound} />
          <Toggle label="护眼休息提醒" on={settings.eyeRestReminder} onClick={() => setSettings({ eyeRestReminder: !settings.eyeRestReminder })} />
          <Toggle label="教学演示：全部岛解锁（忽略前置）" on={settings.unlockAll} onClick={() => setSettings({ unlockAll: !settings.unlockAll })} />

          <div>
            <div className="text-sm font-bold text-ink/70 mb-2">难度上限</div>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setSettings({ maxDifficulty: n })}
                  className="w-12 h-12 rounded-2xl font-extrabold shadow-pop"
                  style={{ background: settings.maxDifficulty === n ? "#5B8DEF" : "#fff", color: settings.maxDifficulty === n ? "#fff" : "#3A2F5B" }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-bold text-ink/70 mb-2">每日时长上限：{settings.dailyTimeLimitMin} 分钟</div>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={settings.dailyTimeLimitMin}
              onChange={(e) => setSettings({ dailyTimeLimitMin: Number(e.target.value) })}
              className="w-full max-w-sm"
            />
          </div>

          <div>
            <div className="text-sm font-bold text-ink/70 mb-2">内容范围</div>
            <div className="flex gap-2 flex-wrap">
              {ALL_UNITS.map((u) => {
                const on = settings.enabledUnits.includes(u);
                return (
                  <button
                    key={u}
                    onClick={() => toggleUnit(u)}
                    className="rounded-2xl px-4 py-2 font-bold shadow-pop"
                    style={{ background: on ? UNIT_META[u].hex : "#fff", color: on ? "#fff" : "#3A2F5B" }}
                  >
                    {UNIT_META[u].emoji} {UNIT_META[u].label.replace("岛", "")}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-bg">
            <button
              onClick={() => { if (confirm("确定清空所有进度？此操作不可恢复。")) resetProfile(); }}
              className="rounded-full px-5 py-2 font-bold text-white"
              style={{ background: "#F2685E" }}
            >
              清空进度
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center justify-between w-full">
      <span className="text-sm font-bold text-ink/80">{label}</span>
      <span className="rounded-full transition-all" style={{ width: 52, height: 30, background: on ? "#2FB36B" : "#D9D3E8", position: "relative", display: "inline-block" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
      </span>
    </button>
  );
}

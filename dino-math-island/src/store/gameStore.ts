// 全局状态（Zustand）：档案、金币、掌握度、设置 + localStorage 持久化。
// 开发文档 §7。运行轮次态（当前题/进度/本轮金币）放在页面内存，不进这里。

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Profile, Settings, Unit } from "../engine/types";
import { newRecord, onAnswer, countMastered } from "../engine/masteryModel";
import { coinsForCorrect, type ChestResult } from "../engine/rewards";

const defaultProfile: Profile = {
  id: "kid-1",
  name: "小探险家",
  avatar: "🦕",
  coins: 0,
  masteredCount: 0,
  stickers: [],
  streakDays: 0,
  difficultyByKp: {},
  mastery: {},
};

const defaultSettings: Settings = {
  sound: true,
  dailyTimeLimitMin: 20,
  maxDifficulty: 4,
  enabledUnits: ["addition", "subtraction", "multiplication", "division"],
  eyeRestReminder: true,
};

interface GameState {
  profile: Profile;
  settings: Settings;

  /** 记一题：更新掌握度、已掌握数、金币（答对才给币） */
  recordAnswer: (args: {
    kpId: string;
    correct: boolean;
    responseMs: number;
    level: number;
    masteryThreshold: number;
  }) => void;

  setKpDifficulty: (kpId: string, level: number) => void;
  claimChest: (r: ChestResult) => void;
  setSettings: (patch: Partial<Settings>) => void;
  toggleSound: () => void;
  toggleUnit: (u: Unit) => void;
  resetProfile: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      profile: defaultProfile,
      settings: defaultSettings,

      recordAnswer: ({ kpId, correct, responseMs, level, masteryThreshold }) =>
        set((s) => {
          const prev = s.profile.mastery[kpId] ?? newRecord(kpId);
          const updated = onAnswer(prev, correct, responseMs, masteryThreshold);
          const mastery = { ...s.profile.mastery, [kpId]: updated };
          return {
            profile: {
              ...s.profile,
              mastery,
              masteredCount: countMastered(mastery),
              coins: s.profile.coins + (correct ? coinsForCorrect(level) : 0),
              difficultyByKp: { ...s.profile.difficultyByKp, [kpId]: level },
            },
          };
        }),

      setKpDifficulty: (kpId, level) =>
        set((s) => ({
          profile: { ...s.profile, difficultyByKp: { ...s.profile.difficultyByKp, [kpId]: level } },
        })),

      claimChest: (r) =>
        set((s) => {
          const stickers =
            r.gotSticker && !s.profile.stickers.includes(r.stickerId)
              ? [...s.profile.stickers, r.stickerId]
              : s.profile.stickers;
          return { profile: { ...s.profile, coins: s.profile.coins + r.coins, stickers } };
        }),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      toggleSound: () => set((s) => ({ settings: { ...s.settings, sound: !s.settings.sound } })),
      toggleUnit: (u) =>
        set((s) => {
          const on = s.settings.enabledUnits.includes(u);
          return {
            settings: {
              ...s.settings,
              enabledUnits: on
                ? s.settings.enabledUnits.filter((x) => x !== u)
                : [...s.settings.enabledUnits, u],
            },
          };
        }),
      resetProfile: () => set({ profile: { ...defaultProfile, mastery: {}, difficultyByKp: {}, stickers: [] } }),
    }),
    {
      name: "dmi.store",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ profile: s.profile, settings: s.settings }),
    }
  )
);

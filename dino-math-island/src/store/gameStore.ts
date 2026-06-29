// 全局状态（Zustand）：多档案、金币、掌握度、每日统计、设置 + localStorage 持久化。
// 开发文档 §7：支持多孩子档案（数组），可切换；设置为全局。

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Profile, Settings, Unit } from "../engine/types";
import { newRecord, onAnswer, countMastered } from "../engine/masteryModel";
import { coinsForCorrect, type ChestResult } from "../engine/rewards";
import { todayKey, nextStreak } from "../engine/stats";

export const AVATARS = ["🦕", "🦖", "🐲", "🦎", "🐊", "🦕"];

function makeProfile(id: string, name: string, avatar: string): Profile {
  return {
    id,
    name,
    avatar,
    coins: 0,
    masteredCount: 0,
    stickers: [],
    streakDays: 0,
    difficultyByKp: {},
    mastery: {},
    daily: {},
  };
}

const defaultSettings: Settings = {
  sound: true,
  dailyTimeLimitMin: 20,
  maxDifficulty: 4,
  enabledUnits: ["addition", "subtraction", "multiplication", "division"],
  eyeRestReminder: true,
  unlockAll: false,
};

interface GameState {
  profiles: Profile[];
  activeId: string;
  profile: Profile; // 镜像 = 当前激活档案，供组件直接读取
  settings: Settings;

  recordAnswer: (args: {
    kpId: string;
    correct: boolean;
    responseMs: number;
    level: number;
    masteryThreshold: number;
  }) => void;

  claimChest: (r: ChestResult) => void;
  setSettings: (patch: Partial<Settings>) => void;
  toggleSound: () => void;
  toggleUnit: (u: Unit) => void;
  resetProfile: () => void;

  // 多档案
  addProfile: (name: string, avatar: string) => void;
  switchProfile: (id: string) => void;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
}

/** 用 updater 更新当前激活档案，并同步回 profiles 数组 */
function withActive(s: GameState, updater: (p: Profile) => Profile) {
  const profile = updater(s.profile);
  const profiles = s.profiles.map((p) => (p.id === s.activeId ? profile : p));
  return { profile, profiles };
}

const firstProfile = makeProfile("kid-1", "小探险家", "🦕");

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      profiles: [firstProfile],
      activeId: firstProfile.id,
      profile: firstProfile,
      settings: defaultSettings,

      recordAnswer: ({ kpId, correct, responseMs, level, masteryThreshold }) =>
        set((s) =>
          withActive(s, (p) => {
            const prev = p.mastery[kpId] ?? newRecord(kpId);
            const updated = onAnswer(prev, correct, responseMs, masteryThreshold);
            const mastery = { ...p.mastery, [kpId]: updated };

            const today = todayKey();
            const d = p.daily[today] ?? { answered: 0, correct: 0, timeMs: 0 };
            const daily = {
              ...p.daily,
              [today]: {
                answered: d.answered + 1,
                correct: d.correct + (correct ? 1 : 0),
                timeMs: d.timeMs + Math.min(responseMs, 60_000),
              },
            };

            return {
              ...p,
              mastery,
              masteredCount: countMastered(mastery),
              coins: p.coins + (correct ? coinsForCorrect(level) : 0),
              difficultyByKp: { ...p.difficultyByKp, [kpId]: level },
              daily,
              streakDays: nextStreak(p),
              lastActiveDay: today,
            };
          })
        ),

      claimChest: (r) =>
        set((s) =>
          withActive(s, (p) => {
            const stickers =
              r.gotSticker && !p.stickers.includes(r.stickerId)
                ? [...p.stickers, r.stickerId]
                : p.stickers;
            return { ...p, coins: p.coins + r.coins, stickers };
          })
        ),

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
      resetProfile: () => set((s) => withActive(s, (p) => makeProfile(p.id, p.name, p.avatar))),

      addProfile: (name, avatar) =>
        set((s) => {
          const id = "kid-" + Date.now();
          const np = makeProfile(id, name.trim() || "小恐龙", avatar);
          return { profiles: [...s.profiles, np], activeId: id, profile: np };
        }),
      switchProfile: (id) =>
        set((s) => {
          const p = s.profiles.find((x) => x.id === id);
          return p ? { activeId: id, profile: p } : {};
        }),
      renameProfile: (id, name) =>
        set((s) => {
          const profiles = s.profiles.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p));
          const profile = profiles.find((p) => p.id === s.activeId) ?? s.profile;
          return { profiles, profile };
        }),
      deleteProfile: (id) =>
        set((s) => {
          if (s.profiles.length <= 1) return {};
          const profiles = s.profiles.filter((p) => p.id !== id);
          const activeId = s.activeId === id ? profiles[0].id : s.activeId;
          const profile = profiles.find((p) => p.id === activeId) ?? profiles[0];
          return { profiles, activeId, profile };
        }),
    }),
    {
      name: "dmi.store",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ profiles: s.profiles, activeId: s.activeId, settings: s.settings }),
      migrate: (persisted) => {
        const p = persisted as {
          profile?: Profile;
          profiles?: Profile[];
          activeId?: string;
          settings?: Partial<Settings>;
        };
        // v1/v2：单档案 → 转成数组
        if (p && p.profile && !p.profiles) {
          if (!p.profile.daily) p.profile.daily = {};
          p.profiles = [p.profile];
          p.activeId = p.profile.id;
          delete p.profile;
        }
        (p.profiles ?? []).forEach((pr) => {
          if (!pr.daily) pr.daily = {};
        });
        if (p.settings && p.settings.unlockAll === undefined) p.settings.unlockAll = false;
        return p as unknown as GameState;
      },
      // partialize 没存 profile 镜像，rehydrate 后重建它
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>;
        const profiles = p.profiles ?? current.profiles;
        const activeId = p.activeId ?? current.activeId;
        const profile = profiles.find((x) => x.id === activeId) ?? profiles[0] ?? current.profile;
        return {
          ...current,
          ...p,
          profiles,
          activeId,
          profile,
          settings: { ...current.settings, ...(p.settings ?? {}) },
        };
      },
    }
  )
);

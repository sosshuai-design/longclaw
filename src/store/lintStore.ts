import { create } from 'zustand';
import { LintReport } from '../types';
import { runLint } from '../services/lint';
import { LLMProviderKey } from '../types';

interface LintState {
  report: LintReport | null;
  isRunning: boolean;
  progress: string;
  lastRanAt: string | null;

  runLintCheck: (providerKey: LLMProviderKey) => Promise<void>;
  dismissConflict: (id: string) => void;
  dismissOrphan: (pageId: string) => void;
  dismissSuggestion: (concept: string) => void;
  dismissExploration: (topic: string) => void;
  clearReport: () => void;
}

export const useLintStore = create<LintState>((set, get) => ({
  report: null,
  isRunning: false,
  progress: '',
  lastRanAt: null,

  runLintCheck: async (providerKey) => {
    set({ isRunning: true, progress: '准备中…' });
    try {
      const report = await runLint(providerKey, (step) => set({ progress: step }));
      set({ report, lastRanAt: new Date().toISOString() });
    } finally {
      set({ isRunning: false, progress: '' });
    }
  },

  dismissConflict: (id) => {
    const { report } = get();
    if (!report) return;
    set({
      report: {
        ...report,
        conflicts: report.conflicts.filter((c) => c.id !== id),
      },
    });
  },

  dismissOrphan: (pageId) => {
    const { report } = get();
    if (!report) return;
    set({
      report: {
        ...report,
        orphans: report.orphans.filter((o) => o.pageId !== pageId),
      },
    });
  },

  dismissSuggestion: (concept) => {
    const { report } = get();
    if (!report) return;
    set({
      report: {
        ...report,
        suggestions: report.suggestions.filter((s) => s.concept !== concept),
      },
    });
  },

  dismissExploration: (topic) => {
    const { report } = get();
    if (!report) return;
    set({
      report: {
        ...report,
        explorations: report.explorations.filter((e) => e.topic !== topic),
      },
    });
  },

  clearReport: () => set({ report: null }),
}));

import { create } from 'zustand';
import { WikiPage, WikiStats, WikiCategory } from '../types';
import {
  listAllWikiPages,
  createWikiPage,
  updateWikiPage,
  deleteWikiPage,
  deleteRawFiles,
  computeStats,
  rebuildIndex,
  appendLog,
} from '../services/wiki';

interface WikiState {
  pages: WikiPage[];
  stats: WikiStats;
  isLoading: boolean;
  selectedCategory: WikiCategory | 'all';

  loadPages: () => Promise<void>;
  addPage: (params: Parameters<typeof createWikiPage>[0]) => Promise<WikiPage>;
  editPage: (filePath: string, updates: Parameters<typeof updateWikiPage>[1]) => Promise<void>;
  removePage: (filePath: string) => Promise<void>;
  refreshStats: () => Promise<void>;
  setSelectedCategory: (cat: WikiCategory | 'all') => void;
  getFilteredPages: () => WikiPage[];
  getRecentPages: (n: number) => WikiPage[];
}

export const useWikiStore = create<WikiState>((set, get) => ({
  pages: [],
  stats: { totalPages: 0, totalRawFiles: 0, totalReferences: 0, pendingConflicts: 0 },
  isLoading: false,
  selectedCategory: 'all',

  loadPages: async () => {
    set({ isLoading: true });
    try {
      const pages = await listAllWikiPages();
      const stats = await computeStats();
      set({ pages, stats });
    } finally {
      set({ isLoading: false });
    }
  },

  addPage: async (params) => {
    const page = await createWikiPage(params);
    const pages = [...get().pages, page].sort((a, b) => b.updated.localeCompare(a.updated));
    set({ pages });

    // 重建 index.md
    await rebuildIndex(pages);

    // 追加 log.md
    await appendLog({
      date: new Date().toISOString().slice(0, 10),
      type: params.source === 'ingest' ? 'ingest' : params.source === 'query' ? 'query' : 'manual',
      title: params.title,
      actions: [`新建：${params.title}`],
    });

    const stats = await computeStats();
    set({ stats });
    return page;
  },

  editPage: async (filePath, updates) => {
    const updated = await updateWikiPage(filePath, updates);
    if (!updated) return;
    const pages = get().pages.map((p) => (p.filePath === filePath ? updated : p));
    set({ pages });
    await rebuildIndex(pages);
  },

  removePage: async (filePath) => {
    const page = get().pages.find((p) => p.filePath === filePath);
    await deleteWikiPage(filePath);
    if (page?.sourceFiles?.length) {
      await deleteRawFiles(page.sourceFiles);
    }
    const pages = get().pages.filter((p) => p.filePath !== filePath);
    set({ pages });
    await rebuildIndex(pages);
    const stats = await computeStats();
    set({ stats });
  },

  refreshStats: async () => {
    const stats = await computeStats();
    set({ stats });
  },

  setSelectedCategory: (cat) => set({ selectedCategory: cat }),

  getFilteredPages: () => {
    const { pages, selectedCategory } = get();
    if (selectedCategory === 'all') return pages;
    return pages.filter((p) => p.category === selectedCategory);
  },

  getRecentPages: (n) => {
    return get().pages.slice(0, n);
  },
}));

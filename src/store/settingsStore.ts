import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LLMProviderKey } from '../types';

interface SettingsState {
  activeProvider: LLMProviderKey;
  autoLintEnabled: boolean;
  iCloudSyncEnabled: boolean;
  isLoaded: boolean;

  setActiveProvider: (provider: LLMProviderKey) => void;
  setAutoLint: (enabled: boolean) => void;
  setICloudSync: (enabled: boolean) => void;
  loadSettings: () => Promise<void>;
}

const STORAGE_KEY = 'wikimind_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  activeProvider: 'deepseek',
  autoLintEnabled: false,
  iCloudSyncEnabled: false,
  isLoaded: false,

  setActiveProvider: (provider) => {
    set({ activeProvider: provider });
    persistSettings(get());
  },

  setAutoLint: (enabled) => {
    set({ autoLintEnabled: enabled });
    persistSettings(get());
  },

  setICloudSync: (enabled) => {
    set({ iCloudSyncEnabled: enabled });
    persistSettings(get());
  },

  loadSettings: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        set({ ...saved, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },
}));

function persistSettings(state: SettingsState) {
  const { activeProvider, autoLintEnabled, iCloudSyncEnabled } = state;
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ activeProvider, autoLintEnabled, iCloudSyncEnabled })
  ).catch(console.error);
}

export const Colors = {
  // 主色
  primary: '#4C44A8',
  primaryLight: '#EEEDFE',
  primaryDark: '#3C3489',

  // AI 整理来源（紫色系）
  ai: '#534AB7',
  aiBg: '#EEEDFE',
  aiDark: '#3C3489',

  // 用户手动来源（粉色系）
  user: '#D4537E',
  userBg: '#FBEAF0',
  userDark: '#72243E',

  // 分类颜色
  category: {
    concept: { bg: '#EEEDFE', text: '#3C3489' },
    note: { bg: '#E6F1FB', text: '#0C447C' },
    diary: { bg: '#FBEAF0', text: '#72243E' },
    tool: { bg: '#E1F5EE', text: '#085041' },
  },

  // Lint 状态色
  lint: {
    conflict: '#A32D2D',
    orphan: '#854F0B',
    suggest: '#185FA5',
    explore: '#1D9E75',
  },

  // FAB 按钮色
  fab: {
    note: '#F97316',    // 快速笔记（橙色）
    diary: '#D4537E',   // 日常记录（粉色）
    cognition: '#16A34A', // 认知总结（绿色）
    wiki: '#4C44A8',    // 知识页面（紫色）
  },

  // 通用
  background: '#FFFFFF',
  backgroundDark: '#0F0F0F',
  surface: '#F8F8FC',
  surfaceDark: '#1A1A2E',
  border: 'rgba(0,0,0,0.08)',
  borderDark: 'rgba(255,255,255,0.1)',

  text: {
    primary: '#1A1A2E',
    secondary: '#6B6B8A',
    tertiary: '#9999B3',
    inverse: '#FFFFFF',
    primaryDark: '#F0F0FF',
    secondaryDark: '#9090B0',
  },

  // 状态
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',

  // Ingest 模式提示条
  ingestBanner: '#D1FAE5',
  ingestBannerText: '#065F46',
};

export const CategoryLabels: Record<string, string> = {
  concept: '概念',
  note: '笔记',
  diary: '日记',
  tool: '工具',
};

export const CategoryKeys = Object.keys(CategoryLabels);

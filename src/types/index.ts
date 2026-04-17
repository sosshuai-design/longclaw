// ─── 用户 ───────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

// ─── Wiki 页面 ──────────────────────────────────────────────────────────────
export type WikiCategory =
  | 'concept'
  | 'architecture'
  | 'comparison'
  | 'summary'
  | 'diary'
  | 'note'
  | 'cognition'
  | 'tool'
  | 'personal';

export type WikiSource = 'ingest' | 'query' | 'manual';

export interface WikiPage {
  id: string;
  title: string;
  category: WikiCategory;
  tags: string[];
  created: string;
  updated: string;
  source: WikiSource;
  sourceFiles?: string[];
  references: number;
  content: string;     // Markdown 正文（含 front matter）
  filePath: string;    // wiki/pages/xxx/xxx.md 相对路径
}

export interface WikiFrontMatter {
  title: string;
  category: WikiCategory;
  tags: string[];
  created: string;
  updated: string;
  source: WikiSource;
  source_files?: string[];
  references: number;
}

// ─── 操作日志 ────────────────────────────────────────────────────────────────
export interface LogEntry {
  date: string;
  type: 'ingest' | 'query' | 'lint' | 'manual';
  title: string;
  actions: string[];
}

// ─── 聊天消息 ────────────────────────────────────────────────────────────────
export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  attachments?: Attachment[];
  wikiRefs?: WikiRef[];    // AI 回复中引用的 Wiki 页面
  canSaveToWiki?: boolean; // Query 模式下 AI 回答可存入 Wiki
}

export type AttachmentType = 'url' | 'pdf' | 'image' | 'audio' | 'photo' | 'wikiRef';

export interface Attachment {
  id: string;
  type: AttachmentType;
  name: string;
  uri?: string;
  text?: string;     // 已提取的文字内容
  wikiPageId?: string;
}

export interface WikiRef {
  pageId: string;
  title: string;
  category: WikiCategory;
}

// ─── 聊天模式 ────────────────────────────────────────────────────────────────
export type ChatMode = 'ingest' | 'query';

// ─── LLM Provider ───────────────────────────────────────────────────────────
export type LLMProviderKey =
  | 'deepseek'
  | 'qwen'
  | 'doubao'
  | 'glm'
  | 'baichuan'
  | 'claude'
  | 'openai'
  | 'ollama';

export interface LLMProvider {
  key: LLMProviderKey;
  name: string;
  baseURL: string;
  model: string;
}

// ─── 统计 ────────────────────────────────────────────────────────────────────
export interface WikiStats {
  totalPages: number;
  totalRawFiles: number;
  totalReferences: number;
  pendingConflicts: number;
}

// ─── 导航参数 ────────────────────────────────────────────────────────────────
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Chat: { mode?: ChatMode; pageTitle?: string; pageId?: string };
  Wiki: undefined;
  Settings: undefined;
};

export type WikiStackParamList = {
  WikiList: undefined;
  WikiDetail: { pageId: string };
  WikiNew: { type: 'note' | 'diary' | 'cognition' | 'wiki' | 'link' };
  WikiEdit: { pageId: string };
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Lint: undefined;
  SystemFiles: undefined;
  Search: undefined;
};

// ─── Lint 报告 ───────────────────────────────────────────────────────────────
export interface LintReport {
  conflicts: ConflictItem[];
  orphans: OrphanItem[];
  suggestions: SuggestionItem[];
  explorations: ExplorationItem[];
  generatedAt: string;
}

export interface ConflictItem {
  id: string;
  page1Title: string;
  page1Id: string;
  page2Title: string;
  page2Id: string;
  description: string;
}

export interface OrphanItem {
  pageId: string;
  title: string;
  category: WikiCategory;
}

export interface SuggestionItem {
  concept: string;
  mentionedIn: string[];
  mentionCount: number;
}

export interface ExplorationItem {
  topic: string;
  reason: string;
  suggestedQuery: string;
}

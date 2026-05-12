/**
 * wiki.ts — 本地 Wiki 文件系统服务
 *
 * 目录结构：
 *   <docDir>/WikiMind/
 *     raw/articles | pdfs | audio | assets
 *     wiki/index.md | log.md | pages/<category>/<slug>.md
 *     WIKI_SCHEMA.md
 */

import * as FileSystem from 'expo-file-system';
import { WikiPage, WikiFrontMatter, WikiCategory, WikiSource, LogEntry, WikiStats } from '../types';

// ─── 根路径 ──────────────────────────────────────────────────────────────────

export function getWikiRootDir(): string {
  return `${FileSystem.documentDirectory}WikiMind/`;
}

export function getRawDir(): string {
  return `${getWikiRootDir()}raw/`;
}

export function getWikiDir(): string {
  return `${getWikiRootDir()}wiki/`;
}

export function getPagesDir(): string {
  return `${getWikiDir()}pages/`;
}

export function getIndexPath(): string {
  return `${getWikiDir()}index.md`;
}

export function getLogPath(): string {
  return `${getWikiDir()}log.md`;
}

export function getSchemaPath(): string {
  return `${getWikiRootDir()}WIKI_SCHEMA.md`;
}

// ─── 初始化 ──────────────────────────────────────────────────────────────────

export async function initWikiFileSystem(): Promise<void> {
  const dirs = [
    getWikiRootDir(),
    getRawDir(),
    `${getRawDir()}articles/`,
    `${getRawDir()}pdfs/`,
    `${getRawDir()}audio/`,
    `${getRawDir()}assets/`,
    getWikiDir(),
    getPagesDir(),
    `${getPagesDir()}concepts/`,
    `${getPagesDir()}architecture/`,
    `${getPagesDir()}comparisons/`,
    `${getPagesDir()}summaries/`,
    `${getPagesDir()}personal/`,
    `${getPagesDir()}tools/`,
  ];

  for (const dir of dirs) {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }

  // 初始化 index.md
  const indexInfo = await FileSystem.getInfoAsync(getIndexPath());
  if (!indexInfo.exists) {
    await FileSystem.writeAsStringAsync(
      getIndexPath(),
      `# Wiki 索引\n\n更新时间：${today()}\n\n`
    );
  }

  // 初始化 log.md
  const logInfo = await FileSystem.getInfoAsync(getLogPath());
  if (!logInfo.exists) {
    await FileSystem.writeAsStringAsync(
      getLogPath(),
      `# 操作日志\n\n`
    );
  }

  // 初始化 WIKI_SCHEMA.md
  const schemaInfo = await FileSystem.getInfoAsync(getSchemaPath());
  if (!schemaInfo.exists) {
    await FileSystem.writeAsStringAsync(getSchemaPath(), DEFAULT_SCHEMA);
  }
}

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function now(): string {
  return new Date().toISOString();
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .slice(0, 60);
}

function categoryToFolder(category: WikiCategory): string {
  const map: Record<WikiCategory, string> = {
    concept: 'concepts',
    architecture: 'architecture',
    comparison: 'comparisons',
    summary: 'summaries',
    diary: 'personal',
    note: 'personal',
    cognition: 'personal',
    tool: 'tools',
    personal: 'personal',
  };
  return map[category] ?? 'personal';
}

// ─── Front Matter 解析 / 序列化 ──────────────────────────────────────────────

export function parseFrontMatter(raw: string): { meta: WikiFrontMatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return {
      meta: {
        title: '',
        category: 'note',
        tags: [],
        created: today(),
        updated: today(),
        source: 'manual',
        references: 0,
      },
      body: raw,
    };
  }

  const yamlStr = match[1];
  const body = match[2];
  const meta: Partial<WikiFrontMatter> = {};

  for (const line of yamlStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();

    if (key === 'title') meta.title = val;
    else if (key === 'category') meta.category = val as WikiCategory;
    else if (key === 'created') meta.created = val;
    else if (key === 'updated') meta.updated = val;
    else if (key === 'source') meta.source = val as WikiSource;
    else if (key === 'references') meta.references = parseInt(val, 10) || 0;
    else if (key === 'tags') {
      meta.tags = val
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    } else if (key === 'source_files') {
      meta.source_files = val
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    } else if (key === 'schema_version') {
      meta.schema_version = parseInt(val, 10) || 1;
    }
  }

  return {
    meta: {
      title: meta.title ?? '',
      category: meta.category ?? 'note',
      tags: meta.tags ?? [],
      created: meta.created ?? today(),
      updated: meta.updated ?? today(),
      source: meta.source ?? 'manual',
      source_files: meta.source_files,
      references: meta.references ?? 0,
      schema_version: meta.schema_version ?? 1,
    },
    body,
  };
}

export function serializeFrontMatter(meta: WikiFrontMatter, body: string): string {
  const tagsStr = `[${meta.tags.join(', ')}]`;
  const sourceFilesLine = meta.source_files?.length
    ? `\nsource_files: [${meta.source_files.join(', ')}]`
    : '';

  return `---
title: ${meta.title}
category: ${meta.category}
tags: ${tagsStr}
created: ${meta.created}
updated: ${meta.updated}
source: ${meta.source}${sourceFilesLine}
references: ${meta.references}
schema_version: ${meta.schema_version ?? 1}
---
${body}`;
}

// ─── Wiki 页面 CRUD ──────────────────────────────────────────────────────────

export async function createWikiPage(params: {
  title: string;
  category: WikiCategory;
  tags: string[];
  source: WikiSource;
  content: string;
  sourceFiles?: string[];
}): Promise<WikiPage> {
  const { title, category, tags, source, content, sourceFiles } = params;
  const id = `${Date.now()}-${slugify(title)}`;
  const folder = categoryToFolder(category);
  const fileName = `${slugify(title)}-${Date.now()}.md`;
  const filePath = `wiki/pages/${folder}/${fileName}`;
  const absolutePath = `${getWikiRootDir()}${filePath}`;

  const meta: WikiFrontMatter = {
    title,
    category,
    tags,
    created: today(),
    updated: today(),
    source,
    source_files: sourceFiles,
    references: 0,
  };

  const fullContent = serializeFrontMatter(meta, content);
  await FileSystem.writeAsStringAsync(absolutePath, fullContent);

  return {
    id,
    title,
    category,
    tags,
    created: meta.created,
    updated: meta.updated,
    source,
    sourceFiles,
    references: 0,
    content: fullContent,
    filePath,
  };
}

export async function readWikiPage(filePath: string): Promise<WikiPage | null> {
  const absolutePath = `${getWikiRootDir()}${filePath}`;
  const info = await FileSystem.getInfoAsync(absolutePath);
  if (!info.exists) return null;

  const raw = await FileSystem.readAsStringAsync(absolutePath);
  const { meta, body } = parseFrontMatter(raw);

  return {
    id: filePath,
    title: meta.title,
    category: meta.category,
    tags: meta.tags,
    created: meta.created,
    updated: meta.updated,
    source: meta.source,
    sourceFiles: meta.source_files,
    references: meta.references,
    content: raw,
    filePath,
  };
}

export async function updateWikiPage(
  filePath: string,
  updates: Partial<{ title: string; content: string; tags: string[]; category: WikiCategory }>
): Promise<WikiPage | null> {
  const absolutePath = `${getWikiRootDir()}${filePath}`;
  const info = await FileSystem.getInfoAsync(absolutePath);
  if (!info.exists) return null;

  const raw = await FileSystem.readAsStringAsync(absolutePath);
  const { meta, body } = parseFrontMatter(raw);

  const newMeta: WikiFrontMatter = {
    ...meta,
    ...updates,
    updated: today(),
  };

  const newBody = updates.content !== undefined ? updates.content : body;
  const fullContent = serializeFrontMatter(newMeta, newBody);
  await FileSystem.writeAsStringAsync(absolutePath, fullContent);

  return {
    id: filePath,
    title: newMeta.title,
    category: newMeta.category,
    tags: newMeta.tags,
    created: newMeta.created,
    updated: newMeta.updated,
    source: newMeta.source,
    references: newMeta.references,
    content: fullContent,
    filePath,
  };
}

export async function deleteWikiPage(filePath: string): Promise<void> {
  const absolutePath = `${getWikiRootDir()}${filePath}`;
  await FileSystem.deleteAsync(absolutePath, { idempotent: true });
}

export async function deleteRawFiles(sourceFiles: string[]): Promise<void> {
  for (const rel of sourceFiles) {
    const abs = `${getWikiRootDir()}${rel}`;
    await FileSystem.deleteAsync(abs, { idempotent: true });
  }
}

// ─── 列出所有 Wiki 页面 ──────────────────────────────────────────────────────

export async function listAllWikiPages(): Promise<WikiPage[]> {
  const pages: WikiPage[] = [];
  const folders = ['concepts', 'architecture', 'comparisons', 'summaries', 'personal', 'tools'];

  for (const folder of folders) {
    const dirPath = `${getPagesDir()}${folder}/`;
    const info = await FileSystem.getInfoAsync(dirPath);
    if (!info.exists) continue;

    const files = await FileSystem.readDirectoryAsync(dirPath);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const relativePath = `wiki/pages/${folder}/${file}`;
      const page = await readWikiPage(relativePath);
      if (page) pages.push(page);
    }
  }

  // 按更新时间倒序
  return pages.sort((a, b) => b.updated.localeCompare(a.updated));
}

// ─── index.md 操作 ────────────────────────────────────────────────────────────

export async function readIndex(): Promise<string> {
  const info = await FileSystem.getInfoAsync(getIndexPath());
  if (!info.exists) return '';
  return FileSystem.readAsStringAsync(getIndexPath());
}

export async function rebuildIndex(pages: WikiPage[]): Promise<void> {
  const grouped: Record<string, WikiPage[]> = {};
  for (const p of pages) {
    const key = p.category;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }

  const categoryNames: Record<WikiCategory, string> = {
    concept: '概念',
    architecture: '架构',
    comparison: '对比',
    summary: '摘要',
    diary: '日记',
    note: '笔记',
    cognition: '认知',
    tool: '工具',
    personal: '个人',
  };

  let content = `# Wiki 索引\n\n更新时间：${today()}\n\n`;
  for (const [cat, catPages] of Object.entries(grouped)) {
    const label = categoryNames[cat as WikiCategory] ?? cat;
    content += `## ${label}（${catPages.length}页）\n\n`;
    for (const p of catPages) {
      const summary = extractFirstSentence(p.content);
      content += `- [[${p.title}]] — ${summary} · ${p.references}引用\n`;
    }
    content += '\n';
  }

  await FileSystem.writeAsStringAsync(getIndexPath(), content);
}

function extractFirstSentence(content: string): string {
  const body = content.replace(/^---[\s\S]*?---\n/, '').trim();
  const firstLine = body
    .split('\n')
    .find((l) => l.trim() && !l.startsWith('#'));
  return (firstLine ?? '').slice(0, 60).trim();
}

// ─── log.md 操作 ─────────────────────────────────────────────────────────────

export async function appendLog(entry: LogEntry): Promise<void> {
  const existing = await FileSystem.readAsStringAsync(getLogPath()).catch(() => '# 操作日志\n\n');
  const actionsStr = entry.actions.map((a) => `- ${a}`).join('\n');
  const block = `\n## [${entry.date}] ${entry.type} | ${entry.title}\n\n${actionsStr}\n`;
  await FileSystem.writeAsStringAsync(getLogPath(), existing + block);
}

export async function readLog(): Promise<string> {
  const info = await FileSystem.getInfoAsync(getLogPath());
  if (!info.exists) return '# 操作日志\n\n';
  return FileSystem.readAsStringAsync(getLogPath());
}

// ─── WIKI_SCHEMA.md 操作 ─────────────────────────────────────────────────────

export async function readSchema(): Promise<string> {
  const info = await FileSystem.getInfoAsync(getSchemaPath());
  if (!info.exists) return DEFAULT_SCHEMA;
  return FileSystem.readAsStringAsync(getSchemaPath());
}

export async function writeSchema(content: string): Promise<void> {
  await FileSystem.writeAsStringAsync(getSchemaPath(), content);
}

// ─── 原始资料操作 ─────────────────────────────────────────────────────────────

export async function saveRawFile(
  subDir: 'articles' | 'pdfs' | 'audio' | 'assets',
  fileName: string,
  content: string
): Promise<string> {
  const path = `${getRawDir()}${subDir}/${fileName}`;
  await FileSystem.writeAsStringAsync(path, content);
  return `raw/${subDir}/${fileName}`;
}

export async function listRawFiles(
  subDir: 'articles' | 'pdfs' | 'audio' | 'assets'
): Promise<string[]> {
  const dirPath = `${getRawDir()}${subDir}/`;
  const info = await FileSystem.getInfoAsync(dirPath);
  if (!info.exists) return [];
  return FileSystem.readDirectoryAsync(dirPath);
}

// ─── 原始文件管理 ─────────────────────────────────────────────────────────────

export interface RawFileInfo {
  name: string;
  absolutePath: string;
  relativePath: string;
  size: number;
  modifiedAt: number;
  category: 'articles' | 'pdfs' | 'audio' | 'assets';
}

export async function listRawFilesDetailed(
  subDir: 'articles' | 'pdfs' | 'audio' | 'assets'
): Promise<RawFileInfo[]> {
  const dirPath = `${getRawDir()}${subDir}/`;
  const info = await FileSystem.getInfoAsync(dirPath);
  if (!info.exists) return [];

  const names = await FileSystem.readDirectoryAsync(dirPath);
  const result: RawFileInfo[] = [];
  for (const name of names) {
    const abs = `${dirPath}${name}`;
    const fi = await FileSystem.getInfoAsync(abs, { size: true });
    result.push({
      name,
      absolutePath: abs,
      relativePath: `raw/${subDir}/${name}`,
      size: (fi as any).size ?? 0,
      modifiedAt: (fi as any).modificationTime ?? 0,
      category: subDir,
    });
  }
  return result.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

export async function uploadRawFile(
  sourceUri: string,
  subDir: 'articles' | 'pdfs' | 'audio' | 'assets',
  filename: string
): Promise<void> {
  const dirPath = `${getRawDir()}${subDir}/`;
  const info = await FileSystem.getInfoAsync(dirPath);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  }
  await FileSystem.copyAsync({ from: sourceUri, to: `${dirPath}${filename}` });
}

export async function deleteRawFile(absolutePath: string): Promise<void> {
  await FileSystem.deleteAsync(absolutePath, { idempotent: true });
}

// ─── 数据导出 ────────────────────────────────────────────────────────────────

export async function exportWikiAsJSON(): Promise<string> {
  const pages = await listAllWikiPages();
  const schema = await readSchema();
  const index = await readIndex();

  const exportData = {
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    totalPages: pages.length,
    pages: pages.map((p) => ({
      title: p.title,
      category: p.category,
      tags: p.tags,
      source: p.source,
      created: p.created,
      updated: p.updated,
      filePath: p.filePath,
      content: p.content,
    })),
    schema,
    index,
  };

  return JSON.stringify(exportData, null, 2);
}

// ─── 统计数据 ────────────────────────────────────────────────────────────────

export async function computeStats(): Promise<WikiStats> {
  const pages = await listAllWikiPages();
  const totalReferences = pages.reduce((sum, p) => sum + p.references, 0);

  let totalRawFiles = 0;
  for (const sub of ['articles', 'pdfs', 'audio', 'assets'] as const) {
    const files = await listRawFiles(sub);
    totalRawFiles += files.length;
  }

  return {
    totalPages: pages.length,
    totalRawFiles,
    totalReferences,
    pendingConflicts: 0, // Lint 运行后更新
  };
}

// ─── 默认 WIKI_SCHEMA.md ─────────────────────────────────────────────────────

const DEFAULT_SCHEMA = `# WIKI_SCHEMA.md

> 这是知识库的规则文件。AI 每次操作前都会读取它。
> 版本：1.0

## 页面分类

- **概念**：核心定义和原理
- **架构**：系统设计和结构
- **对比**：两个或多个事物的比较
- **摘要**：外部资料的精炼
- **工具**：具体工具和操作指南
- **日记**：个人日常记录
- **认知**：自己的理解和方法论
- **笔记**：碎片化随手记录

## Ingest 工作流

1. 读取资料，提炼 3-5 个核心要点
2. 与用户讨论，确认重点和关联
3. 按用户指示写摘要页，更新相关页
4. 更新 index.md，追加 log.md
5. 报告触及了哪些页面

## 矛盾处理

- 检测到矛盾：标记 [!矛盾]，不自动覆盖
- 等待用户决策，保留双方内容并标注来源

## 写作规范

- 简体中文，简洁不废话
- 内部链接用 [[页面标题]] 格式
- 每页必须包含 YAML Front Matter
- 页面末尾列出"相关概念"链接
`;

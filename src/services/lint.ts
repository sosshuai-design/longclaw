/**
 * lint.ts — Wiki 健康检查服务
 *
 * 检测：
 * 1. 矛盾（同一概念两页描述相反，标记 [!矛盾]）
 * 2. 孤立页面（无入链）
 * 3. 建议新建（被 ≥3 个页面提及但无专属页）
 * 4. AI 探索建议（知识空白）
 */

import {
  LintReport,
  ConflictItem,
  OrphanItem,
  SuggestionItem,
  ExplorationItem,
  WikiPage,
} from '../types';
import { listAllWikiPages, appendLog } from './wiki';
import { callLLM } from './llm';
import { LLMProviderKey } from '../types';

// ─── 主入口 ───────────────────────────────────────────────────────────────────

export async function runLint(
  providerKey: LLMProviderKey,
  onProgress?: (step: string) => void
): Promise<LintReport> {
  onProgress?.('读取 Wiki 页面…');
  const pages = await listAllWikiPages();

  onProgress?.('检测孤立页面…');
  const orphans = detectOrphans(pages);

  onProgress?.('检测建议新建概念…');
  const suggestions = detectSuggestions(pages);

  onProgress?.('分析矛盾和 AI 建议…');
  let conflicts: ConflictItem[] = [];
  let explorations: ExplorationItem[] = [];

  if (pages.length > 0) {
    try {
      const result = await runAILint(pages, providerKey, onProgress);
      conflicts = result.conflicts;
      explorations = result.explorations;
    } catch (e) {
      // AI Lint 失败时静默降级
      console.warn('AI Lint failed:', e);
    }
  }

  const report: LintReport = {
    conflicts,
    orphans,
    suggestions,
    explorations,
    generatedAt: new Date().toISOString(),
  };

  // 追加 log.md
  await appendLog({
    date: new Date().toISOString().slice(0, 10),
    type: 'lint',
    title: 'Wiki 健康检查',
    actions: [
      `矛盾：${conflicts.length} 个`,
      `孤立页面：${orphans.length} 个`,
      `建议新建：${suggestions.length} 个`,
      `AI 探索建议：${explorations.length} 个`,
    ],
  });

  return report;
}

// ─── 本地检测：孤立页面 ───────────────────────────────────────────────────────

function detectOrphans(pages: WikiPage[]): OrphanItem[] {
  // 统计每个页面标题被其他页面 [[引用]] 的次数
  const inLinkCount: Record<string, number> = {};
  for (const p of pages) {
    inLinkCount[p.title] = 0;
  }
  for (const p of pages) {
    const refs = extractWikiLinks(p.content);
    for (const ref of refs) {
      if (ref in inLinkCount) {
        inLinkCount[ref] += 1;
      }
    }
  }
  return pages
    .filter((p) => (inLinkCount[p.title] ?? 0) === 0)
    .map((p) => ({ pageId: p.id, title: p.title, category: p.category }));
}

// ─── 本地检测：建议新建 ───────────────────────────────────────────────────────

function detectSuggestions(pages: WikiPage[]): SuggestionItem[] {
  // 统计被提及 [[概念]] 但无专属页面的次数
  const titleSet = new Set(pages.map((p) => p.title));
  const mentionCount: Record<string, string[]> = {};

  for (const p of pages) {
    const refs = extractWikiLinks(p.content);
    for (const ref of refs) {
      if (!titleSet.has(ref)) {
        if (!mentionCount[ref]) mentionCount[ref] = [];
        if (!mentionCount[ref].includes(p.title)) {
          mentionCount[ref].push(p.title);
        }
      }
    }
  }

  return Object.entries(mentionCount)
    .filter(([, pages]) => pages.length >= 3)
    .map(([concept, mentionedIn]) => ({
      concept,
      mentionedIn,
      mentionCount: mentionedIn.length,
    }))
    .sort((a, b) => b.mentionCount - a.mentionCount);
}

function extractWikiLinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  return [...matches].map((m) => m[1].trim());
}

// ─── AI 检测：矛盾 + 探索建议 ─────────────────────────────────────────────────

async function runAILint(
  pages: WikiPage[],
  providerKey: LLMProviderKey,
  onProgress?: (step: string) => void
): Promise<{ conflicts: ConflictItem[]; explorations: ExplorationItem[] }> {
  // 只发送标题 + 摘要，控制 token 数
  const pagesSummary = pages
    .map((p) => {
      const body = p.content.replace(/^---[\s\S]*?---\n/, '').trim();
      const snippet = body.slice(0, 300);
      return `### ${p.title}（${p.category}）\n${snippet}`;
    })
    .join('\n\n---\n\n');

  onProgress?.('AI 分析中…');

  const response = await callLLM(providerKey, [
    {
      role: 'system',
      content: `你是 Wiki 健康检查助手。分析以下 Wiki 页面，找出：
1. 矛盾：同一概念在不同页面有矛盾描述
2. 知识空白：用户知识库中明显缺失的相关概念，适合探索

请以如下 JSON 格式输出：
\`\`\`json
{
  "conflicts": [
    {
      "page1": "页面标题1",
      "page2": "页面标题2",
      "description": "矛盾描述（50字以内）"
    }
  ],
  "explorations": [
    {
      "topic": "探索主题",
      "reason": "为什么建议探索（30字以内）",
      "suggestedQuery": "建议的查询问题"
    }
  ]
}
\`\`\`
最多返回 5 个矛盾、5 个探索建议。用简体中文。`,
    },
    {
      role: 'user',
      content: `以下是我的 Wiki 页面（共 ${pages.length} 个）：\n\n${pagesSummary}`,
    },
  ]);

  return parseAILintResponse(response.content, pages);
}

function parseAILintResponse(
  content: string,
  pages: WikiPage[]
): { conflicts: ConflictItem[]; explorations: ExplorationItem[] } {
  const match = content.match(/```json\n([\s\S]*?)```/);
  if (!match) return { conflicts: [], explorations: [] };

  try {
    const parsed = JSON.parse(match[1]);
    const pageMap = new Map(pages.map((p) => [p.title, p]));

    const conflicts: ConflictItem[] = (parsed.conflicts ?? [])
      .filter((c: any) => pageMap.has(c.page1) && pageMap.has(c.page2))
      .map((c: any, i: number) => ({
        id: `conflict_${i}`,
        page1Title: c.page1,
        page1Id: pageMap.get(c.page1)!.id,
        page2Title: c.page2,
        page2Id: pageMap.get(c.page2)!.id,
        description: c.description,
      }));

    const explorations: ExplorationItem[] = (parsed.explorations ?? []).map(
      (e: any, i: number) => ({
        topic: e.topic,
        reason: e.reason,
        suggestedQuery: e.suggestedQuery,
      })
    );

    return { conflicts, explorations };
  } catch {
    return { conflicts: [], explorations: [] };
  }
}

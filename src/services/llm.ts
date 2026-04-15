/**
 * llm.ts — 多 Provider LLM 客户端
 *
 * 所有 provider 均兼容 OpenAI Chat Completions 格式。
 * API Key 从 expo-secure-store 读取。
 */

import * as SecureStore from 'expo-secure-store';
import { LLMProvider, LLMProviderKey, ChatMessage, WikiPage } from '../types';

// ─── Provider 配置 ────────────────────────────────────────────────────────────

export const PROVIDERS: Record<LLMProviderKey, Omit<LLMProvider, 'key'>> = {
  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },
  qwen: {
    name: '通义千问',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  doubao: {
    name: '豆包',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-pro-32k',
  },
  glm: {
    name: '智谱 GLM',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4',
  },
  baichuan: {
    name: '百川',
    baseURL: 'https://api.baichuan-ai.com/v1',
    model: 'Baichuan4',
  },
  claude: {
    name: 'Claude',
    baseURL: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-5',
  },
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
};

export const PROVIDER_KEYS_ORDERED: LLMProviderKey[] = [
  'deepseek',
  'qwen',
  'doubao',
  'glm',
  'baichuan',
  'claude',
  'openai',
];

// SecureStore 键名
const SECURE_KEY_PREFIX = 'wikimind_apikey_';

// ─── API Key 管理 ─────────────────────────────────────────────────────────────

export async function saveApiKey(provider: LLMProviderKey, key: string): Promise<void> {
  await SecureStore.setItemAsync(`${SECURE_KEY_PREFIX}${provider}`, key);
}

export async function getApiKey(provider: LLMProviderKey): Promise<string | null> {
  return SecureStore.getItemAsync(`${SECURE_KEY_PREFIX}${provider}`);
}

export async function deleteApiKey(provider: LLMProviderKey): Promise<void> {
  await SecureStore.deleteItemAsync(`${SECURE_KEY_PREFIX}${provider}`);
}

export async function hasApiKey(provider: LLMProviderKey): Promise<boolean> {
  const key = await getApiKey(provider);
  return !!key && key.trim().length > 0;
}

// ─── LLM 请求 ─────────────────────────────────────────────────────────────────

interface LLMRequestMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  content: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export async function callLLM(
  providerKey: LLMProviderKey,
  messages: LLMRequestMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<LLMResponse> {
  const apiKey = await getApiKey(providerKey);
  if (!apiKey) {
    throw new Error(`未设置 ${PROVIDERS[providerKey].name} 的 API Key`);
  }

  const provider = PROVIDERS[providerKey];
  const url = `${provider.baseURL}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  // Claude 需要额外头部
  if (providerKey === 'claude') {
    headers['anthropic-version'] = '2023-06-01';
    headers['x-api-key'] = apiKey;
    delete headers['Authorization'];
  }

  const body = JSON.stringify({
    model: provider.model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4096,
    stream: false,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM 请求失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  return {
    content,
    usage: data.usage,
  };
}

// ─── 流式请求 ─────────────────────────────────────────────────────────────────

export async function callLLMStream(
  providerKey: LLMProviderKey,
  messages: LLMRequestMessage[],
  onChunk: (chunk: string) => void,
  onDone: (full: string) => void,
  options?: { temperature?: number; maxTokens?: number }
): Promise<void> {
  const apiKey = await getApiKey(providerKey);
  if (!apiKey) {
    throw new Error(`未设置 ${PROVIDERS[providerKey].name} 的 API Key`);
  }

  const provider = PROVIDERS[providerKey];
  const url = `${provider.baseURL}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (providerKey === 'claude') {
    headers['anthropic-version'] = '2023-06-01';
    headers['x-api-key'] = apiKey;
    delete headers['Authorization'];
  }

  const body = JSON.stringify({
    model: provider.model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4096,
    stream: true,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM 请求失败 (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');

  const decoder = new TextDecoder();
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

    for (const line of lines) {
      const json = line.slice(6).trim();
      if (json === '[DONE]') continue;
      try {
        const parsed = JSON.parse(json);
        const delta = parsed.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          fullContent += delta;
          onChunk(delta);
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  onDone(fullContent);
}

// ─── Ingest System Prompt ─────────────────────────────────────────────────────

export function buildIngestSystemPrompt(schemaContent: string, indexContent: string): string {
  return `你是用户的 Wiki 维护助手。

规则文件（WIKI_SCHEMA.md）内容：
${schemaContent}

当前知识库目录（index.md）内容：
${indexContent}

你的任务是帮用户把新资料整合进 Wiki。流程：
1. 先提炼核心要点与用户讨论，不要直接写入
2. 根据用户反馈决定写哪些页面、如何关联
3. 写完后列出触及的所有页面
4. 矛盾不自动覆盖，标记 [!矛盾] 等待用户决策
5. 用简体中文，简洁不废话

注意：raw/ 目录的原始资料不可修改。

当你需要创建或更新 Wiki 页面时，请以如下 JSON 格式输出（包裹在 \`\`\`wiki-actions\`\`\` 代码块中）：
\`\`\`wiki-actions
{
  "actions": [
    {
      "type": "create" | "update",
      "title": "页面标题",
      "category": "concept|architecture|comparison|summary|tool|diary|note|cognition",
      "tags": ["标签1", "标签2"],
      "content": "Markdown 正文内容（不含 front matter）"
    }
  ]
}
\`\`\`

在正常回答之后输出 wiki-actions 块（如果需要写入操作）。`;
}

// ─── Query System Prompt ──────────────────────────────────────────────────────

export function buildQuerySystemPrompt(
  schemaContent: string,
  indexContent: string,
  relevantPages: WikiPage[]
): string {
  const pagesContent = relevantPages
    .map((p) => `### ${p.title}\n\n${p.content}`)
    .join('\n\n---\n\n');

  return `你是用户的知识库问答助手。

规则文件（WIKI_SCHEMA.md）内容：
${schemaContent}

当前知识库目录（已读 index.md，定位到 ${relevantPages.length} 个相关页面）：

${pagesContent}

回答要求：
1. 基于上述 Wiki 页面内容作答，引用时注明来源页面 [[页面标题]]
2. 如果知识库中没有相关内容，如实告知并建议 Ingest 相关资料
3. 用简体中文，简洁准确
4. 回答末尾标注引用了哪些页面`;
}

// ─── 解析 AI 返回的 wiki-actions ────────────────────────────────────────────

export interface WikiAction {
  type: 'create' | 'update';
  title: string;
  category: string;
  tags: string[];
  content: string;
}

export function parseWikiActions(aiResponse: string): WikiAction[] {
  const match = aiResponse.match(/```wiki-actions\n([\s\S]*?)```/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return parsed.actions ?? [];
  } catch {
    return [];
  }
}

export function stripWikiActions(aiResponse: string): string {
  return aiResponse.replace(/```wiki-actions[\s\S]*?```/g, '').trim();
}

// ─── 从 AI 回答中提取引用的 Wiki 页面 ────────────────────────────────────────

export function extractWikiRefs(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  return [...matches].map((m) => m[1]);
}

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
    baseURL: 'https://api.deepseek.com/v1',
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
    model: 'claude-sonnet-4-6',
  },
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  ollama: {
    name: 'Ollama（本地）',
    baseURL: 'http://localhost:11434/v1',
    model: 'llama3',
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
  'ollama',
];

// SecureStore 键名
const SECURE_KEY_PREFIX = 'wikimind_apikey_';
const SECURE_MODEL_PREFIX = 'wikimind_model_';
export const OLLAMA_URL_KEY = 'wikimind_ollama_url';

export async function saveOllamaUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(OLLAMA_URL_KEY, url.trim());
}

export async function getOllamaUrl(): Promise<string> {
  const stored = await SecureStore.getItemAsync(OLLAMA_URL_KEY);
  return stored?.trim() || 'http://localhost:11434';
}

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

export async function saveProviderModel(provider: LLMProviderKey, model: string): Promise<void> {
  if (model.trim()) {
    await SecureStore.setItemAsync(`${SECURE_MODEL_PREFIX}${provider}`, model.trim());
  } else {
    await SecureStore.deleteItemAsync(`${SECURE_MODEL_PREFIX}${provider}`);
  }
}

export async function getProviderModel(provider: LLMProviderKey): Promise<string> {
  const custom = await SecureStore.getItemAsync(`${SECURE_MODEL_PREFIX}${provider}`);
  return custom?.trim() || PROVIDERS[provider].model;
}

// ─── LLM 请求 ─────────────────────────────────────────────────────────────────

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type MessageContent = string | ContentPart[];

interface LLMRequestMessage {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent;
}

interface LLMResponse {
  content: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

// ─── XHR 流式（React Native 的 fetch 不支持 ReadableStream）──────────────────

function xhrStream(
  url: string,
  headers: Record<string, string>,
  body: string,
  parseDataLine: (json: string) => string | null,
  onChunk: (chunk: string) => void,
  onDone: (full: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.timeout = 120000;

    let offset = 0;
    let lineBuffer = '';
    let fullContent = '';

    xhr.onprogress = () => {
      lineBuffer += xhr.responseText.slice(offset);
      offset = xhr.responseText.length;

      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (!json || json === '[DONE]') continue;
        try {
          const delta = parseDataLine(json);
          if (delta) {
            fullContent += delta;
            onChunk(delta);
          }
        } catch { /* 忽略解析错误 */ }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 400) {
        reject(new Error(`LLM 请求失败 (${xhr.status}): ${xhr.responseText.slice(0, 300)}`));
        return;
      }
      onDone(fullContent);
      resolve();
    };

    xhr.onerror = () => reject(new Error('网络请求失败，请检查网络连接'));
    xhr.ontimeout = () => reject(new Error('请求超时（120s），请重试'));

    xhr.send(body);
  });
}

// ─── Claude 专用：Anthropic Messages API（非流式用 fetch，流式用 XHR）─────────

async function callClaudeNonStream(
  apiKey: string,
  model: string,
  messages: LLMRequestMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<LLMResponse> {
  const systemMsg = messages.find((m) => m.role === 'system');
  const chatMsgs = messages.filter((m) => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      stream: false,
      ...(systemMsg ? { system: systemMsg.content as string } : {}),
      messages: chatMsgs,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude 请求失败 (${response.status}): ${err}`);
  }

  const data = await response.json();
  return {
    content: data.content?.[0]?.text ?? '',
    usage: data.usage
      ? { prompt_tokens: data.usage.input_tokens, completion_tokens: data.usage.output_tokens }
      : undefined,
  };
}

function callClaudeStream(
  apiKey: string,
  model: string,
  messages: LLMRequestMessage[],
  onChunk: (chunk: string) => void,
  onDone: (full: string) => void,
  options?: { temperature?: number; maxTokens?: number }
): Promise<void> {
  const systemMsg = messages.find((m) => m.role === 'system');
  const chatMsgs = messages.filter((m) => m.role !== 'system');

  return xhrStream(
    'https://api.anthropic.com/v1/messages',
    {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    JSON.stringify({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      stream: true,
      ...(systemMsg ? { system: systemMsg.content as string } : {}),
      messages: chatMsgs,
    }),
    (json) => {
      const p = JSON.parse(json);
      return p.type === 'content_block_delta' && p.delta?.type === 'text_delta'
        ? p.delta.text ?? null
        : null;
    },
    onChunk,
    onDone
  );
}

export async function callLLM(
  providerKey: LLMProviderKey,
  messages: LLMRequestMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<LLMResponse> {
  const provider = PROVIDERS[providerKey];
  let baseURL = provider.baseURL;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const model = await getProviderModel(providerKey);

  if (providerKey === 'ollama') {
    const customHost = await getOllamaUrl();
    baseURL = `${customHost}/v1`;
    headers['Authorization'] = 'Bearer ollama';
  } else {
    const apiKey = await getApiKey(providerKey);
    if (!apiKey) throw new Error(`未设置 ${provider.name} 的 API Key`);
    if (providerKey === 'claude') {
      return callClaudeNonStream(apiKey, model, messages, options);
    }
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const url = `${baseURL}/chat/completions`;
  const body = JSON.stringify({
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4096,
    stream: false,
  });

  const response = await fetch(url, { method: 'POST', headers, body });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM 请求失败 (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
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
  const provider = PROVIDERS[providerKey];
  let baseURL = provider.baseURL;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const model = await getProviderModel(providerKey);

  if (providerKey === 'ollama') {
    const customHost = await getOllamaUrl();
    baseURL = `${customHost}/v1`;
    headers['Authorization'] = 'Bearer ollama';
  } else {
    const apiKey = await getApiKey(providerKey);
    if (!apiKey) throw new Error(`未设置 ${provider.name} 的 API Key`);
    if (providerKey === 'claude') {
      return callClaudeStream(apiKey, model, messages, onChunk, onDone, options);
    }
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const url = `${baseURL}/chat/completions`;
  const body = JSON.stringify({
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4096,
    stream: true,
  });

  return xhrStream(
    url,
    headers,
    body,
    (json) => {
      const parsed = JSON.parse(json);
      return parsed.choices?.[0]?.delta?.content ?? null;
    },
    onChunk,
    onDone
  );
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
      "category": "concept|note|diary|tool",
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

// ─── 语音转文字（OpenAI Whisper） ────────────────────────────────────────────

export async function transcribeAudio(audioUri: string): Promise<string> {
  const apiKey = await getApiKey('openai');
  if (!apiKey) throw new Error('需要 OpenAI API Key 才能使用语音转文字');

  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    name: 'recording.m4a',
    type: 'audio/m4a',
  } as any);
  formData.append('model', 'whisper-1');
  formData.append('language', 'zh');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper 识别失败 (${response.status}): ${err}`);
  }

  const data = await response.json();
  return (data.text ?? '').trim();
}

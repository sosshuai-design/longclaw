import { create } from 'zustand';
import { ChatMessage, ChatMode, Attachment, WikiRef } from '../types';

let msgCounter = 0;
function newId() {
  return `msg_${Date.now()}_${++msgCounter}`;
}

interface ChatState {
  mode: ChatMode;
  messages: ChatMessage[];
  isStreaming: boolean;
  pendingAttachments: Attachment[];

  setMode: (mode: ChatMode) => void;
  addUserMessage: (content: string, attachments?: Attachment[]) => ChatMessage;
  addAssistantMessage: (content: string, wikiRefs?: WikiRef[], canSaveToWiki?: boolean) => ChatMessage;
  appendToLastAssistant: (chunk: string) => void;
  finalizeLastAssistant: (wikiRefs?: WikiRef[], canSaveToWiki?: boolean) => void;
  clearMessages: () => void;
  setStreaming: (v: boolean) => void;
  addAttachment: (att: Attachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  mode: 'ingest',
  messages: [],
  isStreaming: false,
  pendingAttachments: [],

  setMode: (mode) => {
    set({ mode, messages: [], pendingAttachments: [] });
  },

  addUserMessage: (content, attachments) => {
    const msg: ChatMessage = {
      id: newId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      attachments,
    };
    set((s) => ({ messages: [...s.messages, msg], pendingAttachments: [] }));
    return msg;
  },

  addAssistantMessage: (content, wikiRefs, canSaveToWiki) => {
    const msg: ChatMessage = {
      id: newId(),
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      wikiRefs,
      canSaveToWiki,
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    return msg;
  },

  appendToLastAssistant: (chunk) => {
    set((s) => {
      const msgs = [...s.messages];
      if (msgs.length === 0 || msgs[msgs.length - 1].role !== 'assistant') {
        // 创建新的 assistant 消息
        msgs.push({
          id: newId(),
          role: 'assistant',
          content: chunk,
          timestamp: new Date().toISOString(),
        });
      } else {
        const last = { ...msgs[msgs.length - 1] };
        last.content += chunk;
        msgs[msgs.length - 1] = last;
      }
      return { messages: msgs };
    });
  },

  finalizeLastAssistant: (wikiRefs, canSaveToWiki) => {
    set((s) => {
      const msgs = [...s.messages];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
        const last = { ...msgs[msgs.length - 1], wikiRefs, canSaveToWiki };
        msgs[msgs.length - 1] = last;
      }
      return { messages: msgs };
    });
  },

  clearMessages: () => set({ messages: [], pendingAttachments: [] }),

  setStreaming: (v) => set({ isStreaming: v }),

  addAttachment: (att) => {
    set((s) => ({ pendingAttachments: [...s.pendingAttachments, att] }));
  },

  removeAttachment: (id) => {
    set((s) => ({ pendingAttachments: s.pendingAttachments.filter((a) => a.id !== id) }));
  },

  clearAttachments: () => set({ pendingAttachments: [] }),
}));

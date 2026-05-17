/**
 * chat-engine/ — AI Chat orchestration module.
 *
 * Responsibilities:
 *   • Message lifecycle (create, stream, store, decrypt)
 *   • Multi-provider routing (Groq, Anthropic, OpenAI, local)
 *   • Chat history persistence (encrypted localStorage)
 *   • Streaming response handling
 *   • Context injection (design tokens, project state)
 *   • Future: Agent-based chat with GOAP planning
 *
 * Architecture:
 *   User input → Context enrichment → Provider routing → Stream → Evidence store
 */

import type { ChatMessage } from "../app/types";
import { createMessage, encryptChatMessages, decryptChatMessages, getChatHistoryKey } from "../app/auth";
import { sendClaudeChat } from "../workspace/claudeChat";
import { eventBus } from "../lib/eventBus";

// ── Types ──────────────────────────────────────────────────────

export type ChatProvider = "groq" | "anthropic" | "openai" | "local";

export interface ChatConfig {
  provider: ChatProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  /** v3: Enable GOAP-based agent routing for complex queries */
  enableAgentMode?: boolean;
  /** v3: Inject design context into every message */
  injectDesignContext?: boolean;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  config: ChatConfig;
  createdAt: number;
  updatedAt: number;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullMessage: string) => void;
  onError: (error: Error) => void;
}

// ── Default Config ─────────────────────────────────────────────

const DEFAULT_CONFIG: ChatConfig = {
  provider: "groq",
  model: "llama-3.3-70b-versatile",
  temperature: 0.7,
  maxTokens: 8192,
  enableAgentMode: false,
  injectDesignContext: true,
};

// ── Chat Engine ────────────────────────────────────────────────

export class ChatEngine {
  private config: ChatConfig;
  private abortController: AbortController | null = null;

  constructor(config?: Partial<ChatConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Send a message and get streaming response */
  async send(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
  ): Promise<void> {
    this.abortController = new AbortController();

    try {
      const response = await sendClaudeChat(
        messages.map(m => ({ role: m.role, content: m.content })),
        this.config.model,
      );

      if (!response) {
        callbacks.onError(new Error("Empty response from provider"));
        return;
      }

      callbacks.onComplete(response);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      callbacks.onError(error as Error);
    } finally {
      this.abortController = null;
    }
  }

  /** Cancel ongoing stream */
  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  /** Update configuration */
  configure(config: Partial<ChatConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): Readonly<ChatConfig> {
    return this.config;
  }

  // ── Persistence ─────────────────────────────────────────────

  async saveHistory(messages: ChatMessage[], userId: string, projectId: string): Promise<void> {
    const key = getChatHistoryKey(userId, projectId);
    const encrypted = await encryptChatMessages(messages, userId);
    localStorage.setItem(key, encrypted);
  }

  async loadHistory(userId: string, projectId: string): Promise<ChatMessage[]> {
    const key = getChatHistoryKey(userId, projectId);
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return [createMessage("assistant", "Start a conversation or upload Design.md files.", "Desygn AI")];

    try {
      return await decryptChatMessages(encrypted, userId);
    } catch {
      return [createMessage("assistant", "Chat history could not be decrypted.", "Desygn AI")];
    }
  }

  // ── Factory ─────────────────────────────────────────────────

  static create(config?: Partial<ChatConfig>): ChatEngine {
    return new ChatEngine(config);
  }
}

// ── Singleton ──────────────────────────────────────────────────

export const chatEngine = ChatEngine.create();

// ── Message Helpers ────────────────────────────────────────────

export { createMessage } from "../app/auth";

export function createUserMessage(content: string): ChatMessage {
  return createMessage("user", content, "You");
}

export function createAssistantMessage(content: string): ChatMessage {
  return createMessage("assistant", content, "Desygn AI");
}

export function createSystemMessage(content: string): ChatMessage {
  return createMessage("assistant", content, "System");
}

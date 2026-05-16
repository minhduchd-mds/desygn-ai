/**
 * chatRepo — repository for encrypted chat history.
 *
 * Wraps auth.ts crypto helpers with a clean repository interface.
 * All chat messages are AES-GCM encrypted in localStorage, keyed by emailHash.
 */

import {
  CHAT_HISTORY_LIMIT,
  CHAT_HISTORY_PREFIX,
  encryptChatMessages,
  decryptChatMessages,
  createMessage,
  getChatHistoryKey,
} from "../app/auth";
import type { ChatMessage } from "../app/types";
import { eventBus } from "../lib/eventBus";
import { errorBus } from "../lib/errorBus";

export const chatRepo = {
  // ── Persistence ──────────────────────────────────────────────

  /**
   * Encrypt and save messages for a user session.
   * Automatically trims to CHAT_HISTORY_LIMIT entries.
   */
  async save(emailHash: string, messages: ChatMessage[]): Promise<void> {
    try {
      const trimmed = messages.slice(-CHAT_HISTORY_LIMIT);
      const encrypted = await encryptChatMessages(emailHash, trimmed);
      localStorage.setItem(getChatHistoryKey(emailHash), encrypted);
    } catch (err) {
      errorBus.warn("CHAT_SAVE_ERROR", err instanceof Error ? err.message : "Save failed");
    }
  },

  /**
   * Decrypt and return saved messages. Returns [] on any error.
   */
  async load(emailHash: string): Promise<ChatMessage[]> {
    try {
      const raw = localStorage.getItem(getChatHistoryKey(emailHash));
      if (!raw) return [];
      return await decryptChatMessages(emailHash, raw);
    } catch {
      return [];
    }
  },

  /**
   * Erase all saved history for a user.
   */
  clear(emailHash: string): void {
    localStorage.removeItem(getChatHistoryKey(emailHash));
    eventBus.emit("chat:cleared");
  },

  /**
   * Erase ALL users' chat history (sign-out / reset).
   */
  clearAll(): void {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CHAT_HISTORY_PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
    eventBus.emit("chat:cleared");
  },

  // ── Factory ───────────────────────────────────────────────────

  createUserMessage(content: string, title?: string): ChatMessage {
    return createMessage("user", content, title);
  },

  createAssistantMessage(content: string, title?: string, htmlCode?: string): ChatMessage {
    return createMessage("assistant", content, title, htmlCode);
  },

  get historyLimit(): number {
    return CHAT_HISTORY_LIMIT;
  },
};

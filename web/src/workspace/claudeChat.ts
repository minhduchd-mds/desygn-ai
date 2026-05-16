/**
 * claudeChat — chat API integration layer.
 *
 * Previously called fetch() directly; now delegates to:
 *  • streamClient.postStream  (streaming path — onToken callback)
 *  • apiClient.post           (non-streaming fallback)
 *
 * Benefits: automatic retry, AbortController lifecycle, rate-limit awareness,
 * error normalization, and error bus emission.
 */

import type { ChatMessage } from "../app/types";
import { apiClient } from "../lib/apiClient";
import { postStream } from "../lib/streamClient";
import { chatRateLimit } from "../lib/rateLimit";
import { errorBus } from "../lib/errorBus";

interface ChatContext {
  projectName: string;
  category: string;
  selectedTemplate: string;
  readinessScore: number | null;
  activeDesignMd: boolean;
  workspaceTab: "chat" | "code";
  model?: string;
}

interface ChatResponse {
  message?: string;
  error?: string;
}

export async function sendClaudeChat(
  messages: ChatMessage[],
  context: ChatContext,
  onToken?: (token: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  // Client-side rate limit guard
  if (!chatRateLimit.consume()) {
    const waitSec = chatRateLimit.waitSeconds.toFixed(1);
    throw new Error(`Gửi quá nhanh — vui lòng đợi ${waitSec}s trước khi thử lại.`);
  }

  const body = {
    messages: messages.map((m) => ({ role: m.role, title: m.title, content: m.content })),
    context,
  };

  // ── Streaming path ────────────────────────────────────────────
  if (onToken) {
    try {
      return await postStream("/api/chat-stream", body, onToken, { signal });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat stream failed";
      if (message.includes("NETWORK") || message.includes("fetch")) {
        throw new Error("Chat API không khả dụng. Khởi động dev server hoặc deploy lên Vercel.");
      }
      errorBus.network(message, true);
      throw err;
    }
  }

  // ── Non-streaming fallback ────────────────────────────────────
  try {
    const payload = await apiClient.post<ChatResponse>("/api/chat", body, { signal });
    return payload.message?.trim() || "No response generated.";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat request failed";
    if (message.includes("404")) {
      throw new Error("Chat API route not found. Khởi động lại dev server để /api/chat được đăng ký.");
    }
    throw err;
  }
}

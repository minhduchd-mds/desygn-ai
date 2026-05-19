/**
 * useChatState — Chat message lifecycle hook extracted from main.tsx.
 *
 * Manages messages (Chat tab + Code tab), encrypted history persistence,
 * legacy placeholder stripping, send/stream orchestration, and new-chat reset.
 */

import { useCallback, useEffect, useState } from "react";
import type { ChatAttachment, ChatMessage, SessionUser } from "../app/types";
import {
  getChatHistoryKey,
  encryptChatMessages,
  decryptChatMessages,
  createMessage,
  saveSessionUser,
} from "../app/auth";
import { sendClaudeChat } from "../workspace/claudeChat";

// ── Legacy placeholders to strip from persisted history ───────
const LEGACY_PLACEHOLDERS = [
  "Paste a product request",
  "Start a conversation or upload",
  "Describe a design task, generate Design.md",
];

function stripPlaceholders(msgs: ChatMessage[]): ChatMessage[] {
  return msgs.filter(
    (m) =>
      !(
        m.role === "assistant" &&
        LEGACY_PLACEHOLDERS.some((p) => m.content.startsWith(p))
      ),
  );
}

// ── Types ─────────────────────────────────────────────────────

export interface ChatContext {
  projectName: string;
  category: string;
  selectedTemplate: string;
  readinessScore: number | null;
  activeDesignMd: boolean;
  workspaceTab: "chat" | "code" | "checklist";
  model: string;
}

export interface UseChatStateReturn {
  /* state */
  messages: ChatMessage[];
  codeMessages: ChatMessage[];
  chatHistoryReady: boolean;
  isGenerating: boolean;
  copiedMessageId: string | null;

  /* setters */
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setCodeMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;

  /* derived */
  activeMessages: ChatMessage[];
  setActiveMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;

  /* actions */
  sendChatMessage: (
    prompt: string,
    context: ChatContext,
    opts?: {
      onFirstUserMessage?: (prompt: string) => void;
      generateHtml?: (prompt: string) => Promise<string | null>;
      attachments?: ChatAttachment[];
    },
  ) => Promise<void>;
  startNewChat: (workspaceTab: "chat" | "code" | "checklist") => void;
  copyMessageContent: (msg: ChatMessage) => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────

export function useChatState(
  user: SessionUser | null,
  workspaceTab: "chat" | "code" | "checklist",
): UseChatStateReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [codeMessages, setCodeMessages] = useState<ChatMessage[]>([]);
  const [chatHistoryReady, setChatHistoryReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Tab-specific message routing
  const activeMessages = workspaceTab === "code" ? codeMessages : messages;
  const setActiveMessages =
    workspaceTab === "code" ? setCodeMessages : setMessages;

  // ── Persist user session on change ──────────────────────────
  useEffect(() => {
    if (user) saveSessionUser(user);
  }, [user]);

  // ── Load encrypted chat history ─────────────────────────────
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    // Chat tab
    const chatKey = getChatHistoryKey(user.emailHash);
    const encrypted = localStorage.getItem(chatKey);
    const chatPromise = encrypted
      ? decryptChatMessages(user.emailHash, encrypted)
          .then((stored) => {
            const cleaned = stripPlaceholders(stored);
            if (!cancelled && cleaned.length > 0) setMessages(cleaned);
          })
          .catch(() => localStorage.removeItem(chatKey))
      : Promise.resolve();

    // Code tab
    const codeKey = getChatHistoryKey(user.emailHash + ":code");
    const codeEncrypted = localStorage.getItem(codeKey);
    const codePromise = codeEncrypted
      ? decryptChatMessages(user.emailHash, codeEncrypted)
          .then((stored) => {
            const cleaned = stripPlaceholders(stored);
            if (!cancelled && cleaned.length > 0) setCodeMessages(cleaned);
          })
          .catch(() => localStorage.removeItem(codeKey))
      : Promise.resolve();

    Promise.all([chatPromise, codePromise]).finally(() => {
      if (!cancelled) setChatHistoryReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Persist Chat tab on change ──────────────────────────────
  useEffect(() => {
    if (!user || !chatHistoryReady) return;
    encryptChatMessages(user.emailHash, messages)
      .then((payload) => {
        localStorage.setItem(getChatHistoryKey(user.emailHash), payload);
      })
      .catch(() => {
        /* non-critical */
      });
  }, [chatHistoryReady, messages, user]);

  // ── Persist Code tab on change ──────────────────────────────
  useEffect(() => {
    if (!user || !chatHistoryReady) return;
    encryptChatMessages(user.emailHash, codeMessages)
      .then((payload) => {
        localStorage.setItem(
          getChatHistoryKey(user.emailHash + ":code"),
          payload,
        );
      })
      .catch(() => {
        /* non-critical */
      });
  }, [chatHistoryReady, codeMessages, user]);

  // ── Send message + stream response ──────────────────────────
  const sendChatMessage = useCallback(
    async (
      prompt: string,
      context: ChatContext,
      opts?: {
        onFirstUserMessage?: (prompt: string) => void;
        generateHtml?: (prompt: string) => Promise<string | null>;
        attachments?: ChatAttachment[];
      },
    ) => {
      if (!prompt.trim() && (!opts?.attachments || opts.attachments.length === 0)) return;

      const isCodeTab = context.workspaceTab === "code";
      const currentMessages = isCodeTab ? codeMessages : messages;
      const updateMessages = isCodeTab ? setCodeMessages : setMessages;

      const userMessage = createMessage("user", prompt, undefined, undefined, opts?.attachments);
      const chatMessages = [...currentMessages, userMessage];
      const streamingMsg = createMessage("assistant", "", "Trợ lý ảo");
      const streamingId = streamingMsg.id;

      updateMessages([...chatMessages, streamingMsg]);
      setIsGenerating(true);

      // Auto-save to history on first user message
      const isFirstUserMessage =
        currentMessages.filter((m) => m.role === "user").length === 0;
      if (isFirstUserMessage) {
        opts?.onFirstUserMessage?.(prompt);
      }

      const isWebIntent = detectWebIntent(prompt);

      try {
        const [, htmlCode] = await Promise.all([
          sendClaudeChat(
            chatMessages,
            {
              projectName: context.projectName,
              category: context.category,
              selectedTemplate: context.selectedTemplate,
              readinessScore: context.readinessScore,
              activeDesignMd: context.activeDesignMd,
              workspaceTab: context.workspaceTab,
              model: context.model,
            },
            (token) => {
              updateMessages((current) =>
                current.map((m) =>
                  m.id === streamingId
                    ? { ...m, content: m.content + token }
                    : m,
                ),
              );
            },
          ),
          isWebIntent && opts?.generateHtml
            ? opts.generateHtml(prompt)
            : Promise.resolve(null),
        ]);

        if (htmlCode) {
          updateMessages((current) =>
            current.map((m) =>
              m.id === streamingId ? { ...m, htmlCode } : m,
            ),
          );
        }
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : String(error);
        const isApiUnavailable =
          /unavailable|404|500|fetch|network/i.test(errMsg);
        updateMessages((current) =>
          current.map((m) =>
            m.id === streamingId
              ? {
                  ...m,
                  content: isApiUnavailable
                    ? `⚠️ **API không khả dụng**\n\nKhông thể kết nối tới Groq AI. Vui lòng kiểm tra:\n- Biến môi trường \`GROQ_API_KEY\` đã được cấu hình\n- Server đang chạy qua \`vercel dev\` (cho API routes)\n\n_Lỗi: ${errMsg}_`
                    : errMsg || "Trợ lý ảo đang bận — thử lại nhé!",
                }
              : m,
          ),
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [codeMessages, messages],
  );

  // ── Start new chat ──────────────────────────────────────────
  const startNewChat = useCallback(
    (tab: "chat" | "code" | "checklist") => {
      if (tab === "code") {
        setCodeMessages([]);
      } else {
        setMessages([]);
      }
      setIsGenerating(false);
    },
    [],
  );

  // ── Copy message content ────────────────────────────────────
  const copyMessageContent = useCallback(async (msg: ChatMessage) => {
    await navigator.clipboard.writeText(msg.content);
    setCopiedMessageId(msg.id);
    window.setTimeout(() => setCopiedMessageId(null), 1400);
  }, []);

  return {
    messages,
    codeMessages,
    chatHistoryReady,
    isGenerating,
    copiedMessageId,
    setMessages,
    setCodeMessages,
    setIsGenerating,
    activeMessages,
    setActiveMessages,
    sendChatMessage,
    startNewChat,
    copyMessageContent,
  };
}

// ── Private helpers ───────────────────────────────────────────

function detectWebIntent(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return /tạo\s*(web|website|trang|app|giao diện)|create\s*(web|website|page|app|landing|ui)|build\s*(web|website|page|app|landing)|make\s*(web|website|page|app)|html|landing page|homepage|web app|single.?page|portfolio site/.test(
    p,
  );
}

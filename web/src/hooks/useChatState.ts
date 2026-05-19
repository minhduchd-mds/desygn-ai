/**
 * useChatState — Chat message lifecycle hook with multi-session support.
 *
 * Manages chat sessions (Chat tab + Code tab), encrypted history persistence,
 * legacy placeholder stripping, send/stream orchestration, and session switching.
 *
 * Each "New Chat" creates a new session — old sessions are preserved and
 * listed in the sidebar for recall.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatAttachment, ChatMessage, ChatSession, SessionUser } from "../app/types";
import {
  getChatHistoryKey,
  decryptChatMessages,
  createMessage,
  saveSessionUser,
  loadSessionIndex,
  saveSessionIndex,
  saveSessionMessages,
  loadSessionMessages,
  deleteSessionStorage,
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

function generateSessionId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New Chat";
  const text = firstUser.content.trim();
  return text.length > 60 ? text.slice(0, 57) + "…" : text || "New Chat";
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

  /* session management */
  chatSessions: ChatSession[];
  codeSessions: ChatSession[];
  activeChatSessionId: string | null;
  activeCodeSessionId: string | null;

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
  switchSession: (sessionId: string, tab: "chat" | "code") => void;
  deleteSession: (sessionId: string, tab: "chat" | "code") => void;
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

  // Session tracking
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [codeSessions, setCodeSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [activeCodeSessionId, setActiveCodeSessionId] = useState<string | null>(null);

  // Ref to prevent double-saves during session switching
  const switchingRef = useRef(false);

  // Tab-specific message routing
  const activeMessages = workspaceTab === "code" ? codeMessages : messages;
  const setActiveMessages =
    workspaceTab === "code" ? setCodeMessages : setMessages;

  // ── Persist user session on change ──────────────────────────
  useEffect(() => {
    if (user) saveSessionUser(user);
  }, [user]);

  // ── Load sessions + migrate from old format ─────────────────
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function init() {
      // Load session indices
      const allSessions = loadSessionIndex(user!.emailHash);
      const chats = allSessions.filter((s) => s.tab === "chat");
      const codes = allSessions.filter((s) => s.tab === "code");

      // Try loading legacy encrypted messages if no sessions exist
      if (chats.length === 0) {
        const legacyKey = getChatHistoryKey(user!.emailHash);
        const encrypted = localStorage.getItem(legacyKey);
        if (encrypted) {
          try {
            const stored = await decryptChatMessages(user!.emailHash, encrypted);
            const cleaned = stripPlaceholders(stored);
            if (cleaned.length > 0) {
              const sessionId = generateSessionId();
              const session: ChatSession = {
                id: sessionId,
                title: deriveTitle(cleaned),
                tab: "chat",
                createdAt: Date.now() - 60000,
                updatedAt: Date.now(),
                messageCount: cleaned.length,
              };
              chats.push(session);
              await saveSessionMessages(user!.emailHash, sessionId, cleaned);
              // Remove legacy key after migration
              localStorage.removeItem(legacyKey);
            }
          } catch {
            localStorage.removeItem(legacyKey);
          }
        }
      }

      if (codes.length === 0) {
        const legacyCodeKey = getChatHistoryKey(user!.emailHash + ":code");
        const codeEncrypted = localStorage.getItem(legacyCodeKey);
        if (codeEncrypted) {
          try {
            const stored = await decryptChatMessages(user!.emailHash, codeEncrypted);
            const cleaned = stripPlaceholders(stored);
            if (cleaned.length > 0) {
              const sessionId = generateSessionId();
              const session: ChatSession = {
                id: sessionId,
                title: deriveTitle(cleaned),
                tab: "code",
                createdAt: Date.now() - 60000,
                updatedAt: Date.now(),
                messageCount: cleaned.length,
              };
              codes.push(session);
              await saveSessionMessages(user!.emailHash, sessionId, cleaned);
              localStorage.removeItem(legacyCodeKey);
            }
          } catch {
            localStorage.removeItem(legacyCodeKey);
          }
        }
      }

      if (cancelled) return;

      // Sort by updatedAt desc
      chats.sort((a, b) => b.updatedAt - a.updatedAt);
      codes.sort((a, b) => b.updatedAt - a.updatedAt);

      setChatSessions(chats);
      setCodeSessions(codes);

      // Load most recent session messages
      if (chats.length > 0) {
        const latest = chats[0];
        setActiveChatSessionId(latest.id);
        const msgs = await loadSessionMessages(user!.emailHash, latest.id);
        if (!cancelled) setMessages(stripPlaceholders(msgs));
      }

      if (codes.length > 0) {
        const latest = codes[0];
        setActiveCodeSessionId(latest.id);
        const msgs = await loadSessionMessages(user!.emailHash, latest.id);
        if (!cancelled) setCodeMessages(stripPlaceholders(msgs));
      }

      // Save merged index
      saveSessionIndex(user!.emailHash, [...chats, ...codes]);

      if (!cancelled) setChatHistoryReady(true);
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Auto-save current session on message change ─────────────
  useEffect(() => {
    if (!user || !chatHistoryReady || switchingRef.current) return;
    if (!activeChatSessionId || messages.length === 0) return;

    const id = activeChatSessionId;
    void saveSessionMessages(user.emailHash, id, messages).then(() => {
      setChatSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, title: deriveTitle(messages), updatedAt: Date.now(), messageCount: messages.length }
            : s,
        ),
      );
    });
  }, [chatHistoryReady, messages, user, activeChatSessionId]);

  useEffect(() => {
    if (!user || !chatHistoryReady || switchingRef.current) return;
    if (!activeCodeSessionId || codeMessages.length === 0) return;

    const id = activeCodeSessionId;
    void saveSessionMessages(user.emailHash, id, codeMessages).then(() => {
      setCodeSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, title: deriveTitle(codeMessages), updatedAt: Date.now(), messageCount: codeMessages.length }
            : s,
        ),
      );
    });
  }, [chatHistoryReady, codeMessages, user, activeCodeSessionId]);

  // ── Persist session index when sessions change ──────────────
  useEffect(() => {
    if (!user || !chatHistoryReady) return;
    saveSessionIndex(user.emailHash, [...chatSessions, ...codeSessions]);
  }, [chatSessions, codeSessions, user, chatHistoryReady]);

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

      // Ensure there's an active session
      let sessionId = isCodeTab ? activeCodeSessionId : activeChatSessionId;
      if (!sessionId && user) {
        sessionId = generateSessionId();
        const newSession: ChatSession = {
          id: sessionId,
          title: "New Chat",
          tab: isCodeTab ? "code" : "chat",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 0,
        };
        if (isCodeTab) {
          setActiveCodeSessionId(sessionId);
          setCodeSessions((prev) => [newSession, ...prev]);
        } else {
          setActiveChatSessionId(sessionId);
          setChatSessions((prev) => [newSession, ...prev]);
        }
      }

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
                    ? `⚠️ **API không khả dụng**\n\nKhông thể kết nối tới AI provider. Vui lòng kiểm tra:\n- Biến môi trường API key đã được cấu hình\n- Server đang chạy qua \`vercel dev\` (cho API routes)\n\n_Lỗi: ${errMsg}_`
                    : errMsg || "Trợ lý ảo đang bận — thử lại nhé!",
                }
              : m,
          ),
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [codeMessages, messages, activeChatSessionId, activeCodeSessionId, user],
  );

  // ── Start new chat (preserves current session) ──────────────
  const startNewChat = useCallback(
    (tab: "chat" | "code" | "checklist") => {
      if (!user) return;

      const isCode = tab === "code";
      const currentMsgs = isCode ? codeMessages : messages;
      const currentSessionId = isCode ? activeCodeSessionId : activeChatSessionId;

      // Save current session if it has messages
      if (currentSessionId && currentMsgs.length > 0) {
        void saveSessionMessages(user.emailHash, currentSessionId, currentMsgs);
      }

      // Create new session
      const newId = generateSessionId();
      const newSession: ChatSession = {
        id: newId,
        title: "New Chat",
        tab: isCode ? "code" : "chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
      };

      if (isCode) {
        setCodeMessages([]);
        setActiveCodeSessionId(newId);
        setCodeSessions((prev) => [newSession, ...prev]);
      } else {
        setMessages([]);
        setActiveChatSessionId(newId);
        setChatSessions((prev) => [newSession, ...prev]);
      }
      setIsGenerating(false);
    },
    [user, messages, codeMessages, activeChatSessionId, activeCodeSessionId],
  );

  // ── Switch to an existing session ───────────────────────────
  const switchSession = useCallback(
    (sessionId: string, tab: "chat" | "code") => {
      if (!user) return;

      const isCode = tab === "code";
      const currentMsgs = isCode ? codeMessages : messages;
      const currentSessionId = isCode ? activeCodeSessionId : activeChatSessionId;

      // Don't switch to same session
      if (currentSessionId === sessionId) return;

      switchingRef.current = true;

      // Save current session first
      if (currentSessionId && currentMsgs.length > 0) {
        void saveSessionMessages(user.emailHash, currentSessionId, currentMsgs);
      }

      // Load target session
      void loadSessionMessages(user.emailHash, sessionId).then((msgs) => {
        const cleaned = stripPlaceholders(msgs);
        if (isCode) {
          setCodeMessages(cleaned);
          setActiveCodeSessionId(sessionId);
        } else {
          setMessages(cleaned);
          setActiveChatSessionId(sessionId);
        }
        switchingRef.current = false;
      });
    },
    [user, messages, codeMessages, activeChatSessionId, activeCodeSessionId],
  );

  // ── Delete a session ────────────────────────────────────────
  const deleteSession = useCallback(
    (sessionId: string, tab: "chat" | "code") => {
      if (!user) return;

      const isCode = tab === "code";
      const currentSessionId = isCode ? activeCodeSessionId : activeChatSessionId;

      // Remove from storage
      deleteSessionStorage(user.emailHash, sessionId);

      // Remove from index
      if (isCode) {
        setCodeSessions((prev) => {
          const next = prev.filter((s) => s.id !== sessionId);
          // If deleting active session, switch to next one or create empty
          if (currentSessionId === sessionId) {
            if (next.length > 0) {
              void loadSessionMessages(user.emailHash, next[0].id).then((msgs) => {
                setCodeMessages(stripPlaceholders(msgs));
                setActiveCodeSessionId(next[0].id);
              });
            } else {
              setCodeMessages([]);
              setActiveCodeSessionId(null);
            }
          }
          return next;
        });
      } else {
        setChatSessions((prev) => {
          const next = prev.filter((s) => s.id !== sessionId);
          if (currentSessionId === sessionId) {
            if (next.length > 0) {
              void loadSessionMessages(user.emailHash, next[0].id).then((msgs) => {
                setMessages(stripPlaceholders(msgs));
                setActiveChatSessionId(next[0].id);
              });
            } else {
              setMessages([]);
              setActiveChatSessionId(null);
            }
          }
          return next;
        });
      }
    },
    [user, activeChatSessionId, activeCodeSessionId],
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
    chatSessions,
    codeSessions,
    activeChatSessionId,
    activeCodeSessionId,
    setMessages,
    setCodeMessages,
    setIsGenerating,
    activeMessages,
    setActiveMessages,
    sendChatMessage,
    startNewChat,
    switchSession,
    deleteSession,
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

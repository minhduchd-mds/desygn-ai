import type { ChatMessage } from "../app/types";

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

/**
 * Parse Vercel AI SDK Data Stream Protocol.
 * Text deltas arrive as `0:"text"\n`, errors as `3:"message"\n`.
 * We only need text deltas for the streaming UX.
 */
function parseAIStreamLine(line: string, onToken: (token: string) => void): void {
  if (!line) return;
  const colonIdx = line.indexOf(":");
  if (colonIdx < 1) return;

  const type = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);

  if (type === "0") {
    // Text delta — value is a JSON-encoded string
    try {
      const text = JSON.parse(value) as string;
      if (text) onToken(text);
    } catch {
      // skip malformed chunks
    }
  } else if (type === "3") {
    // Error
    try {
      const errMsg = JSON.parse(value) as string;
      throw new Error(errMsg);
    } catch (e) {
      if (e instanceof Error && e.message !== "Unexpected end of JSON input") throw e;
    }
  }
  // Types 2 (data), d (finish), e (step finish) are ignored — we only need text.
}

export async function sendClaudeChat(
  messages: ChatMessage[],
  context: ChatContext,
  onToken?: (token: string) => void,
): Promise<string> {
  const body = JSON.stringify({
    messages: messages.map((m) => ({ role: m.role, title: m.title, content: m.content })),
    context,
  });

  // ── Streaming path (AI SDK Data Stream Protocol) ──
  if (onToken) {
    let response: Response;
    try {
      response = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch {
      throw new Error("Chat API is unavailable. Start the dev server or deploy to Vercel.");
    }

    if (!response.ok) {
      let errorMsg = `Chat stream failed (${response.status}).`;
      try {
        const errBody = (await response.json()) as { error?: string };
        if (errBody.error) errorMsg = errBody.error;
      } catch { /* ignore */ }
      throw new Error(errorMsg);
    }

    if (!response.body) {
      throw new Error("No response stream received.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        parseAIStreamLine(trimmed, (text) => {
          full += text;
          onToken(text);
        });
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      parseAIStreamLine(buffer.trim(), (text) => {
        full += text;
        onToken(text);
      });
    }

    return full || "No response generated.";
  }

  // ── Non-streaming fallback ──
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    throw new Error("Chat API is unavailable. Start the dev server or deploy to Vercel.");
  }

  const payload = (await response.json().catch(() => ({}))) as ChatResponse;

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Chat API route not found. Restart the dev server so /api/chat is registered.");
    }
    throw new Error(payload.error ?? `Chat request failed with status ${response.status}.`);
  }

  return payload.message?.trim() || "No response generated.";
}

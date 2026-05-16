/**
 * streamClient — robust fetch-based streaming client.
 *
 * Wraps the low-level ReadableStream Reader with:
 *  • Retry on 5xx / network drop (exponential backoff)
 *  • AbortController lifecycle (external signal + timeout)
 *  • Backpressure-aware reading (no unbounded buffer)
 *  • Accumulated full-text return for callers that need it
 *
 * Protocol: POST → Content-Type: application/json
 * Server must respond with a plain text stream (no SSE framing needed).
 */

import { ApiError } from "./apiClient";
import { errorBus } from "./errorBus";

export interface StreamOptions {
  /** External AbortSignal. */
  signal?: AbortSignal;
  /** Retry on 5xx / network drop (default 2). */
  maxRetries?: number;
  /** Base backoff delay in ms (default 500). */
  retryDelay?: number;
  /** Overall timeout in ms (default 60 000 — LLM responses can be slow). */
  timeout?: number;
  /** Extra request headers. */
  headers?: Record<string, string>;
}

/**
 * POST `body` to `url` and stream the response, calling `onToken` for each chunk.
 * Returns the full concatenated text when the stream completes.
 */
export async function postStream(
  url: string,
  body: unknown,
  onToken: (chunk: string) => void,
  opts: StreamOptions = {},
): Promise<string> {
  const maxRetries = opts.maxRetries ?? 2;
  const baseDelay = opts.retryDelay ?? 500;
  const timeout = opts.timeout ?? 60_000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort("timeout"), timeout);

    if (opts.signal) {
      if (opts.signal.aborted) {
        clearTimeout(timerId);
        throw new ApiError("ABORTED", "Stream aborted before start", 0, false);
      }
      opts.signal.addEventListener("abort", () => controller.abort(opts.signal!.reason));
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timerId);

      if (!res.ok) {
        let message = `Stream failed (${res.status})`;
        let code = `HTTP_${res.status}`;
        try {
          const b = await res.clone().json() as { error?: string; code?: string };
          if (b.error) message = b.error;
          if (b.code) code = b.code;
        } catch { /* ignore */ }

        const retryable = res.status >= 500 && attempt < maxRetries;
        if (retryable) {
          await sleep(baseDelay * 2 ** attempt);
          continue;
        }
        errorBus.network(message, retryable);
        throw new ApiError(code, message, res.status, retryable);
      }

      if (!res.body) {
        throw new ApiError("NO_BODY", "Server returned no response stream", 0, false);
      }

      return await readStream(res.body, onToken, controller.signal);

    } catch (err) {
      clearTimeout(timerId);

      if (err instanceof ApiError) throw err;

      const name = (err as Error).name;
      if (name === "AbortError" || controller.signal.aborted) {
        throw new ApiError("ABORTED", "Stream timed out or aborted", 0, false);
      }

      if (attempt < maxRetries) {
        await sleep(baseDelay * 2 ** attempt);
        continue;
      }

      const message = err instanceof Error ? err.message : "Stream network error";
      errorBus.network(message, true);
      throw new ApiError("STREAM_ERROR", message, 0, true);
    }
  }

  // Should be unreachable
  throw new ApiError("STREAM_ERROR", "Max retries exceeded", 0, false);
}

// ── Internal helpers ──────────────────────────────────────────

async function readStream(
  body: ReadableStream<Uint8Array>,
  onToken: (chunk: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let full = "";

  try {
    while (true) {
      if (signal.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        full += chunk;
        onToken(chunk);
      }
    }
  } finally {
    // Always release the reader lock
    reader.cancel().catch(() => {});
  }

  return full || "No response generated.";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

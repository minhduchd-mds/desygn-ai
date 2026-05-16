/**
 * streamClient — unit tests
 * Focus: success flow, retry on 5xx, abort, error response body parsing.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { postStream } from "../streamClient";
import { errorBus } from "../errorBus";

afterEach(() => {
  vi.restoreAllMocks();
  errorBus.clear();
});

// ── Helpers ────────────────────────────────────────────────────

function makeStreamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, { status });
}

function makeJsonErrorResponse(status: number, error?: string): Response {
  return new Response(JSON.stringify({ error: error ?? `Error ${status}` }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe("postStream", () => {

  describe("success path", () => {
    it("collects all chunks and returns full text", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeStreamResponse(["Hello", " ", "World"])));
      const tokens: string[] = [];
      const result = await postStream("/api/stream", {}, (t) => tokens.push(t));
      expect(result).toBe("Hello World");
      expect(tokens).toEqual(["Hello", " ", "World"]);
    });

    it("calls onToken for each chunk", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeStreamResponse(["a", "b", "c"])));
      const onToken = vi.fn();
      await postStream("/api/stream", {}, onToken);
      expect(onToken).toHaveBeenCalledTimes(3);
    });

    it("sends body as JSON with Content-Type header", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeStreamResponse(["ok"]));
      vi.stubGlobal("fetch", fetchMock);
      await postStream("/api/stream", { key: "value" }, vi.fn());
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
      expect(init.body).toBe(JSON.stringify({ key: "value" }));
    });

    it("returns fallback text when stream is empty", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeStreamResponse([""])));
      const result = await postStream("/api/stream", {}, vi.fn());
      expect(result).toBe("No response generated.");
    });
  });

  describe("error handling", () => {
    it("throws on non-ok response (no retries left)", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeJsonErrorResponse(400, "Bad input")));
      await expect(
        postStream("/api/stream", {}, vi.fn(), { maxRetries: 0 }),
      ).rejects.toMatchObject({ code: "HTTP_400" });
    });

    it("retries on 500 and succeeds second attempt", async () => {
      let calls = 0;
      vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
        calls++;
        if (calls === 1) return Promise.resolve(makeJsonErrorResponse(500));
        return Promise.resolve(makeStreamResponse(["ok"]));
      }));
      const result = await postStream("/api/stream", {}, vi.fn(), { maxRetries: 1, retryDelay: 0 });
      expect(result).toBe("ok");
      expect(calls).toBe(2);
    });

    it("throws after all retries exhausted on 500", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeJsonErrorResponse(500)));
      await expect(
        postStream("/api/stream", {}, vi.fn(), { maxRetries: 1, retryDelay: 0 }),
      ).rejects.toMatchObject({ code: "HTTP_500" });
    });

    it("does NOT retry on 400 client errors", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeJsonErrorResponse(400));
      vi.stubGlobal("fetch", fetchMock);
      await postStream("/api/stream", {}, vi.fn(), { maxRetries: 3, retryDelay: 0 }).catch(() => {});
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("throws STREAM_ERROR on network failure after retries", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network error")));
      await expect(
        postStream("/api/stream", {}, vi.fn(), { maxRetries: 0, retryDelay: 0 }),
      ).rejects.toMatchObject({ code: "STREAM_ERROR" });
    });

    it("emits to errorBus on failure", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeJsonErrorResponse(503, "Overloaded")));
      const handler = vi.fn();
      errorBus.subscribe(handler);
      await postStream("/api/stream", {}, vi.fn(), { maxRetries: 0 }).catch(() => {});
      expect(handler).toHaveBeenCalled();
    });

    it("throws ABORTED when pre-aborted signal is provided", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeStreamResponse(["x"])));
      const controller = new AbortController();
      controller.abort();
      await expect(
        postStream("/api/stream", {}, vi.fn(), { signal: controller.signal }),
      ).rejects.toMatchObject({ code: "ABORTED" });
    });

    it("throws NO_BODY when response has no body", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
      await expect(
        postStream("/api/stream", {}, vi.fn(), { maxRetries: 0 }),
      ).rejects.toMatchObject({ code: "NO_BODY" });
    });
  });
});

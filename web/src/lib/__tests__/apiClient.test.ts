/**
 * apiClient — unit tests
 * Focus: retry logic, deduplication, interceptors, error normalization, timeout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient, ApiError } from "../apiClient";
import { errorBus } from "../errorBus";

// ── Helpers ────────────────────────────────────────────────────

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeErrorResponse(status: number, error?: string): Response {
  return makeJsonResponse({ error: error ?? `Error ${status}` }, status);
}

// ── Tests ──────────────────────────────────────────────────────

describe("apiClient (ApiClient)", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient();
    errorBus.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("get()", () => {
    it("returns parsed JSON on 200", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeJsonResponse({ ok: true })));
      const result = await client.get<{ ok: boolean }>("/test");
      expect(result).toEqual({ ok: true });
    });

    it("passes correct method", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse({}));
      vi.stubGlobal("fetch", fetchMock);
      await client.get("/test");
      expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET" });
    });
  });

  describe("post()", () => {
    it("sends JSON body and Content-Type header", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse({ created: true }));
      vi.stubGlobal("fetch", fetchMock);
      await client.post("/create", { name: "Test" });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      // Headers are normalized to lowercase by the Headers constructor
      const headers = init.headers as Record<string, string>;
      const ctKey = Object.keys(headers).find((k) => k.toLowerCase() === "content-type");
      expect(ctKey).toBeDefined();
      expect(headers[ctKey!].toLowerCase()).toContain("application/json");
      expect(init.body).toBe(JSON.stringify({ name: "Test" }));
    });
  });

  describe("retry", () => {
    it("retries on 500 and succeeds on second attempt", async () => {
      let calls = 0;
      vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
        calls++;
        if (calls === 1) return Promise.resolve(makeErrorResponse(500));
        return Promise.resolve(makeJsonResponse({ ok: true }));
      }));
      const result = await client.get<{ ok: boolean }>("/test", { retry: 2, retryDelay: 0 });
      expect(result).toEqual({ ok: true });
      expect(calls).toBe(2);
    });

    it("throws ApiError after exhausting retries", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeErrorResponse(500, "Server error")));
      await expect(
        client.get("/test", { retry: 1, retryDelay: 0 }),
      ).rejects.toBeInstanceOf(ApiError);
    });

    it("retries on 429 Too Many Requests", async () => {
      let calls = 0;
      vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
        calls++;
        if (calls < 3) {
          return Promise.resolve(new Response("{}", { status: 429 }));
        }
        return Promise.resolve(makeJsonResponse({ ok: true }));
      }));
      const result = await client.get<{ ok: boolean }>("/test", { retry: 3, retryDelay: 0 });
      expect(result).toEqual({ ok: true });
    });

    it("does NOT retry on 400 client error", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeErrorResponse(400, "Bad Request"));
      vi.stubGlobal("fetch", fetchMock);
      await expect(client.get("/test", { retry: 3, retryDelay: 0 })).rejects.toBeInstanceOf(ApiError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry on 404", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeErrorResponse(404));
      vi.stubGlobal("fetch", fetchMock);
      await expect(client.get("/test", { retry: 3, retryDelay: 0 })).rejects.toBeInstanceOf(ApiError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("ApiError shape", () => {
    it("error has correct status and code on 404", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeErrorResponse(404, "Not found")));
      try {
        await client.get("/test", { retry: 0 });
      } catch (e) {
        const err = e as ApiError;
        expect(err.status).toBe(404);
        expect(err.code).toBe("HTTP_404");
        expect(err.message).toBe("Not found");
        expect(err.retryable).toBe(false);
      }
    });

    it("uses error body message when available", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeErrorResponse(422, "Validation failed")));
      try {
        await client.get("/test", { retry: 0 });
      } catch (e) {
        expect((e as ApiError).message).toBe("Validation failed");
      }
    });
  });

  describe("request deduplication", () => {
    it("concurrent calls with same dedupKey share one fetch()", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse({ data: 1 }));
      vi.stubGlobal("fetch", fetchMock);
      await Promise.all([
        client.get("/test", { dedupKey: "same" }),
        client.get("/test", { dedupKey: "same" }),
        client.get("/test", { dedupKey: "same" }),
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("different dedupKeys result in separate fetches", async () => {
      // Each call must get a fresh Response (body can only be read once)
      const fetchMock = vi.fn().mockImplementation(() =>
        Promise.resolve(makeJsonResponse({ id: Math.random() })),
      );
      vi.stubGlobal("fetch", fetchMock);
      await Promise.all([
        client.get("/test", { dedupKey: "key-a" }),
        client.get("/test", { dedupKey: "key-b" }),
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("request interceptors", () => {
    it("can add headers via request interceptor", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse({}));
      vi.stubGlobal("fetch", fetchMock);
      client.addRequestInterceptor((url, init) => [
        url,
        { ...init, headers: { ...(init.headers as Record<string, string>), "X-Auth": "token123" } },
      ]);
      await client.get("/test");
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)["X-Auth"]).toBe("token123");
    });
  });

  describe("response interceptors", () => {
    it("can transform response via response interceptor", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeJsonResponse({ raw: true })));
      client.addResponseInterceptor(async (res) => {
        const body = await res.json() as { raw: boolean };
        return new Response(JSON.stringify({ transformed: body.raw }), { status: 200 });
      });
      const result = await client.get<{ transformed: boolean }>("/test");
      expect(result).toEqual({ transformed: true });
    });
  });

  describe("abort / timeout", () => {
    it("throws ApiError ABORTED when signal is pre-aborted", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeJsonResponse({})));
      const controller = new AbortController();
      controller.abort();
      await expect(client.get("/test", { signal: controller.signal })).rejects.toMatchObject({
        code: "ABORTED",
      });
    });
  });

  describe("network error", () => {
    it("throws ApiError NETWORK_ERROR on fetch() rejection", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
      await expect(client.get("/test", { retry: 0 })).rejects.toMatchObject({
        code: "NETWORK_ERROR",
      });
    });

    it("emits to errorBus on network error", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fail")));
      const handler = vi.fn();
      errorBus.subscribe(handler);
      await client.get("/test", { retry: 0 }).catch(() => {});
      expect(handler).toHaveBeenCalled();
    });
  });
});

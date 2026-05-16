/**
 * apiClient — centralized HTTP client (the single fetch() caller in the app).
 *
 * Features:
 *  • Retry with exponential backoff (configurable, respects 429 Retry-After)
 *  • Request deduplication — identical concurrent GET/POST share one Promise
 *  • Request + Response interceptors (auth headers, response transforms)
 *  • AbortController lifecycle (per-request timeout + external signal merge)
 *  • Normalized ApiError (code, status, retryable)
 *  • Emits to errorBus on failure
 */

import { errorBus } from "./errorBus";

// ── Error ────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    /** HTTP status code, or 0 for network/timeout errors. */
    public readonly status: number,
    /** True when the caller may safely retry. */
    public readonly retryable: boolean,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Options ──────────────────────────────────────────────────

export interface RequestOptions {
  /** External AbortSignal merged with internal timeout controller. */
  signal?: AbortSignal;
  /** Max retry attempts on 5xx / network errors (default 3). */
  retry?: number;
  /** Base delay in ms for exponential backoff (default 300). */
  retryDelay?: number;
  /**
   * Deduplication key. Concurrent calls with the same key share one Promise.
   * Auto-generated from method+url+body when not provided.
   */
  dedupKey?: string;
  /** Per-request timeout in ms (default 15 000). */
  timeout?: number;
  /** Extra headers merged over the request init headers. */
  headers?: Record<string, string>;
}

// ── Interceptors ──────────────────────────────────────────────

type RequestInterceptor = (
  url: string,
  init: RequestInit,
) => [string, RequestInit] | Promise<[string, RequestInit]>;

type ResponseInterceptor = (
  res: Response,
  url: string,
) => Response | Promise<Response>;

// ── Client ───────────────────────────────────────────────────

class ApiClient {
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly reqInterceptors: RequestInterceptor[] = [];
  private readonly resInterceptors: ResponseInterceptor[] = [];

  // ── Interceptor registration ─────────────────────────────

  addRequestInterceptor(fn: RequestInterceptor): void {
    this.reqInterceptors.push(fn);
  }

  addResponseInterceptor(fn: ResponseInterceptor): void {
    this.resInterceptors.push(fn);
  }

  // ── Public API ────────────────────────────────────────────

  async get<T>(url: string, opts: RequestOptions = {}): Promise<T> {
    return this._request<T>(url, { method: "GET" }, opts);
  }

  async post<T>(url: string, body: unknown, opts: RequestOptions = {}): Promise<T> {
    return this._request<T>(
      url,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      opts,
    );
  }

  async put<T>(url: string, body: unknown, opts: RequestOptions = {}): Promise<T> {
    return this._request<T>(
      url,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      opts,
    );
  }

  async patch<T>(url: string, body: unknown, opts: RequestOptions = {}): Promise<T> {
    return this._request<T>(
      url,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      opts,
    );
  }

  async delete<T>(url: string, opts: RequestOptions = {}): Promise<T> {
    return this._request<T>(url, { method: "DELETE" }, opts);
  }

  // ── Internal ──────────────────────────────────────────────

  private async _request<T>(url: string, init: RequestInit, opts: RequestOptions): Promise<T> {
    const key = opts.dedupKey ?? `${String(init.method)}:${url}:${String(init.body ?? "")}`;

    if (opts.dedupKey && this.inflight.has(key)) {
      return this.inflight.get(key) as Promise<T>;
    }

    const promise = (async (): Promise<T> => {
      const res = await this._fetchWithRetry(url, init, opts);
      const text = await res.text();
      if (!text) return undefined as T;
      try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
    })();

    if (opts.dedupKey) {
      this.inflight.set(key, promise);
      void promise.finally(() => this.inflight.delete(key));
    }

    return promise;
  }

  private async _fetchWithRetry(
    url: string,
    init: RequestInit,
    opts: RequestOptions,
    attempt = 0,
  ): Promise<Response> {
    const maxRetries = opts.retry ?? 3;
    const baseDelay = opts.retryDelay ?? 300;
    const timeout = opts.timeout ?? 15_000;

    // Merge external signal + internal timeout
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort("timeout"), timeout);
    if (opts.signal) {
      if (opts.signal.aborted) {
        clearTimeout(timerId);
        throw new ApiError("ABORTED", "Request aborted before start", 0, false);
      }
      opts.signal.addEventListener("abort", () => controller.abort(opts.signal!.reason));
    }

    try {
      // Apply request interceptors
      let [finalUrl, finalInit] = await this._applyReqInterceptors(url, {
        ...init,
        signal: controller.signal,
        headers: mergeHeaders(init.headers, opts.headers),
      });

      const res = await fetch(finalUrl, finalInit);
      clearTimeout(timerId);

      // Apply response interceptors
      const intercepted = await this._applyResInterceptors(res, finalUrl);

      if (!intercepted.ok) {
        const shouldRetry = attempt < maxRetries && (intercepted.status >= 500 || intercepted.status === 429);

        if (shouldRetry) {
          const retryAfter = intercepted.status === 429
            ? (Number(intercepted.headers.get("Retry-After") ?? 0) * 1000 || baseDelay * 2 ** attempt)
            : baseDelay * 2 ** attempt;
          await sleep(retryAfter);
          return this._fetchWithRetry(url, init, opts, attempt + 1);
        }

        // Parse error body
        let message = `HTTP ${intercepted.status}`;
        let code = `HTTP_${intercepted.status}`;
        try {
          const body = await intercepted.clone().json() as { error?: string; code?: string };
          if (body.error) message = body.error;
          if (body.code) code = body.code;
        } catch { /* ignore */ }

        const err = new ApiError(code, message, intercepted.status, false);
        errorBus.network(message, false);
        throw err;
      }

      return intercepted;
    } catch (err) {
      clearTimeout(timerId);

      if (err instanceof ApiError) throw err;

      // Network / timeout / abort
      const name = (err as Error).name;
      if (name === "AbortError" || controller.signal.aborted) {
        throw new ApiError("ABORTED", "Request timed out or aborted", 0, false);
      }

      if (attempt < maxRetries) {
        await sleep(baseDelay * 2 ** attempt);
        return this._fetchWithRetry(url, init, opts, attempt + 1);
      }

      const message = err instanceof Error ? err.message : "Network error";
      errorBus.network(message, true);
      throw new ApiError("NETWORK_ERROR", message, 0, true);
    }
  }

  private async _applyReqInterceptors(url: string, init: RequestInit): Promise<[string, RequestInit]> {
    let cur: [string, RequestInit] = [url, init];
    for (const fn of this.reqInterceptors) cur = await fn(cur[0], cur[1]);
    return cur;
  }

  private async _applyResInterceptors(res: Response, url: string): Promise<Response> {
    let cur = res;
    for (const fn of this.resInterceptors) cur = await fn(cur, url);
    return cur;
  }
}

// ── Helpers ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeHeaders(
  base?: HeadersInit,
  extra?: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (base) {
    const h = base instanceof Headers ? base : new Headers(base);
    h.forEach((v, k) => { result[k] = v; });
  }
  if (extra) Object.assign(result, extra);
  return result;
}

// ── Singleton ─────────────────────────────────────────────────

export const apiClient = new ApiClient();
export { ApiClient };

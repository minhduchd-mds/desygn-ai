/**
 * rateLimit — client-side token bucket rate limiter.
 *
 * Prevents hammering the API when user types/clicks rapidly.
 * Algorithm: token bucket with lazy refill (no interval timer needed).
 *
 * Usage:
 *   if (!chatRateLimit.consume()) throw new Error("Too fast — wait a moment");
 *   await chatRateLimit.wait(); // OR block until token available
 */

export interface RateLimitOptions {
  /** Maximum burst capacity. */
  maxTokens: number;
  /** Tokens added per second. */
  refillRate: number;
  /** Starting tokens (defaults to maxTokens). */
  initialTokens?: number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens/second

  constructor({ maxTokens, refillRate, initialTokens }: RateLimitOptions) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = initialTokens ?? maxTokens;
    this.lastRefillMs = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefillMs) / 1000; // seconds
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefillMs = now;
  }

  /**
   * Attempt to consume `cost` tokens.
   * Returns `true` if allowed, `false` if rate-limited (no wait).
   */
  consume(cost = 1): boolean {
    this.refill();
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }

  /**
   * Wait (async) until `cost` tokens are available, then consume.
   * Respects optional AbortSignal.
   */
  async wait(cost = 1, signal?: AbortSignal): Promise<void> {
    this.refill();
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return;
    }
    const deficit = cost - this.tokens;
    const waitMs = Math.ceil((deficit / this.refillRate) * 1000);
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
      const timer = setTimeout(resolve, waitMs);
      signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); });
    });
    this.tokens = Math.max(0, this.tokens - cost);
    this.lastRefillMs = Date.now();
  }

  /** How many full tokens are currently available (floor). */
  get available(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /** Seconds until next token is available (0 if already available). */
  get waitSeconds(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return (1 - this.tokens) / this.refillRate;
  }

  /** Reset bucket to full. */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefillMs = Date.now();
  }
}

// ── Shared singleton limiters ─────────────────────────────────

/** Chat API: 10 burst, 1 req/s steady. */
export const chatRateLimit = new TokenBucket({ maxTokens: 10, refillRate: 1 });

/** General API calls: 30 burst, 3 req/s steady. */
export const apiRateLimit = new TokenBucket({ maxTokens: 30, refillRate: 3 });

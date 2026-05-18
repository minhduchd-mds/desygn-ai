/**
 * Upstash Redis rate limiter for Vercel serverless/edge functions.
 *
 * Uses sliding window algorithm via @upstash/ratelimit.
 * Gracefully degrades to allow-all when env vars are missing.
 *
 * Limits:
 *   - AI endpoints:     20 req / 60 s
 *   - Non-AI endpoints: 50 req / 60 s
 *   - GitHub endpoints: 10 req / 60 s (pass limit=10 explicitly)
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix timestamp (seconds) when the window resets */
  reset: number;
}

// Lazy singleton — only constructed when env vars are present
let redisClient: Redis | null = null;
const limiters = new Map<number, Ratelimit>();

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!redisClient) {
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

function getLimiter(maxRequests: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!limiters.has(maxRequests)) {
    limiters.set(
      maxRequests,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxRequests, "60 s"),
        analytics: false,
      })
    );
  }
  return limiters.get(maxRequests)!;
}

/**
 * Extract the most-specific client identifier from request headers.
 * Uses x-forwarded-for (Vercel injects this) or falls back to "anonymous".
 */
export function getClientIdentifier(
  headers: Record<string, string | string[] | undefined>
): string {
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() ?? "anonymous";
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0]?.split(",")[0]?.trim() ?? "anonymous";
  }
  const realIp = headers["x-real-ip"];
  if (typeof realIp === "string" && realIp) return realIp;
  return "anonymous";
}

/**
 * Check the rate limit for a given identifier.
 *
 * @param identifier - usually `"endpoint-name:<ip>"`
 * @param maxRequests - requests allowed per 60-second window (default 20)
 */
export async function rateLimit(
  identifier: string,
  maxRequests = 20
): Promise<RateLimitResult> {
  const limiter = getLimiter(maxRequests);

  // Graceful degradation: no Redis configured → allow all
  if (!limiter) {
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests,
      reset: Math.floor(Date.now() / 1000) + 60,
    };
  }

  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: Math.floor(result.reset / 1000), // Upstash returns ms, convert to seconds
  };
}

// ---------------------------------------------------------------------------
// withRateLimit — wraps a Vercel Node.js handler (VercelRequest / VercelResponse)
// ---------------------------------------------------------------------------

type VercelHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;

/**
 * Wrap a Vercel handler with rate limiting.
 *
 * @param handler     - the original route handler
 * @param endpointKey - prefix used in the Redis key, e.g. "github-issues"
 * @param maxRequests - max allowed requests per 60 s (default 20)
 */
export function withRateLimit(
  handler: VercelHandler,
  endpointKey: string,
  maxRequests = 20
): VercelHandler {
  return async (req: VercelRequest, res: VercelResponse) => {
    const ip = getClientIdentifier(
      req.headers as Record<string, string | string[] | undefined>
    );
    const identifier = `${endpointKey}:${ip}`;

    const result = await rateLimit(identifier, maxRequests);

    // Always set informational headers
    res.setHeader("X-RateLimit-Limit", String(result.limit));
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    res.setHeader("X-RateLimit-Reset", String(result.reset));

    if (!result.success) {
      const retryAfter = Math.max(0, result.reset - Math.floor(Date.now() / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfter,
      });
    }

    return handler(req, res);
  };
}

// ---------------------------------------------------------------------------
// withRateLimitEdge — wraps an edge-runtime handler (Web Request / Response)
// ---------------------------------------------------------------------------

type EdgeHandler = (req: Request) => Promise<Response> | Response;

/**
 * Wrap an edge-runtime handler with rate limiting.
 *
 * @param handler     - the original edge handler
 * @param endpointKey - prefix used in the Redis key, e.g. "chat-stream"
 * @param maxRequests - max allowed requests per 60 s (default 20)
 */
export function withRateLimitEdge(
  handler: EdgeHandler,
  endpointKey: string,
  maxRequests = 20
): EdgeHandler {
  return async (req: Request) => {
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const ip = getClientIdentifier(headers);
    const identifier = `${endpointKey}:${ip}`;

    const result = await rateLimit(identifier, maxRequests);

    const rateLimitHeaders: Record<string, string> = {
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(result.reset),
    };

    if (!result.success) {
      const retryAfter = Math.max(0, result.reset - Math.floor(Date.now() / 1000));
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...rateLimitHeaders,
            "Retry-After": String(retryAfter),
            "Content-Type": "application/json",
          },
        }
      );
    }

    const response = await handler(req);

    // Attach rate-limit headers to the proxied response
    const newHeaders = new Headers(response.headers);
    for (const [k, v] of Object.entries(rateLimitHeaders)) {
      newHeaders.set(k, v);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

/**
 * Shared CORS configuration for all API routes.
 * Restrict origin in production — wildcard only for local dev.
 */

const ALLOWED_ORIGINS = [
  "https://design-md-ai.vercel.app",
  "https://designready.ai",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

export function getAllowedOrigin(req: { headers?: { get?: (name: string) => string | null }; method?: string } | { headers?: Record<string, string | undefined> }): string {
  let origin: string | null | undefined;
  if ("get" in (req.headers ?? {})) {
    origin = (req.headers as { get: (n: string) => string | null }).get("origin");
  } else {
    origin = (req.headers as Record<string, string | undefined> | undefined)?.origin;
  }
  if (origin && ALLOWED_ORIGINS.some((o) => origin!.startsWith(o))) return origin;
  if (process.env.NODE_ENV === "development") return origin ?? "*";
  return ALLOWED_ORIGINS[0];
}

/** CORS headers for edge runtime (Request-based) */
export function buildCorsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin({ headers: req.headers }),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/** CORS headers for Node/Vercel serverless (VercelRequest-based) */
export function setCorsHeaders(
  res: { setHeader: (name: string, value: string) => void },
  origin: string,
): void {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

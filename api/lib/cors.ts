/**
 * Shared CORS configuration for all API routes.
 * Production only accepts the deployed application origins. Local origins are
 * enabled exclusively in development.
 */

const PRODUCTION_ORIGINS = new Set([
  "https://design-md-ai.vercel.app",
  "https://design-md-ai-yd6r.vercel.app",
]);

const DEVELOPMENT_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
]);

function readOrigin(req: { headers?: { get?: (name: string) => string | null } | Record<string, string | string[] | undefined> }): string | null {
  const headers = req.headers;
  if (!headers) return null;

  if (typeof (headers as { get?: unknown }).get === "function") {
    return (headers as { get: (name: string) => string | null }).get("origin");
  }

  const raw = (headers as Record<string, string | string[] | undefined>).origin;
  return Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
}

export function getAllowedOrigin(req: { headers?: { get?: (name: string) => string | null } | Record<string, string | string[] | undefined> }): string {
  const origin = readOrigin(req);
  const isDevelopment = process.env.NODE_ENV === "development";

  if (origin && PRODUCTION_ORIGINS.has(origin)) return origin;
  if (isDevelopment && origin && DEVELOPMENT_ORIGINS.has(origin)) return origin;
  if (isDevelopment && !origin) return "*";

  // Never reflect an untrusted Origin. Returning the canonical production
  // origin makes browsers reject cross-origin reads from unapproved sites.
  return "https://design-md-ai.vercel.app";
}

/** CORS headers for edge runtime (Request-based) */
export function buildCorsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin({ headers: req.headers }),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
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
  res.setHeader("Vary", "Origin");
}

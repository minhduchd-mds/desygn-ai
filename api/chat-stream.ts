import { createGroq } from "@ai-sdk/groq";
import { streamText } from "ai";
import {
  buildCorsHeaders,
  buildSystemPrompt,
  errorResponse,
  handlePreflight,
  normalizeMessages,
  parseBody,
  resolveModel,
} from "./lib/chat-shared";
import { checkRateLimit, getClientIp } from "./lib/rateLimit";
import { withRateLimitEdge } from "./lib/rate-limit";

export const config = { runtime: "edge", maxDuration: 30 };

async function handler(req: Request): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const cors = buildCorsHeaders(req);

  // Rate limiting
  const ip = getClientIp(Object.fromEntries(req.headers.entries()));
  const rl = checkRateLimit(`chat-stream:${ip}`);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(Math.ceil(rl.resetMs / 1000)) },
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return errorResponse("GROQ_API_KEY not configured.", 500, req);

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return errorResponse("Invalid JSON.", 400, req);
  }

  const messages = normalizeMessages(body.messages);
  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    return errorResponse("A user message is required.", 400, req);
  }

  try {
    const groq = createGroq({ apiKey });

    const result = streamText({
      model: groq(resolveModel(body.context)),
      system: buildSystemPrompt(body.context),
      messages,
      maxOutputTokens: 8192,
      temperature: 0.7,
    });

    return result.toTextStreamResponse({ headers: cors });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Stream failed.", 500, req);
  }
}

// Wrap with Upstash Redis sliding-window rate limit: 20 req / 60 s per IP
export default withRateLimitEdge(handler, "chat-stream", 20);

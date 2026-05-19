import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import type { LanguageModel } from "ai";
import {
  buildCorsHeaders,
  buildSystemPrompt,
  errorResponse,
  handlePreflight,
  normalizeMessages,
  parseBody,
  resolveModelDef,
} from "./lib/chat-shared";
import { checkRateLimit, getClientIp } from "./lib/rateLimit";

export const config = { runtime: "edge", maxDuration: 30 };

export default async function handler(req: Request): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const cors = buildCorsHeaders(req);

  // Rate limiting
  const ip = getClientIp(Object.fromEntries(req.headers.entries()));
  const rl = checkRateLimit(`chat:${ip}`);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(Math.ceil(rl.resetMs / 1000)) },
    });
  }

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

  // ── Resolve model & provider ──────────────────────────────────
  const modelDef = resolveModelDef(body.context);
  let model: LanguageModel;

  try {
    if (modelDef.provider === "google") {
      const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!googleKey) return errorResponse("GOOGLE_GENERATIVE_AI_API_KEY not configured.", 500, req);
      const google = createGoogleGenerativeAI({ apiKey: googleKey });
      model = google(modelDef.providerModelId);
    } else {
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) return errorResponse("GROQ_API_KEY not configured.", 500, req);
      const groq = createGroq({ apiKey: groqKey });
      model = groq(modelDef.providerModelId);
    }
  } catch (error) {
    return errorResponse(`Provider init failed: ${error instanceof Error ? error.message : String(error)}`, 500, req);
  }

  try {
    const { text } = await generateText({
      model,
      system: buildSystemPrompt(body.context),
      messages,
      maxOutputTokens: 8192,
      temperature: 0.7,
    });

    return new Response(JSON.stringify({ message: text }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Chat request failed.", 500, req);
  }
}

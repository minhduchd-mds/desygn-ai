import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import {
  buildCorsHeaders,
  buildSystemPrompt,
  errorResponse,
  handlePreflight,
  normalizeMessages,
  parseBody,
  resolveModel,
} from "./lib/chat-shared";

export const config = { runtime: "edge", maxDuration: 30 };

export default async function handler(req: Request): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const cors = buildCorsHeaders(req);
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

    const { text } = await generateText({
      model: groq(resolveModel(body.context)),
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

import OpenAI from "openai";

export const config = { api: { bodyParser: true } };

interface DocSource {
  filename: string;
  content: string;
  type: "md" | "txt" | "zip-entry";
}

interface BootstrapBody {
  prompt?: string;
  docs?: DocSource[];
}

interface VercelRequest {
  method?: string;
  body?: BootstrapBody;
}

interface VercelResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  end: () => void;
}

import { getAllowedOrigin, setCorsHeaders } from "./lib/cors";

const systemPrompt =
  'You are a UI design system expert. The user is starting a new project with no existing components. Based on their project description and any BA documentation provided, suggest the minimal component set needed. Return ONLY valid JSON object with key "components" containing an array of component name strings. Maximum 12 components. Example: {"components": ["Button","Input","Card","Modal","Toast"]}';

function setCors(response: VercelResponse): void {
  setCorsHeaders(response, getAllowedOrigin({ headers: {} }));
}

function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[^\x20-\x7E\n\r\tÀ-ɏ一-鿿]/g, "")
    .trim()
    .slice(0, 10000);
}

function parseComponents(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const components =
      Array.isArray(parsed)
        ? parsed
        : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { components?: unknown }).components)
          ? (parsed as { components: unknown[] }).components
          : [];
    return components
      .filter((item): item is string => typeof item === "string")
      .map((item) => sanitize(item))
      .filter(Boolean)
      .slice(0, 12);
  } catch {
    return [];
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  setCors(response);

  if (request.method === "OPTIONS") { response.status(200).end(); return; }
  if (request.method !== "POST") { response.status(405).json({ error: "Method not allowed." }); return; }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) { response.status(500).json({ error: "GROQ_API_KEY is not configured." }); return; }

  const prompt = sanitize(request.body?.prompt ?? "");
  const docs = request.body?.docs ?? [];
  const userPrompt = `Project description: ${prompt}
BA documentation: ${sanitize(docs.map((d) => d.content).join("\n")).slice(0, 2000)}`;

  try {
    const groq = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    response.status(200).json({
      components: parseComponents(completion.choices[0]?.message.content ?? "{}"),
    });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "Bootstrap generation failed." });
  }
}

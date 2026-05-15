import OpenAI from "openai";

export const config = { api: { bodyParser: true } };

type MimeType = "image/png" | "image/jpeg" | "image/webp";
type Columns = 1 | 2 | 3 | "sidebar";

interface LayoutPattern {
  columns: Columns;
  navPosition: "top" | "left" | "none";
  cardStyle: "list" | "grid" | "table" | "kanban";
  colorScheme: "light" | "dark";
  density: "compact" | "comfortable" | "spacious";
}

interface TemplateMeta {
  id: string;
  category: string;
  priority: string;
  keywords: string[];
}

interface TemplateMatch {
  templateId: string;
  score: number;
  matchReason: string;
}

interface AnalyzeImageBody {
  base64Image?: string;
  mimeType?: MimeType;
  contextSummary?: string;
  templateMeta?: TemplateMeta[];
}

interface VercelRequest {
  method?: string;
  body?: AnalyzeImageBody;
}

interface VercelResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  end: () => void;
}

import { getAllowedOrigin, setCorsHeaders } from "./lib/cors";

const visionSystemPrompt = `You are a UI layout analysis expert. Analyze the provided UI screenshot.
Return ONLY valid JSON with this exact schema (no markdown, no explanation):
{
  "columns": 1 or 2 or 3 or "sidebar",
  "navPosition": "top" or "left" or "none",
  "cardStyle": "list" or "grid" or "table" or "kanban",
  "colorScheme": "light" or "dark",
  "density": "compact" or "comfortable" or "spacious"
}`;

function setCors(req: VercelRequest, res: VercelResponse): void {
  const origin = getAllowedOrigin({ headers: {} });
  setCorsHeaders(res, origin);
}

function isMimeType(value: unknown): value is MimeType {
  return value === "image/png" || value === "image/jpeg" || value === "image/webp";
}

function normalizeLayoutPattern(raw: unknown): LayoutPattern {
  const v = typeof raw === "object" && raw !== null ? raw as Partial<LayoutPattern> : {};
  return {
    columns: v.columns === 1 || v.columns === 2 || v.columns === 3 || v.columns === "sidebar" ? v.columns : 1,
    navPosition: v.navPosition === "top" || v.navPosition === "left" || v.navPosition === "none" ? v.navPosition : "none",
    cardStyle: v.cardStyle === "list" || v.cardStyle === "grid" || v.cardStyle === "table" || v.cardStyle === "kanban" ? v.cardStyle : "list",
    colorScheme: v.colorScheme === "dark" ? "dark" : "light",
    density: v.density === "compact" || v.density === "comfortable" || v.density === "spacious" ? v.density : "comfortable",
  };
}

function scoreTemplates(layoutPattern: LayoutPattern, contextSummary: string, templateMeta: TemplateMeta[]): TemplateMatch[] {
  const summary = contextSummary.toLowerCase();
  return templateMeta
    .map((t) => {
      const reasons: string[] = [];
      let score = 0;
      const kw = t.keywords.map((k) => k.toLowerCase());

      if (layoutPattern.columns === "sidebar" && kw.some((k) => k === "dashboard" || k === "admin")) { score += 25; reasons.push("sidebar dashboard/admin layout"); }
      if (layoutPattern.cardStyle === "table" && kw.some((k) => k === "table" || k === "data")) { score += 25; reasons.push("table/data layout"); }
      if (layoutPattern.cardStyle === "grid" && kw.some((k) => k === "gallery" || k === "products")) { score += 25; reasons.push("grid gallery/products layout"); }
      if (layoutPattern.navPosition === "left" && (t.category === "Developer" || t.category === "AI")) { score += 20; reasons.push("left navigation fits technical UI"); }

      const matched = kw.filter((k) => k.length >= 3 && summary.includes(k)).slice(0, 3);
      if (matched.length > 0) { score += Math.min(30, matched.length * 10); reasons.push(`context matched ${matched.join(", ")}`); }

      return { templateId: t.id, score: Math.min(100, score), matchReason: reasons.slice(0, 2).join("; ") || "Vision fallback ranking." };
    })
    .sort((a, b) => b.score - a.score || a.templateId.localeCompare(b.templateId))
    .slice(0, 3);
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  setCors(request, response);

  if (request.method === "OPTIONS") { response.status(200).end(); return; }
  if (request.method !== "POST") { response.status(405).json({ error: "Method not allowed." }); return; }

  const { base64Image, mimeType, contextSummary = "", templateMeta = [] } = request.body ?? {};
  if (!base64Image || !isMimeType(mimeType) || templateMeta.length === 0) {
    response.status(400).json({ error: "Invalid request body." });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) { response.status(500).json({ error: "GROQ_API_KEY is not configured." }); return; }

  try {
    const groq = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
    const completion = await groq.chat.completions.create({
      // Llama 4 Scout — vision model trên Groq
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: visionSystemPrompt },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            { type: "text", text: contextSummary || "Analyze this UI screenshot." },
          ],
        },
      ],
    });

    const layoutPattern = normalizeLayoutPattern(JSON.parse(completion.choices[0]?.message.content ?? "{}"));
    response.status(200).json({ layoutPattern, top3: scoreTemplates(layoutPattern, contextSummary, templateMeta) });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "Image analysis failed." });
  }
}

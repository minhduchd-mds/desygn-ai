import OpenAI from "openai";

export const config = { api: { bodyParser: true } };

interface GenerateHtmlBody {
  prompt?: string;
  style?: string;
}

interface VercelRequest {
  method?: string;
  body?: GenerateHtmlBody;
}

interface VercelResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  end: () => void;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const systemPrompt =
  "You are an expert frontend developer. Output ONLY a complete, self-contained HTML document. No markdown, no code fences, no explanation — just raw HTML starting with <!DOCTYPE html>. Include all CSS in <style> and all JS in <script>. Use modern CSS with custom properties. Make the UI visually polished, dark-themed (--bg: #0f172a, --primary: #6366f1), and fully responsive. No external libraries except Google Fonts.";

function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, "").replace(/[^\x20-\x7E\n\rÀ-ɏ]/g, "").trim().slice(0, 4000);
}

function buildPrompt(prompt: string, style: string): string {
  return `Create a complete, beautiful, standalone HTML page for: ${prompt}

Design style: ${style || "Modern dark UI with indigo accent"}

Requirements:
- Self-contained: all CSS in <style>, all JS in <script>, no external JS
- Dark theme: background #0f172a, cards #1e293b, accent #6366f1
- Mobile responsive with fluid layout
- CSS custom properties for all design tokens
- Smooth transitions (200ms ease) on all interactive elements
- Realistic placeholder content (text, data, names)
- Micro-interactions: hover effects, focus rings, button press states
- Include: navigation header, main content area, footer
- Semantic HTML5 elements with ARIA where needed

Output ONLY the complete HTML document starting with <!DOCTYPE html>.`;
}

function setCors(res: VercelResponse): void {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  setCors(response);
  if (request.method === "OPTIONS") { response.status(200).end(); return; }
  if (request.method !== "POST") { response.status(405).json({ error: "Method not allowed." }); return; }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) { response.status(500).json({ error: "GROQ_API_KEY is not configured." }); return; }

  const prompt = sanitize(request.body?.prompt ?? "");
  const style = sanitize(request.body?.style ?? "");
  if (!prompt) { response.status(400).json({ error: "Prompt is required." }); return; }

  try {
    const groq = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 6000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildPrompt(prompt, style) },
      ],
    });

    let html = completion.choices[0]?.message.content?.trim() ?? "";
    // Strip accidental code fences the model might add
    html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    if (!html.toLowerCase().startsWith("<!doctype") && !html.toLowerCase().startsWith("<html")) {
      response.status(500).json({ error: "Model returned non-HTML content." });
      return;
    }

    response.status(200).json({ html });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "HTML generation failed." });
  }
}

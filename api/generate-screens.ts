import OpenAI from "openai";
import { sanitizeLong } from "./lib/sanitize";
import { GROQ_MODEL, SCREEN_GEN_MAX_TOKENS } from "../shared/constants";

export const config = { api: { bodyParser: true } };

interface DesignContextPayload {
  components?: Array<{ name?: string; componentName?: string }>;
  docs?: Array<{ content: string }>;
  prompt?: string;
  bootstrapSuggestions?: string[];
  selectedTemplateId?: string | null;
  layoutPattern?: unknown;
}

interface GenerateScreensBody {
  context?: DesignContextPayload;
  selectedTemplateLabel?: string;
}

interface VercelRequest {
  method?: string;
  body?: GenerateScreensBody;
}

interface VercelResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  end: () => void;
}

import { getAllowedOrigin, setCorsHeaders } from "./lib/cors";

const systemPrompt =
  "You are a senior UI/UX architect creating DESIGN.md specifications for the latest AI coding agents (Claude Code, Cursor, Windsurf, Copilot). Output ONLY structured markdown — no preamble, no explanation. Be exhaustive: every screen must include component variants with props, CSS custom-property token names, responsive rules, accessibility requirements (ARIA roles, keyboard nav, WCAG 2.1 AA), interaction states (hover/focus/disabled/loading/error/empty), and motion tokens. Use a strict 8px spacing scale. Include dark-mode token variants where relevant.";

function setCors(response: VercelResponse): void {
  setCorsHeaders(response, getAllowedOrigin({ headers: {} }));
}

function buildGenerationPrompt(context: DesignContextPayload, selectedTemplateLabel: string): string {
  const components = (context.components ?? [])
    .map((c) => c.componentName || c.name)
    .filter(Boolean)
    .join(", ");
  const docs = sanitizeLong((context.docs ?? []).map((d) => d.content).join("\n")).slice(0, 2000);

  return `Generate a complete DESIGN.md specification for a ${selectedTemplateLabel} project.

Project context:
- Prompt: ${sanitizeLong(context.prompt ?? "")}
- Available components: ${components || "None (use bootstrap suggestions)"}
- Template: ${selectedTemplateLabel}
- Bootstrap suggestions: ${(context.bootstrapSuggestions ?? []).join(", ")}
- Layout pattern detected: ${JSON.stringify(context.layoutPattern ?? null)}
- BA documentation summary: ${docs}

Generate specifications for exactly these 5 screens:
1. Login / Onboarding
2. Main Dashboard
3. Detail / Item View
4. Form / Create / Edit
5. Settings / Profile

For EACH screen use this EXACT structure (all sections required):

## Screen: [Screen Name]

### Purpose
[1 sentence describing the user goal]

### Layout
- Grid: [columns, e.g. 12-col or sidebar+main]
- Nav: [top | left | none]
- Breakpoints: mobile 375px | tablet 768px | desktop 1280px
- Key regions: [header, sidebar, content, footer — list with flex/grid rule]

### Components
| Component | Variant | Props | State |
|-----------|---------|-------|-------|
[rows — include hover/focus/disabled/loading/error/empty states per component]

### Typography
| Role | Token | Size / Weight / Line-height |
|------|-------|-----------------------------|
[heading, body, label, caption, code — at minimum]

### Color tokens
| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
[--color-* tokens — min 6 rows covering surface, primary, text, border, error, success]

### Spacing
- Base: 8px scale (4 / 8 / 12 / 16 / 24 / 32 / 48 / 64)
- [2-3 specific spacing rules for this screen]

### Motion
- Enter: [animation token, e.g. fade-up 200ms ease-out]
- Exit: [animation token]
- Micro: [hover/focus transition duration]

### Accessibility
- ARIA roles: [list key landmarks and widget roles]
- Keyboard: [Tab order, Enter/Space actions, Escape behavior]
- WCAG 2.1 AA: [contrast ratios, focus indicators, screen reader labels]

### Interactions
[bullet list of user flows, success/error/empty states, and edge cases]`;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  setCors(response);

  if (request.method === "OPTIONS") { response.status(200).end(); return; }
  if (request.method !== "POST") { response.status(405).json({ error: "Method not allowed." }); return; }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) { response.status(500).json({ error: "GROQ_API_KEY is not configured." }); return; }

  try {
    const context = request.body?.context ?? {};
    const selectedTemplateLabel = sanitizeLong(
      request.body?.selectedTemplateLabel ?? context.selectedTemplateId ?? "Unselected"
    );

    const groq = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: SCREEN_GEN_MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildGenerationPrompt(context, selectedTemplateLabel) },
      ],
    });

    response.status(200).json({ markdown: completion.choices[0]?.message.content ?? "" });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "Screen generation failed." });
  }
}

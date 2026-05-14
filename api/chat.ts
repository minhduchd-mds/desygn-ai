import { createGroq } from "@ai-sdk/groq";
import { generateText, type CoreMessage } from "ai";

export const config = { runtime: "edge", maxDuration: 30 };

interface ChatContextPayload {
  projectName?: string;
  category?: string;
  selectedTemplate?: string;
  readinessScore?: number | null;
  activeDesignMd?: boolean;
  workspaceTab?: "chat" | "code";
  model?: string;
}

interface ChatBody {
  messages?: Array<{ role?: string; content?: string; title?: string }>;
  context?: ChatContextPayload;
}

const ALLOWED_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
];

const CHAT_SYSTEM = `You are a friendly, knowledgeable AI assistant powered by Groq.

Guidelines:
- Respond naturally in the same language the user writes in (Vietnamese, English, etc.)
- Be conversational and direct — skip preambles like "Sure!" or "Great question!"
- Use markdown formatting: **bold** for emphasis, \`code\` for inline code, fenced code blocks with language tags for code snippets, bullet lists for structured info
- For code questions, include working examples with correct syntax highlighting
- When explaining concepts, use clear language and analogies
- If you are unsure about something, say so honestly
- Keep responses focused and practical`;

const CODE_SYSTEM = `You are an expert UI/UX design and frontend development assistant inside a Design.md workspace.

Guidelines:
- Help with component architecture, design tokens, responsive layout, accessibility, and implementation strategy
- Respond in the same language the user writes in
- When workspace context is available (project name, template, readiness score), use it to give grounded, project-specific answers
- Use markdown formatting with proper code blocks (tsx, css, json, etc.)
- Be specific — reference actual component names, token values, and breakpoints when possible
- Suggest best practices from modern design systems (shadcn/ui, Radix, Tailwind conventions)`;

function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[^\x20-\x7E\n\r\tÀ-ɏĀ-ɏḀ-ỿ　-鿿가-힯]/g, "")
    .trim()
    .slice(0, 8000);
}

function buildSystemPrompt(context: ChatContextPayload | undefined): string {
  const base = context?.workspaceTab === "code" ? CODE_SYSTEM : CHAT_SYSTEM;

  if (!context || context.workspaceTab !== "code") return base;

  const lines = [
    `Project: ${sanitize(context.projectName ?? "Untitled")}`,
    `Category: ${sanitize(context.category ?? "Unknown")}`,
    `Template: ${sanitize(context.selectedTemplate ?? "Unselected")}`,
    `Readiness: ${typeof context.readinessScore === "number" ? `${context.readinessScore}/100` : "Not validated"}`,
    `Design context active: ${context.activeDesignMd ? "yes" : "no"}`,
  ];
  return `${base}\n\nWorkspace context:\n${lines.join("\n")}`;
}

function normalizeMessages(raw: ChatBody["messages"]): CoreMessage[] {
  return (raw ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: sanitize([m.title, m.content].filter(Boolean).join("\n")),
    }))
    .filter((m) => m.content)
    .slice(-20);
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: corsHeaders });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GROQ_API_KEY not configured." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON." }), { status: 400, headers: corsHeaders });
  }

  const messages = normalizeMessages(body.messages);
  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    return new Response(JSON.stringify({ error: "A user message is required." }), { status: 400, headers: corsHeaders });
  }

  const context = body.context;
  const requestedModel = context?.model ?? "llama-3.3-70b-versatile";
  const modelId = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : "llama-3.3-70b-versatile";

  try {
    const groq = createGroq({ apiKey });

    const { text } = await generateText({
      model: groq(modelId),
      system: buildSystemPrompt(context),
      messages,
      maxTokens: 8192,
      temperature: 0.7,
    });

    return new Response(JSON.stringify({ message: text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Chat request failed." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

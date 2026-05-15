import type { ModelMessage } from "ai";

export interface ChatContextPayload {
  projectName?: string;
  category?: string;
  selectedTemplate?: string;
  readinessScore?: number | null;
  activeDesignMd?: boolean;
  workspaceTab?: "chat" | "code";
  model?: string;
}

export interface ChatBody {
  messages?: Array<{ role?: string; content?: string; title?: string }>;
  context?: ChatContextPayload;
}

export const ALLOWED_MODELS = [
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

export function buildSystemPrompt(context: ChatContextPayload | undefined): string {
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

export function normalizeMessages(raw: ChatBody["messages"]): ModelMessage[] {
  return (raw ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: sanitize([m.title, m.content].filter(Boolean).join("\n")),
    }))
    .filter((m) => m.content)
    .slice(-20);
}

import { buildCorsHeaders } from "./cors";

/** @deprecated Use buildCorsHeaders(req) for origin-restricted CORS */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function resolveModel(context: ChatContextPayload | undefined): string {
  const requestedModel = context?.model ?? "llama-3.3-70b-versatile";
  return ALLOWED_MODELS.includes(requestedModel) ? requestedModel : "llama-3.3-70b-versatile";
}

export function handlePreflight(req: Request): Response | null {
  const headers = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers });
  }
  return null;
}

export function errorResponse(message: string, status: number, req?: Request): Response {
  const headers = req ? buildCorsHeaders(req) : corsHeaders;
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export { buildCorsHeaders };

export async function parseBody(req: Request): Promise<ChatBody> {
  return (await req.json()) as ChatBody;
}

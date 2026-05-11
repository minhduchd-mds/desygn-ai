import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AccountPlan, AppView, AuthMode, ChatMessage, OpenDesignDefinition, OpenDesignPreset, ProjectHistoryItem, ProjectRequest, SessionUser, UserRecord } from "./app/types";
import { buildDesignMd, buildPreviewText, inferProjectName, parseDesignMd } from "./design/designParser";
import { DESIGN_MD_TEMPLATES, hasDesignMdTemplate, loadDesignMdTemplate, type DesignMdTemplateCategory } from "./design/templateRegistry";
import { ChatComposer } from "./workspace/ChatComposer";
import { buildMarkdownPrompt, readMarkdownFiles } from "./workspace/fileImport";
import { fileToDataUrl, generateCodeFromScreenshot, getScreenshotToCodeWsUrl } from "./workspace/screenshotToCode";
import "./styles.css";

type PreviewMode = "prompt" | "preview" | "edit";
type PreviewTheme = "light" | "dark";
type TemplatePriorityFilter = "All" | "Product" | "Technical";
type TemplateCategoryFilter = "All" | DesignMdTemplateCategory;

const USER_STORE_KEY = "ai-design-agent.users.v1";
const SESSION_STORE_KEY = "ai-design-agent.session.v1";
const AUTH_ATTEMPT_PREFIX = "ai-design-agent.auth-attempt.v1";
const PROJECT_HISTORY_KEY = "ai-design-agent.project-history.v1";
const CHAT_HISTORY_PREFIX = "ai-design-agent.chat-history.v1";
const DESIGN_MD_EDIT_PREFIX = "design-md-ai.design-md-edit.v1";
const CHAT_HISTORY_LIMIT = 40;
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_LOCK_MS = 1000 * 60 * 15;
const PRODUCT_NAME = "Design-md-ai";
const REPOSITORY_URL = "https://github.com/minhduchd-mds/Design-md-ai";
const CUSTOM_USAGE_TEXT = "Download DESIGN.md, then place it at ./DESIGN.md";
const TEMPLATE_PRIORITY_FILTERS: TemplatePriorityFilter[] = ["All", "Product", "Technical"];
const TEMPLATE_CATEGORY_FILTERS: TemplateCategoryFilter[] = [
  "All",
  "AI",
  "Developer",
  "Workspace",
  "Product",
  "Commerce",
  "Finance",
  "Automotive",
  "Media",
];
const INITIAL_ASSISTANT_MESSAGE = "Paste a product request, upload Design.md files, or import screenshots to create AI-ready Design.md context for coding agents.";
const DEFAULT_PROJECT: ProjectRequest = {
  projectName: "Design-md-ai Project",
  category: "SaaS",
  style: "Modern product UI",
  openDesign: "openai",
  layout: "Design.md handoff workspace",
  target: "Codex + React",
  prompt: "Create a Design.md handoff for a Figma-backed SaaS dashboard with components, tokens, responsive rules, and implementation guidance.",
};

const BASE_OPEN_DESIGN_PRESETS: Record<OpenDesignPreset, OpenDesignDefinition> = {
  openai: {
    label: "OpenAI workspace",
    direction: "Calm AI workspace, readable long-form answers, low distraction, clear safety and action states.",
    palette: ["#F7F7F4", "#FFFFFF", "#202123", "#10A37F", "#D9EDE7"],
    typography: "Humanist sans, normal body weight, generous line-height, compact headings.",
    components: ["Prompt composer", "Conversation thread", "Model picker", "Response actions", "Safety notice"],
    layout: ["Centered chat column", "Persistent sidebar", "Sticky composer", "Readable output width"],
    elevation: "Flat surfaces with subtle borders; shadows only for floating composer or modal.",
    tokens: ["soft neutral surfaces", "single blue accent", "readable text scale", "subtle dividers"],
    rules: ["Prioritize prompt clarity and output review.", "Keep model, context, and result state visible."],
    donts: ["Do not overuse heavy gradients.", "Do not hide generation state."],
  },
  linear: {
    label: "Linear productivity",
    direction: "Dense product interface with precise rows, fast scanning, and minimal decorative chrome.",
    palette: ["#0F1014", "#17181D", "#F4F4F5", "#5E6AD2", "#2E3038"],
    typography: "Compact sans, medium labels, small dense metadata, no oversized marketing type inside tools.",
    components: ["Issue row", "Command menu", "Status badge", "Sidebar", "Activity feed"],
    layout: ["Two-panel workspace", "Dense list rows", "Keyboard-first command area", "Minimal chrome"],
    elevation: "Mostly flat dark surfaces with crisp dividers and small focus rings.",
    tokens: ["compact spacing", "crisp borders", "muted controls", "focused accent"],
    rules: ["Use tables/lists when users compare work.", "Keep actions close to their objects."],
    donts: ["Do not use card-heavy dashboards.", "Do not make controls visually loud."],
  },
  figma: {
    label: "Figma tool UI",
    direction: "Canvas-first tooling with selection state, compact inspectors, and reusable component thinking.",
    palette: ["#FFFFFF", "#F5F5F5", "#1E1E1E", "#0D99FF", "#E6F4FF"],
    typography: "Small utility text, clear labels, compact property controls, no decorative display fonts.",
    components: ["Toolbar", "Layer row", "Properties panel", "Canvas frame", "Inspector control"],
    layout: ["Canvas center", "Left layers", "Right inspector", "Top toolbar", "Selection-aware panels"],
    elevation: "Tool panels use borders and surface contrast; avoid deep shadows.",
    tokens: ["canvas surface", "selection blue", "tool panel neutral", "small control radius"],
    rules: ["Make state inspectable.", "Prefer compact controls and visible object hierarchy."],
    donts: ["Do not obscure the canvas.", "Do not mix marketing sections into the work surface."],
  },
  stripe: {
    label: "Stripe SaaS",
    direction: "Trustworthy business UI with exact forms, polished docs, and clear upgrade/payment flows.",
    palette: ["#FFFFFF", "#F6F9FC", "#0A2540", "#635BFF", "#00D4FF"],
    typography: "Clean SaaS type with precise labels, readable tables, and confident but not heavy headings.",
    components: ["Payment form", "Pricing table", "Metric card", "Docs sidebar", "Validation alert"],
    layout: ["Docs plus content split", "Precise form groups", "Business dashboard grid", "Billing summary"],
    elevation: "Soft business elevation with thin borders and careful shadows.",
    tokens: ["trust blue", "validation colors", "precise form spacing", "docs surface"],
    rules: ["Complete validation and error states.", "Keep plan and billing language unambiguous."],
    donts: ["Do not make pricing vague.", "Do not rely on color alone for validation."],
  },
  github: {
    label: "GitHub developer",
    direction: "Developer workflow UI with audit trails, status badges, readable code blocks, and durable navigation.",
    palette: ["#FFFFFF", "#F6F8FA", "#24292F", "#0969DA", "#2DA44E"],
    typography: "System sans with monospace for code/output, compact metadata, clear status labels.",
    components: ["Repo nav", "Issue list", "Diff block", "Status check", "Code output"],
    layout: ["Tabbed resource navigation", "List-detail views", "Code preview panels", "Audit trail feed"],
    elevation: "Border-led surfaces with minimal shadows and strong readable dividers.",
    tokens: ["bordered surfaces", "status colors", "monospace output", "compact tabs"],
    rules: ["Represent status with text plus color.", "Make generated files easy to inspect."],
    donts: ["Do not blur code/output.", "Do not hide status behind icons only."],
  },
  vercel: {
    label: "Vercel launch",
    direction: "Sharp deployment product UI with high contrast, clear build status, and polished product launches.",
    palette: ["#FFFFFF", "#FAFAFA", "#000000", "#0070F3", "#EAEAEA"],
    typography: "Geometric sans, restrained headings, crisp labels, high contrast text.",
    components: ["Deployment card", "Build log", "Environment picker", "Project nav", "Launch CTA"],
    layout: ["Clean hero", "Project dashboard", "Status timeline", "Docs-adjacent panels"],
    elevation: "Flat white surfaces, exact borders, occasional focused shadow for dialogs.",
    tokens: ["black and white base", "deployment blue", "thin borders", "precise spacing"],
    rules: ["Expose build status clearly.", "Keep generated project artifacts easy to deploy."],
    donts: ["Do not use noisy backgrounds.", "Do not bury deployment configuration."],
  },
  cursor: {
    label: "Cursor code agent",
    direction: "Code-first AI workspace with editor ergonomics, split panes, terminal output, and agent steps.",
    palette: ["#0B0F19", "#111827", "#E5E7EB", "#8B5CF6", "#22C55E"],
    typography: "Readable sans plus monospace output, compact panels, clear active file labels.",
    components: ["File tree", "Agent step list", "Diff preview", "Terminal", "Command palette"],
    layout: ["Editor split view", "Left file rail", "Right assistant panel", "Bottom terminal"],
    elevation: "Dark panels separated by borders, active focus ring, no decorative shadows.",
    tokens: ["editor surface", "agent purple", "success green", "monospace output"],
    rules: ["Show what the AI changed.", "Keep prompt, files, and output in the same workflow."],
    donts: ["Do not make code hard to scan.", "Do not hide long-running task status."],
  },
  notion: {
    label: "Notion document",
    direction: "Document-product hybrid with calm blocks, low chrome, and flexible page structure.",
    palette: ["#FFFFFF", "#F7F6F3", "#2F3437", "#2383E2", "#E9E5DD"],
    typography: "Soft document type, natural reading rhythm, lighter headings, block-level controls.",
    components: ["Page sidebar", "Block editor", "Database table", "Property pill", "Template gallery"],
    layout: ["Document canvas", "Block sections", "Database views", "Low-chrome sidebar"],
    elevation: "Very light surface grouping; hierarchy from spacing and typography.",
    tokens: ["paper surface", "muted labels", "block spacing", "subtle hover"],
    rules: ["Let content hierarchy carry the design.", "Keep generated docs editable and scannable."],
    donts: ["Do not over-frame blocks.", "Do not use heavy dashboard styling."],
  },
  apple: {
    label: "Apple product",
    direction: "Premium consumer presentation with high-quality imagery, generous spacing, and refined controls.",
    palette: ["#FFFFFF", "#F5F5F7", "#1D1D1F", "#0071E3", "#86868B"],
    typography: "Refined sans, lighter display headings, spacious paragraphs, minimal control labels.",
    components: ["Product hero", "Feature tile", "Gallery", "Comparison table", "Sticky action bar"],
    layout: ["Immersive hero", "Editorial sections", "Product comparison", "Image-led feature bands"],
    elevation: "Minimal chrome; use imagery and whitespace over card shadows.",
    tokens: ["premium neutrals", "image-first sections", "spacious rhythm", "blue CTA"],
    rules: ["Use product visuals as first-viewport signal.", "Keep copy concise and premium."],
    donts: ["Do not use generic stock-like visuals.", "Do not turn dense tools into oversized hero pages."],
  },
  voltagent: {
    label: "VoltAgent agent",
    direction: "Agent-building interface with clear orchestration, workflow status, and practical developer surfaces.",
    palette: ["#0F172A", "#111827", "#F8FAFC", "#14B8A6", "#F59E0B"],
    typography: "Modern developer SaaS typography with normal body weight and clear step labels.",
    components: ["Agent card", "Workflow timeline", "Tool call log", "Capability matrix", "Status badge"],
    layout: ["Agent overview", "Workflow builder", "Logs and traces", "Integration panels"],
    elevation: "Layered dark-ready panels with subtle teal focus and readable status colors.",
    tokens: ["agent teal", "trace amber", "dark panels", "workflow dividers"],
    rules: ["Make agent state and tool results visible.", "Show orchestration steps before final output."],
    donts: ["Do not hide reasoning artifacts that users need for debugging.", "Do not over-animate workflow state."],
  },
  material: {
    label: "Material system",
    direction: "Systematic cross-platform UI with explicit states, accessible controls, and responsive patterns.",
    palette: ["#FFFFFF", "#F8FAFC", "#1F2937", "#6750A4", "#EADDFF"],
    typography: "Clear type scale, normal body weight, explicit labels, accessible contrast.",
    components: ["Button", "Text field", "Navigation rail", "Dialog", "Data table"],
    layout: ["Responsive grid", "Navigation rail", "Top app bar", "Stateful forms"],
    elevation: "Use state layers and subtle elevation only where interaction needs hierarchy.",
    tokens: ["semantic roles", "state layers", "responsive breakpoints", "accessible focus"],
    rules: ["Include hover, focus, pressed, selected, disabled, loading, and error states.", "Use semantic roles before raw colors."],
    donts: ["Do not skip accessibility states.", "Do not use elevation as decoration."],
  },
  shopify: {
    label: "Shopify commerce",
    direction: "Merchant operations UI with clear product data, inventory flows, and trustworthy commerce actions.",
    palette: ["#FFFFFF", "#F6F6F7", "#202223", "#008060", "#E3F1DF"],
    typography: "Operational sans, readable product data, restrained headings, clear form labels.",
    components: ["Product table", "Inventory status", "Order summary", "Checkout action", "Merchant alert"],
    layout: ["Admin table", "Product detail", "Order workflow", "Settings panels"],
    elevation: "Quiet cards and tables with strong information hierarchy.",
    tokens: ["commerce green", "admin neutrals", "status colors", "table density"],
    rules: ["Make money, inventory, and customer state explicit.", "Use confirmation for irreversible actions."],
    donts: ["Do not obscure prices or plan limits.", "Do not use decorative commerce graphics inside admin flows."],
  },
};

const OPEN_DESIGN_PRESETS_META: Record<OpenDesignPreset, OpenDesignDefinition> = {
  ...BASE_OPEN_DESIGN_PRESETS,
  ...Object.fromEntries(
    DESIGN_MD_TEMPLATES.map((template) => [
      template.id,
      {
        ...BASE_OPEN_DESIGN_PRESETS.figma,
        label: template.label,
      } satisfies OpenDesignDefinition,
    ]),
  ),
};

function getOpenDesignPreset(
  id: OpenDesignPreset,
  loadedTemplates: Record<string, OpenDesignDefinition> = {},
): OpenDesignDefinition {
  return loadedTemplates[id] ?? OPEN_DESIGN_PRESETS_META[id] ?? OPEN_DESIGN_PRESETS_META.openai;
}

const COMPETITOR_BENCHMARKS = [
  { name: "ChatGPT", focus: "General AI chat", gap: "Weak design-system export discipline", score: 82 },
  { name: "Figma Make", focus: "Editable design generation", gap: "Needs stricter product rules and code handoff", score: 78 },
  { name: "v0", focus: "Fast UI generation", gap: "Can drift from local Figma tokens", score: 76 },
  { name: "Framer AI", focus: "Marketing websites", gap: "Less suited for app/workflow specs", score: 72 },
  { name: "Cursor", focus: "Code implementation", gap: "Needs curated Design.md context", score: 80 },
];

const PROJECT_HISTORY = [
  { name: "Modern SaaS Landing Page", date: "07/05/2024, 09:45 AM", prompt: "Create a modern SaaS landing page with login, dashboard, and Pro upgrade page.", category: "SaaS", openDesign: "openai" as const, target: "React + Vite" },
  { name: "AI Chat Dashboard", date: "08/05/2024, 09:45 AM", prompt: "Create an AI chat dashboard with sidebar, billing, prompt composer, and preview output.", category: "AI tool", openDesign: "openai" as const, target: "React + Vite" },
  { name: "E-commerce Website", date: "09/05/2024, 11:15 AM", prompt: "Create an e-commerce website with product page, cart, checkout, and admin view.", category: "E-commerce", openDesign: "shopify" as const, target: "React + Vite" },
];

const LANDING_FEATURES = [
  ["Figma context first", "Use component names, variables, layout intent, and imported Design.md files before asking an AI agent to write code."],
  ["Design.md handoff", "Package screens, tokens, component rules, responsive behavior, and implementation guardrails into one readable spec."],
  ["Agent-ready output", "Prepare context for Codex, Claude Code, Cursor, Windsurf, and Figma Make instead of sending a vague prompt."],
];

const LANDING_SERVICES = [
  ["Design.md", "Create product context, page structure, component usage, tokens, and design rules."],
  ["Figma scan", "Read components, variables, pages, and design-system metadata from the plugin workflow."],
  ["Prompt export", "Turn the design system into compact prompts for implementation agents."],
  ["Template mapping", "Map components into dashboard, admin table, settings, landing, mobile, AI workspace, or console layouts."],
  ["Frame export", "Create a Figma frame that summarizes the selected project layout and mapped components."],
  ["Review checklist", "Expose token coverage, responsive behavior, accessibility, and handoff gaps before coding."],
];

const LANDING_SHOWCASE = [
  ["Figma Components", "Scan"],
  ["Design Tokens", "Map"],
  ["Design.md Folder", "Export"],
  ["Agent Prompt", "Handoff"],
];

const HOW_IT_WORKS = [
  ["Import design context", "Start from a Figma file, selected component, uploaded Design.md, or ZIP of markdown specs."],
  ["Generate Design.md", "Normalize project context, component rules, tokens, responsive behavior, and target-agent instructions."],
  ["Hand off to coding agents", "Copy or export the result for Codex, Claude Code, Cursor, Windsurf, or Figma Make."],
];

const CODE_LINES = [
  "# Design-md-ai",
  "## Handoff Overview",
  "- Source: Figma components + tokens",
  "- Target: Codex / Claude Code / Cursor",
  "- Output: Design.md + agent prompt",
  "",
  "## Guardrails",
  "- Preserve design tokens",
  "- Map variants to props",
  "- Verify responsive states",
];

const encoder = new TextEncoder();

interface AuthAttemptRecord {
  count: number;
  lockedUntil: number;
}

interface MarkdownSection {
  id: string;
  title: string;
  content: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let value = "";
  bytes.forEach((byte) => {
    value += String.fromCharCode(byte);
  });
  return btoa(value);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function validatePasswordStrength(password: string) {
  if (password.length < 12) throw new Error("Password must be at least 12 characters.");
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error("Password must include uppercase, lowercase, number, and special characters.");
  }
}

function timingSafeEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let diff = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return diff === 0;
}

function getAuthAttemptKey(emailHash: string) {
  return `${AUTH_ATTEMPT_PREFIX}.${emailHash}`;
}

function getAuthAttempt(emailHash: string): AuthAttemptRecord {
  try {
    return JSON.parse(localStorage.getItem(getAuthAttemptKey(emailHash)) ?? "null") as AuthAttemptRecord | null ?? { count: 0, lockedUntil: 0 };
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function assertAuthNotLocked(emailHash: string) {
  const attempt = getAuthAttempt(emailHash);
  if (attempt.lockedUntil > Date.now()) {
    const minutes = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
    throw new Error(`This account is temporarily locked. Try again in ${minutes} minutes.`);
  }
}

function recordFailedAuthAttempt(emailHash: string) {
  const attempt = getAuthAttempt(emailHash);
  const count = attempt.lockedUntil > Date.now() ? attempt.count : attempt.count + 1;
  const lockedUntil = count >= MAX_AUTH_ATTEMPTS ? Date.now() + AUTH_LOCK_MS : 0;
  localStorage.setItem(getAuthAttemptKey(emailHash), JSON.stringify({ count, lockedUntil }));
}

function clearAuthAttempt(emailHash: string) {
  localStorage.removeItem(getAuthAttemptKey(emailHash));
}

async function deriveKey(password: string, salt: Uint8Array, usages: KeyUsage[]) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: 310000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: 310000,
      hash: "SHA-256",
    },
    material,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function hashEmail(email: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`ai-design-agent.email.v1:${email.trim().toLowerCase()}`));
  return bytesToBase64(new Uint8Array(digest));
}

async function encryptProfile(password: string, salt: Uint8Array, data: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ["encrypt"]);
  const payload = encoder.encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipher))}`;
}

async function decryptProfile<T>(password: string, salt: Uint8Array, payload: string): Promise<T> {
  const [ivValue, cipherValue] = payload.split(".");
  if (!ivValue || !cipherValue) throw new Error("Invalid encrypted data.");
  const key = await deriveKey(password, salt, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(base64ToBytes(ivValue)) }, key, toArrayBuffer(base64ToBytes(cipherValue)));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

function getUsers(): UserRecord[] {
  try {
    return JSON.parse(localStorage.getItem(USER_STORE_KEY) ?? "[]") as UserRecord[];
  } catch {
    return [];
  }
}

function saveUsers(users: UserRecord[]) {
  localStorage.setItem(USER_STORE_KEY, JSON.stringify(users));
}

async function register(email: string, password: string): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("A valid email is required.");
  validatePasswordStrength(password);
  const users = getUsers();
  const emailHash = await hashEmail(normalized);
  if (users.some((user) => user.emailHash === emailHash || user.email === normalized)) throw new Error("This account already exists.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const record: UserRecord = {
    emailHash,
    encryptedEmail: await encryptProfile(password, salt, normalized),
    salt: bytesToBase64(salt),
    verifier: await hashPassword(password, salt),
    encryptedProfile: await encryptProfile(password, salt, { email: normalized, projects: [], plan: "free" }),
    plan: "free",
    createdAt: new Date().toISOString(),
  };
  saveUsers([...users, record]);
  clearAuthAttempt(emailHash);
  return { emailHash, displayEmail: normalized, plan: "free", expiresAt: Date.now() + SESSION_TTL_MS };
}

async function login(email: string, password: string): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  const emailHash = await hashEmail(normalized);
  assertAuthNotLocked(emailHash);
  const users = getUsers();
  const record = users.find((user) => user.emailHash === emailHash || user.email === normalized);
  if (!record) {
    recordFailedAuthAttempt(emailHash);
    throw new Error("Email or password is incorrect.");
  }
  const verifier = await hashPassword(password, base64ToBytes(record.salt));
  if (!timingSafeEqual(verifier, record.verifier)) {
    recordFailedAuthAttempt(emailHash);
    throw new Error("Email or password is incorrect.");
  }
  clearAuthAttempt(emailHash);
  const salt = base64ToBytes(record.salt);
  let displayEmail = normalized;
  if (record.encryptedEmail) {
    try {
      displayEmail = await decryptProfile<string>(password, salt, record.encryptedEmail);
    } catch {
      displayEmail = record.email ?? normalized;
    }
  }
  if (!record.emailHash || !record.encryptedEmail || record.email) {
    const encryptedEmail = record.encryptedEmail || await encryptProfile(password, salt, displayEmail);
    saveUsers(users.map((user) => (
      user === record
        ? {
            ...user,
            email: undefined,
            emailHash,
            encryptedEmail,
          }
        : user
    )));
  }
  return { emailHash, displayEmail, plan: record.plan, expiresAt: Date.now() + SESSION_TTL_MS };
}

function updatePlan(emailHash: string, plan: AccountPlan) {
  saveUsers(getUsers().map((user) => (user.emailHash === emailHash ? { ...user, plan } : user)));
}

function getSessionUser(): SessionUser | null {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_STORE_KEY) ?? "null") as (SessionUser & { email?: string }) | null;
    if (!session?.emailHash) return null;
    if (!session.expiresAt || session.expiresAt <= Date.now()) {
      clearSessionUser();
      return null;
    }
    const record = getUsers().find((user) => user.emailHash === session.emailHash);
    return record
      ? {
          emailHash: record.emailHash ?? session.emailHash,
          displayEmail: session.displayEmail || "Encrypted account",
          plan: record.plan,
          expiresAt: session.expiresAt,
        }
      : null;
  } catch {
    return null;
  }
}

function saveSessionUser(user: SessionUser) {
  localStorage.setItem(SESSION_STORE_KEY, JSON.stringify({ ...user, expiresAt: Date.now() + SESSION_TTL_MS }));
}

function clearSessionUser() {
  localStorage.removeItem(SESSION_STORE_KEY);
}

function getProjectHistory(): ProjectHistoryItem[] {
  try {
    const items = JSON.parse(localStorage.getItem(PROJECT_HISTORY_KEY) ?? "null") as ProjectHistoryItem[] | null;
    return items?.length ? items : PROJECT_HISTORY;
  } catch {
    return PROJECT_HISTORY;
  }
}

function saveProjectHistory(items: ProjectHistoryItem[]) {
  localStorage.setItem(PROJECT_HISTORY_KEY, JSON.stringify(items.slice(0, 12)));
}

function getChatHistoryKey(emailHash: string) {
  return `${CHAT_HISTORY_PREFIX}.${emailHash}`;
}

async function encryptChatMessages(emailHash: string, messages: ChatMessage[]): Promise<string> {
  const salt = encoder.encode(`chat:${emailHash}:v1`);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(emailHash, salt, ["encrypt"]);
  const payload = encoder.encode(JSON.stringify(messages.slice(-CHAT_HISTORY_LIMIT)));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipher))}`;
}

async function decryptChatMessages(emailHash: string, payload: string): Promise<ChatMessage[]> {
  const [ivValue, cipherValue] = payload.split(".");
  if (!ivValue || !cipherValue) return [];
  const salt = encoder.encode(`chat:${emailHash}:v1`);
  const key = await deriveKey(emailHash, salt, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(base64ToBytes(ivValue)) }, key, toArrayBuffer(base64ToBytes(cipherValue)));
  return JSON.parse(new TextDecoder().decode(plain)) as ChatMessage[];
}

function createMessage(role: ChatMessage["role"], content: string, title?: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    title,
    content,
  };
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return Math.abs(hash).toString(36);
}

function getDesignMdEditKey(request: ProjectRequest): string {
  return `${DESIGN_MD_EDIT_PREFIX}.${stableHash([
    request.projectName,
    request.category,
    request.openDesign,
    request.target,
    request.prompt,
  ].join("|"))}`;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
}

function templateCommandSlug(value: string): string {
  const slug = slugify(value);
  return slug && slug !== "template" ? slug : "custom";
}

function getDesignMdUsageCommand(openDesign: string): string {
  if (!hasDesignMdTemplate(openDesign)) return CUSTOM_USAGE_TEXT;
  return `npx getdesign@latest add ${templateCommandSlug(openDesign)}`;
}

function parseMarkdownSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split(/\r?\n/);
  const sections: MarkdownSection[] = [];
  let currentTitle = "Overview";
  let currentLines: string[] = [];

  const pushSection = () => {
    const content = currentLines.join("\n").trim();
    if (!content && sections.length > 0) return;
    const baseId = slugify(currentTitle);
    const duplicateCount = sections.filter((section) => section.id === baseId || section.id.startsWith(`${baseId}-`)).length;
    sections.push({
      id: duplicateCount ? `${baseId}-${duplicateCount + 1}` : baseId,
      title: currentTitle,
      content,
    });
  };

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      pushSection();
      currentTitle = heading[1].replace(/[#*_`]/g, "").trim();
      currentLines = [];
    } else if (/^#\s+/.test(line) && sections.length === 0 && currentLines.length === 0) {
      currentLines.push(line.replace(/^#\s+/, ""));
    } else {
      currentLines.push(line);
    }
  }
  pushSection();

  return sections.filter((section) => section.content || section.title);
}

function markdownPreviewBlocks(content: string) {
  const blocks: Array<{ type: "heading" | "list" | "code" | "paragraph"; text?: string; items?: string[] }> = [];
  const lines = content.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", text: codeLines.join("\n") });
      index += 1;
      continue;
    }

    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      blocks.push({ type: "heading", text: heading[1] });
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```/.test(lines[index]) &&
      !/^###\s+/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function MarkdownSectionContent({ content }: { content: string }) {
  return (
    <>
      {markdownPreviewBlocks(content).map((block, index) => {
        if (block.type === "heading") return <h4 key={index}>{block.text}</h4>;
        if (block.type === "code") return <pre key={index}>{block.text}</pre>;
        if (block.type === "list") {
          return (
            <ul key={index}>
              {block.items?.map((item) => <li key={item}>{item}</li>)}
            </ul>
          );
        }
        return <p key={index}>{block.text}</p>;
      })}
    </>
  );
}

function App() {
  const [user, setUser] = useState<SessionUser | null>(() => getSessionUser());
  const [view, setView] = useState<AppView>(() => (getSessionUser() ? "workspace" : "landing"));
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [landingTemplateQuery, setLandingTemplateQuery] = useState("");
  const [landingTemplatePriority, setLandingTemplatePriority] = useState<TemplatePriorityFilter>("All");
  const [landingTemplateCategory, setLandingTemplateCategory] = useState<TemplateCategoryFilter>("All");
  const [request, setRequest] = useState<ProjectRequest>(DEFAULT_PROJECT);
  const [generatedRequest, setGeneratedRequest] = useState<ProjectRequest | null>(null);
  const [projectHistory, setProjectHistory] = useState<ProjectHistoryItem[]>(() => getProjectHistory());
  const [activeHistoryPrompt, setActiveHistoryPrompt] = useState(() => getProjectHistory()[0]?.prompt ?? "");
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("prompt");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatHistoryReady, setChatHistoryReady] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [loadedTemplatePresets, setLoadedTemplatePresets] = useState<Record<string, OpenDesignDefinition>>({});
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>("light");
  const [savedDesignMd, setSavedDesignMd] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSavedAt, setEditSavedAt] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage("assistant", INITIAL_ASSISTANT_MESSAGE, PRODUCT_NAME),
  ]);

  const outputRequest = generatedRequest ?? request;
  const openDesignPresets = useMemo(
    () => ({ ...OPEN_DESIGN_PRESETS_META, ...loadedTemplatePresets }),
    [loadedTemplatePresets],
  );
  const generatedDesignMd = useMemo(
    () => buildDesignMd(outputRequest, user?.plan ?? "free", openDesignPresets, COMPETITOR_BENCHMARKS),
    [openDesignPresets, outputRequest, user?.plan],
  );
  const designMdEditKey = useMemo(() => getDesignMdEditKey(outputRequest), [outputRequest]);
  const designMd = savedDesignMd ?? generatedDesignMd;
  const designMdSections = useMemo(() => parseMarkdownSections(designMd), [designMd]);
  const previewNavSections = useMemo(() => designMdSections.slice(0, 8), [designMdSections]);
  const designMdStatus = savedDesignMd ? "Edited" : "Generated";
  const previewItems = useMemo(() => buildPreviewText(outputRequest, openDesignPresets), [openDesignPresets, outputRequest]);
  const selectedPreset = getOpenDesignPreset(request.openDesign, loadedTemplatePresets);
  const outputPreset = getOpenDesignPreset(outputRequest.openDesign, loadedTemplatePresets);
  const importedDesign = useMemo(() => parseDesignMd(outputRequest.prompt, outputPreset), [outputRequest.prompt, outputPreset]);
  const activeDesign = importedDesign ?? outputPreset;
  const usageCommand = importedDesign ? CUSTOM_USAGE_TEXT : getDesignMdUsageCommand(outputRequest.openDesign);
  const templatePriorityCounts = useMemo(
    () => ({
      All: DESIGN_MD_TEMPLATES.length,
      Product: DESIGN_MD_TEMPLATES.filter((template) => template.priority === "Product").length,
      Technical: DESIGN_MD_TEMPLATES.filter((template) => template.priority === "Technical").length,
    }),
    [],
  );
  const landingTemplateMatches = useMemo(() => {
    const query = landingTemplateQuery.trim().toLowerCase();
    const matches = DESIGN_MD_TEMPLATES.filter((template) => {
      const matchesQuery = !query || `${template.id} ${template.label} ${template.category} ${template.priority} ${template.keywords.join(" ")}`.toLowerCase().includes(query);
      const matchesPriority = landingTemplatePriority === "All" || template.priority === landingTemplatePriority;
      const matchesCategory = landingTemplateCategory === "All" || template.category === landingTemplateCategory;
      return matchesQuery && matchesPriority && matchesCategory;
    });
    return matches.slice(0, 18);
  }, [landingTemplateCategory, landingTemplatePriority, landingTemplateQuery]);

  useEffect(() => {
    if (!user) return;
    saveSessionUser(user);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setChatHistoryReady(false);
      return;
    }

    let cancelled = false;
    setChatHistoryReady(false);
    const encrypted = localStorage.getItem(getChatHistoryKey(user.emailHash));
    if (!encrypted) {
      setChatHistoryReady(true);
      return;
    }

    decryptChatMessages(user.emailHash, encrypted)
      .then((storedMessages) => {
        if (!cancelled && storedMessages.length > 0) {
          setMessages(storedMessages);
        }
      })
      .catch(() => {
        localStorage.removeItem(getChatHistoryKey(user.emailHash));
      })
      .finally(() => {
        if (!cancelled) setChatHistoryReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !chatHistoryReady) return;
    encryptChatMessages(user.emailHash, messages)
      .then((payload) => {
        localStorage.setItem(getChatHistoryKey(user.emailHash), payload);
      })
      .catch(() => {
        // Chat persistence is non-critical; keep UI responsive if encryption fails.
      });
  }, [chatHistoryReady, messages, user]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [hasGenerated, isGenerating, messages]);

  useEffect(() => {
    const saved = localStorage.getItem(designMdEditKey);
    setSavedDesignMd(saved);
    setEditDraft(saved ?? generatedDesignMd);
    setEditSavedAt(null);
  }, [designMdEditKey, generatedDesignMd]);

  useEffect(() => {
    const ids = [request.openDesign, outputRequest.openDesign].filter(hasDesignMdTemplate);
    if (ids.length === 0) return;

    let cancelled = false;
    ids.forEach((id) => {
      if (loadedTemplatePresets[id]) return;
      loadDesignMdTemplate(id)
        .then((template) => {
          if (!template || cancelled) return;
          const fallback = BASE_OPEN_DESIGN_PRESETS[template.id] ?? BASE_OPEN_DESIGN_PRESETS.figma;
          const parsed = parseDesignMd(template.markdown, fallback);
          setLoadedTemplatePresets((current) => ({
            ...current,
            [id]: {
              ...fallback,
              ...(parsed ?? {}),
              label: template.label,
              tokens: fallback.tokens,
              donts: parsed?.donts ?? fallback.donts,
            },
          }));
        })
        .catch(() => {
          // Template loading is non-critical; keep the lightweight fallback preset.
        });
    });

    return () => {
      cancelled = true;
    };
  }, [loadedTemplatePresets, outputRequest.openDesign, request.openDesign]);

  async function handleAuthSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAuthError("");
    try {
      const session = authMode === "login" ? await login(email, password) : await register(email, password);
      saveSessionUser(session);
      setUser(session);
      setPassword("");
      setView("workspace");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    }
  }

  function upgradeToPro() {
    if (!user) return;
    updatePlan(user.emailHash, "pro");
    const nextUser = { ...user, plan: "pro" as const };
    saveSessionUser(nextUser);
    setUser(nextUser);
  }

  function saveGeneratedProject(requestToSave: ProjectRequest) {
    const historyItem: ProjectHistoryItem = {
      name: requestToSave.projectName,
      date: new Date().toLocaleString("vi-VN"),
      prompt: requestToSave.prompt,
      category: requestToSave.category,
      openDesign: requestToSave.openDesign,
      target: requestToSave.target,
    };
    setActiveHistoryPrompt(historyItem.prompt);
    setProjectHistory((current) => {
      const nextHistory = [historyItem, ...current.filter((item) => item.prompt !== historyItem.prompt)].slice(0, 12);
      saveProjectHistory(nextHistory);
      return nextHistory;
    });
  }

  function generateProject() {
    const prompt = request.prompt.trim();
    if (!prompt) return;
    const nextRequest = {
      ...request,
      projectName: inferProjectName(prompt, request.category),
      layout: "Design.md handoff workspace",
      style: `${getOpenDesignPreset(request.openDesign, loadedTemplatePresets).label} / ${request.category}`,
      prompt,
    };
    setGeneratedRequest(nextRequest);
    saveGeneratedProject(nextRequest);
    setMessages((current) => [
      ...current,
      createMessage("user", prompt),
    ]);
    setRequest((current) => ({ ...current, projectName: nextRequest.projectName, layout: nextRequest.layout, style: nextRequest.style, prompt: "" }));
    setIsGenerating(true);
    setHasGenerated(false);
    window.setTimeout(() => {
      setHasGenerated(true);
      setIsGenerating(false);
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          `Generated Design.md context using ${parseDesignMd(nextRequest.prompt, getOpenDesignPreset(nextRequest.openDesign, loadedTemplatePresets))?.label ?? getOpenDesignPreset(nextRequest.openDesign, loadedTemplatePresets).label}. Review the Design.md output or preview below.`,
        ),
      ]);
    }, 720);
  }

  async function copyOutput() {
    const value =
      previewMode === "edit"
        ? editDraft
        : previewMode === "prompt"
          ? designMd
          : buildPreviewText(outputRequest, openDesignPresets).join("\n");
    await navigator.clipboard.writeText(value);
    setCopiedOutput(true);
    window.setTimeout(() => setCopiedOutput(false), 1400);
  }

  function downloadDesignMd() {
    const blob = new Blob([designMd], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${templateCommandSlug(outputRequest.projectName)}-DESIGN.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function scrollToPreviewSection(sectionId: string) {
    document.getElementById(`preview-section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function saveDesignMdEdit() {
    localStorage.setItem(designMdEditKey, editDraft);
    setSavedDesignMd(editDraft);
    setEditSavedAt(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
    setMessages((current) => [
      ...current,
      createMessage("assistant", "Saved the edited Design.md for this project in local storage.", "Design.md saved"),
    ]);
  }

  function resetDesignMdEdit() {
    localStorage.removeItem(designMdEditKey);
    setSavedDesignMd(null);
    setEditDraft(generatedDesignMd);
    setEditSavedAt(null);
  }

  function showComingSoon(label: string) {
    setMessages((current) => [
      ...current,
      createMessage("assistant", `${label} is on the roadmap. The current public demo focuses on Design.md generation, prompt handoff, upload, preview, and history.`, "Coming soon"),
    ]);
  }

  function logout() {
    clearSessionUser();
    setUser(null);
    setView("landing");
    setHasGenerated(false);
    setGeneratedRequest(null);
    setMessages([
      createMessage("assistant", INITIAL_ASSISTANT_MESSAGE, PRODUCT_NAME),
    ]);
    setChatHistoryReady(false);
    setActiveHistoryPrompt("");
  }

  function openHistoryProject(item: ProjectHistoryItem) {
    const nextRequest = {
      ...request,
      projectName: item.name,
      category: item.category,
      openDesign: item.openDesign,
      target: item.target,
      prompt: item.prompt,
      style: `${getOpenDesignPreset(item.openDesign, loadedTemplatePresets).label} / ${item.category}`,
    };
    setRequest((current) => ({ ...current, ...nextRequest, prompt: "" }));
    setGeneratedRequest(nextRequest);
    setHasGenerated(true);
    setIsGenerating(false);
    setPreviewMode("prompt");
    setActiveHistoryPrompt(item.prompt);
    setMessages([
      createMessage("assistant", INITIAL_ASSISTANT_MESSAGE, PRODUCT_NAME),
      createMessage("user", item.prompt),
      createMessage("assistant", `Restored ${item.name}. You can continue the session or review the generated Design.md/Preview below.`),
    ]);
  }

  function startNewProject() {
    setRequest(DEFAULT_PROJECT);
    setGeneratedRequest(null);
    setHasGenerated(false);
    setIsGenerating(false);
    setPreviewMode("prompt");
    setActiveHistoryPrompt("");
    setMessages([createMessage("assistant", INITIAL_ASSISTANT_MESSAGE, PRODUCT_NAME)]);
  }

  function openLandingAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthError("");
    window.requestAnimationFrame(() => {
      document.getElementById("login")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function openTemplateLibrary() {
    setView("landing");
    window.requestAnimationFrame(() => {
      document.getElementById("templates")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function selectLandingTemplate(templateId: string) {
    const template = DESIGN_MD_TEMPLATES.find((item) => item.id === templateId);
    setRequest((current) => ({
      ...current,
      projectName: `${template?.label ?? "Design.md"} Handoff`,
      openDesign: templateId as OpenDesignPreset,
      prompt: `Create a Design.md handoff using the ${template?.label ?? templateId} template. Include tokens, component rules, responsive behavior, accessibility notes, and implementation guidance.`,
    }));

    if (user) {
      setView("workspace");
      return;
    }

    openLandingAuth("register");
  }

  async function uploadMarkdownFiles(files: FileList) {
    const { markdownFiles, zipCount } = await readMarkdownFiles(files);

    if (markdownFiles.length === 0) {
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          zipCount > 0 ? "No .md files were found in the uploaded ZIP." : "Only .md, .markdown, .txt, or .zip files containing markdown are supported.",
          "Upload file",
        ),
      ]);
      return;
    }

    const nextPrompt = buildMarkdownPrompt(markdownFiles);
    setRequest((current) => ({ ...current, prompt: nextPrompt }));
    setGeneratedRequest(null);
    setHasGenerated(false);
    setMessages((current) => [
      ...current,
      createMessage("assistant", `Loaded ${markdownFiles.length} markdown file${markdownFiles.length > 1 ? "s" : ""}${zipCount ? ` from ${zipCount} ZIP file${zipCount > 1 ? "s" : ""}` : ""} into the prompt. Send it to generate Design.md/Preview.`, "Upload Design.md"),
    ]);
  }

  function createImageFromPrompt() {
    const backendUrl = getScreenshotToCodeWsUrl();
    setMessages((current) => [
      ...current,
      createMessage("user", "Create image"),
      createMessage(
        "assistant",
        backendUrl
          ? `Choose an image or screenshot to generate UI code. After selection, the app will show loading and send it to: ${backendUrl}.`
          : "Choose an image or screenshot to generate UI code. The screenshot-to-code backend is not configured yet, so the app will show setup guidance after selection.",
        "Screenshot-to-code",
      ),
    ]);
  }

  async function uploadScreenshot(files: FileList) {
    const image = Array.from(files).find((file) => /^image\//.test(file.type));
    if (!image) {
      setMessages((current) => [...current, createMessage("assistant", "Choose a PNG, JPG, or WEBP image file.", "Screenshot-to-code")]);
      return;
    }

    setHasGenerated(false);
    setIsGenerating(true);
    setMessages((current) => [
      ...current,
      createMessage("user", `Generate UI code from screenshot: ${image.name}`),
      createMessage("assistant", "Analyzing the image and generating UI code...", "Screenshot-to-code"),
    ]);

    try {
      const imageDataUrl = await fileToDataUrl(image);
      const result = await generateCodeFromScreenshot({ imageDataUrl, stack: "react_tailwind" });
      const prompt = `Screenshot-to-code generated React/Tailwind UI from ${image.name}.\n\n\`\`\`tsx\n${result.code}\n\`\`\``;
      const nextRequest: ProjectRequest = {
        ...request,
        projectName: inferProjectName(image.name.replace(/\.[^.]+$/, ""), "AI tool"),
        category: "AI tool",
        style: `${getOpenDesignPreset(request.openDesign, loadedTemplatePresets).label} / screenshot-to-code`,
        prompt,
      };
      setGeneratedRequest(nextRequest);
      setRequest((current) => ({ ...current, category: nextRequest.category, style: nextRequest.style, prompt: "" }));

      saveGeneratedProject(nextRequest);
      setHasGenerated(true);
      setMessages((current) => [...current, createMessage("assistant", "Generated code from the screenshot. Review it in the Design.md/Preview tabs above.", "Screenshot-to-code")]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          error instanceof Error
            ? error.message
            : "Could not generate code from the screenshot. Check the screenshot-to-code backend.",
          "Screenshot-to-code",
        ),
      ]);
    } finally {
      setIsGenerating(false);
    }
  }

  if (view === "workspace" && user) {
    return (
      <main className="workspace-shell">
        <aside className="workspace-sidebar">
          <nav className="side-nav">
            <a
              href="#new-project"
              role="button"
              onClick={(event) => {
                event.preventDefault();
                startNewProject();
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M10 2.50002C10.5523 2.50002 11 2.94774 11 3.50002C10.9999 4.05224 10.5522 4.50002 10 4.50002H5C4.72386 4.50002 4.5 4.72388 4.5 5.00002V19C4.50008 19.2761 4.72391 19.5 5 19.5H19C19.2761 19.5 19.4999 19.2761 19.5 19V14C19.5 13.4477 19.9477 13 20.5 13C21.0523 13 21.5 13.4477 21.5 14V19C21.4999 20.3807 20.3807 21.5 19 21.5H5C3.61934 21.5 2.50008 20.3807 2.5 19V5.00002C2.5 3.61931 3.61929 2.50002 5 2.50002H10Z"
                  fill="white"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M17.1689 2.58791C17.8524 1.90449 18.9611 1.90449 19.6445 2.58791L21.4121 4.35549C22.0955 5.03891 22.0955 6.14766 21.4121 6.83108L13.7549 14.4873C13.4267 14.8154 12.9816 15 12.5176 15H10.25L10.1221 14.9932C9.53398 14.9334 9.06672 14.466 9.00684 13.8779L9 13.75V11.4824C9 11.0184 9.18464 10.5733 9.5127 10.2451L17.1689 2.58791ZM11 11.586V13H12.4141L19.8213 5.59377L18.4062 4.17873L11 11.586Z"
                  fill="white"
                />
              </svg>
              New Project
            </a>
            {/*<a href="#gen-web" className="active" role="button" onClick={(event) => event.preventDefault()}>*/}
            {/*  Gen Web*/}
            {/*</a>*/}
            <a href="#projects" role="button" onClick={(event) => { event.preventDefault(); showComingSoon("Projects"); }}>
              Projects
              <span className="nav-status">Soon</span>
            </a>
            <a href="#templates" role="button" onClick={(event) => { event.preventDefault(); openTemplateLibrary(); }}>
              Templates
            </a>
            <a href="#library" role="button" onClick={(event) => { event.preventDefault(); showComingSoon("My Library"); }}>
              My Library
              <span className="nav-status">Soon</span>
            </a>
            <a href="#settings" role="button" onClick={(event) => { event.preventDefault(); showComingSoon("Settings"); }}>
              Settings
              <span className="nav-status">Soon</span>
            </a>
            <a
              className="ghost-button"
              href="#landing"
              role="button"
              onClick={(event) => {
                event.preventDefault();
                setView("landing");
              }}
            >
              Back to website
            </a>
          </nav>
          <section className={`sidebar-history ${isHistoryOpen ? "is-open" : "is-hidden"}`}>
            <span
              role="button"
              className="title"
              aria-expanded={isHistoryOpen}
              aria-label={isHistoryOpen ? "Collapse history" : "Expand history"}
              onClick={(event) => {
                event.preventDefault();
                setIsHistoryOpen((current) => !current);
              }}
            >
              <span>History</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="history-toggle-icon"
              >
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeLinecap="square" />
              </svg>
            </span>
            {isHistoryOpen && (
              <div className="sidebar-history-list">
                {projectHistory.map((item, index) => (
                  <a
                    key={item.prompt}
                    href={`#history-${index}`}
                    role="button"
                    className={
                      activeHistoryPrompt === item.prompt || (!activeHistoryPrompt && index === 0) ? "active" : ""
                    }
                    aria-current={
                      activeHistoryPrompt === item.prompt || (!activeHistoryPrompt && index === 0) ? "true" : undefined
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      openHistoryProject(item);
                    }}
                  >
                    <span className="truncate">{item.name}</span>
                  </a>
                ))}
              </div>
            )}
          </section>

          {/*// Pro account  */}
          <section className="plan-card">
            <span>{user.plan === "pro" ? "Pro account" : "Free account"}</span>
            <p className="p-2">
              {user.plan === "pro"
                ? "Full Design.md controls are enabled."
                : "Core Design.md preview is enabled. Pro export controls are in development."}
            </p>
            <button onClick={upgradeToPro}>{user.plan === "pro" ? "Pro Active" : "Upgrade Pro"}</button>
          </section>

          {/*// Profile */}

          <div className="brand-block">
            <span className="brand-mark">AI</span>
            <div>
              <strong>{PRODUCT_NAME}</strong>
              <span>{user.displayEmail}</span>
            </div>
            <button className="ghost-button logout-button" type="button" onClick={logout}>
              Logout
            </button>
          </div>
        </aside>

        <section className="chat-workspace builder-workspace">
          <div className="chat-scroll" ref={chatScrollRef}>
            {messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                {message.title && <strong>{message.title}</strong>}
                <p>{message.content}</p>
              </article>
            ))}

            {isGenerating && (
              <article className="message assistant thinking-row">
                <span />
                <p>Create Code Preview...</p>
              </article>
            )}

            {hasGenerated && (
              <article className="message assistant result-message generated-pulse">
                <div className="builder-result-grid">
                  <main className="builder-main-panel">
                    <div className="result-toolbar">
                      <div>
                        <button
                          className={previewMode === "prompt" ? "active" : ""}
                          type="button"
                          onClick={() => setPreviewMode("prompt")}
                        >
                          Design.md
                        </button>
                        <button
                          className={previewMode === "preview" ? "active" : ""}
                          type="button"
                          onClick={() => setPreviewMode("preview")}
                        >
                          Preview
                        </button>
                        <button
                          className={previewMode === "edit" ? "active" : ""}
                          type="button"
                          onClick={() => setPreviewMode("edit")}
                        >
                          Edit
                        </button>
                        <span className={`design-status-badge ${savedDesignMd ? "edited" : ""}`}>{designMdStatus}</span>
                      </div>
                      <nav>
                        <span className="target-pill">{outputRequest.target}</span>
                        <button type="button" onClick={downloadDesignMd}>Download</button>
                        <button type="button" onClick={copyOutput}>{copiedOutput ? "Copied" : "Copy"}</button>
                      </nav>
                    </div>
                    <div className="output-panel">
                      {previewMode === "prompt" ? (
                        <pre>{designMd}</pre>
                      ) : previewMode === "edit" ? (
                        <div className="design-md-editor">
                          <div className="editor-header">
                            <div>
                              <span>Edit file</span>
                              <strong>DESIGN.md</strong>
                            </div>
                            <nav>
                              {editSavedAt && <span className="save-status">Saved {editSavedAt}</span>}
                              {savedDesignMd && <button type="button" onClick={resetDesignMdEdit}>Reset</button>}
                              <button type="button" className="save-button" onClick={saveDesignMdEdit}>Save changes</button>
                            </nav>
                          </div>
                          <textarea
                            value={editDraft}
                            onChange={(event) => {
                              setEditDraft(event.target.value);
                              setEditSavedAt(null);
                            }}
                            spellCheck={false}
                          />
                        </div>
                      ) : (
                        <div className={`web-preview design-md-site-preview ${previewTheme}`}>
                          <section className="design-md-detail-hero">
                            <span className="preview-kicker">{PRODUCT_NAME}</span>
                            <h2>Design System inspired by {activeDesign.label}</h2>
                            <p>{activeDesign.direction}</p>
                            <div className="usage-card">
                              <span>Usage</span>
                              <code>{usageCommand}</code>
                            </div>
                            <a className="repository-link" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
                              GitHub: minhduchd-mds/Design-md-ai
                            </a>
                            <p className="preview-disclaimer">
                              This preview is generated from Design.md context and is not affiliated with the referenced brand.
                            </p>
                          </section>

                          <section className="design-md-preview-section">
                            <div className="preview-section-toolbar">
                              <div>
                                <span>Preview</span>
                                <strong>DESIGN.md</strong>
                              </div>
                              <div className="theme-toggle" aria-label="Preview theme">
                                <button
                                  type="button"
                                  className={previewTheme === "light" ? "active" : ""}
                                  onClick={() => setPreviewTheme("light")}
                                >
                                  Light
                                </button>
                                <button
                                  type="button"
                                  className={previewTheme === "dark" ? "active" : ""}
                                  onClick={() => setPreviewTheme("dark")}
                                >
                                  Dark
                                </button>
                              </div>
                            </div>

                            <div className="design-md-preview-frame">
                              <aside>
                                <strong>{activeDesign.label}</strong>
                                {previewNavSections.map((section) => (
                                  <button type="button" key={section.id} onClick={() => scrollToPreviewSection(section.id)}>
                                    {section.title}
                                  </button>
                                ))}
                              </aside>
                              <main>
                                <div className="preview-frame-topbar">
                                  <span />
                                  <span />
                                  <span />
                                  <b>{outputRequest.projectName}</b>
                                </div>
                                <section className="preview-frame-content">
                                  <p className="preview-label">{importedDesign ? "Imported Design.md" : "Open Design template"}</p>
                                  <h3>{outputRequest.projectName}</h3>
                                  <p>{activeDesign.direction}</p>
                                  <div className="markdown-document-sections">
                                    {designMdSections.slice(0, 6).map((section) => (
                                      <article id={`preview-section-${section.id}`} key={section.id} className="markdown-document-section">
                                        <span>{section.title}</span>
                                        <MarkdownSectionContent content={section.content} />
                                      </article>
                                    ))}
                                  </div>
                                  <div className="palette-strip">
                                    {activeDesign.palette.map((color) => (
                                      <div key={color} style={{ background: color }}>
                                        <span>{color}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="catalog-grid">
                                    <div className="type-sample">
                                      <span>Typography</span>
                                      <h3>Readable AI interface</h3>
                                      <p>{activeDesign.typography}</p>
                                    </div>
                                    <div className="component-sample">
                                      <span>Components</span>
                                      <div className="sample-controls">
                                        <button>Primary action</button>
                                        <button>Secondary</button>
                                        <label>
                                          Prompt field
                                          <input value="Generate a SaaS dashboard" readOnly />
                                        </label>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="catalog-columns">
                                    <div>
                                      <span>Layout</span>
                                      {activeDesign.layout.slice(0, 4).map((item) => <p key={item}>{item}</p>)}
                                    </div>
                                    <div>
                                      <span>Do</span>
                                      {activeDesign.rules.slice(0, 4).map((item) => <p key={item}>{item}</p>)}
                                    </div>
                                    <div>
                                      <span>Do not</span>
                                      {activeDesign.donts.slice(0, 4).map((item) => <p key={item}>{item}</p>)}
                                    </div>
                                  </div>
                                  <div className="preview-grid">
                                    {previewItems.map((item) => <div key={item}>{item}</div>)}
                                  </div>
                                </section>
                              </main>
                            </div>
                          </section>
                        </div>
                      )}
                    </div>
                  </main>
                </div>
              </article>
            )}
          </div>

          <ChatComposer
            isGenerating={isGenerating}
            openDesignPresets={openDesignPresets}
            request={request}
            selectedPreset={selectedPreset}
            setRequest={setRequest}
            onGenerate={generateProject}
            onCreateImage={createImageFromPrompt}
            onUploadMarkdownFiles={uploadMarkdownFiles}
            onUploadScreenshot={uploadScreenshot}
          />
        </section>
      </main>
    );
  }
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <a href="#top" className="landing-brand">
          <span>AI</span>
          <div>
            <strong>{PRODUCT_NAME}</strong>
            <small>Design.md handoff workspace</small>
          </div>
        </a>
        <nav>
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#templates">Templates</a>
          <a href="#router-layout">Handoff</a>
          <a href="#ai-gallery">Gallery</a>
          <a href="#login">Login</a>
        </nav>
        <div>
          <button type="button" onClick={() => openLandingAuth("login")}>Login</button>
          <button className="primary-small" type="button" onClick={() => openLandingAuth("register")}>Get started</button>
        </div>
      </header>

      <section id="top" className="landing-hero">
        <div className="landing-hero-copy">
          <span className="eyebrow">Figma to Design.md for AI agents</span>
          <h1>Design-md-ai turns design systems into coding-agent context.</h1>
          <p>
            Generate Design.md files, token maps, component guidance, and implementation prompts from Figma or uploaded markdown before asking Codex, Claude Code, Cursor, Windsurf, or Figma Make to build.
          </p>
          <div className="landing-actions">
            <button className="primary-action dark" type="button" onClick={() => openLandingAuth("register")}>Open workspace</button>
            <a href="#how-it-works">See workflow</a>
          </div>
          <div className="landing-metrics">
            {[
              ["Figma scan", "Components and tokens"],
              [`${DESIGN_MD_TEMPLATES.length} templates`, "Stored Design.md library"],
              ["Prompt export", "Codex and Claude"],
            ].map(([value, label]) => (
              <article key={value}>
                <strong>{value}</strong>
                <span>{label}</span>
              </article>
            ))}
          </div>
        </div>
        <div className="code-mockup">
          <div className="mockup-top">
            <i />
            <i />
            <i />
            <span>Design.md - Live</span>
          </div>
          <div className="mockup-grid">
            <pre>
              {CODE_LINES.map((line, index) => (
                `${String(index + 1).padStart(2, "0")}  ${line || " "}`
              )).join("\n")}
            </pre>
            <section>
              <div className="mini-product">
                <nav>
                  <strong>{PRODUCT_NAME}</strong>
                  <span>Figma</span>
                  <span>Agents</span>
                </nav>
                <article>
                  <small>Design.md Handoff</small>
                  <h3>Ship cleaner code prompts from real design context.</h3>
                  <p>Map components, tokens, layout rules, and responsive states before implementation begins.</p>
                  <div>
                    <button>Export</button>
                    <button>Review</button>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </div>
      </section>

      <section id="features" className="landing-section feature-section">
        <div className="section-heading">
          <span>Production handoff</span>
          <h2>Built for teams who need design context before generated code.</h2>
        </div>
        <div className="feature-grid">
          {LANDING_FEATURES.map(([title, text], index) => (
            <article key={title} className={index === 1 ? "featured" : ""}>
              <b>0{index + 1}</b>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="landing-section how-section">
        <div className="section-heading">
          <span>How it works</span>
          <h2>Three steps from design truth to agent-ready implementation.</h2>
        </div>
        <div className="how-grid">
          {HOW_IT_WORKS.map(([title, text], index) => (
            <article key={title}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="templates" className="landing-section template-library-section">
        <div className="template-library-heading">
          <div className="section-heading">
            <span>Template library</span>
            <h2>Search brand and product Design.md templates before opening the workspace.</h2>
          </div>
          <label className="template-search">
            <span>Find a template</span>
            <input
              value={landingTemplateQuery}
              onChange={(event) => setLandingTemplateQuery(event.target.value)}
              placeholder="Airtable, Linear, Tesla, Stripe..."
            />
          </label>
        </div>
        <div className="template-filter-panel">
          <div className="template-priority-tabs" aria-label="Template priority filters">
            {TEMPLATE_PRIORITY_FILTERS.map((priority) => (
              <button
                key={priority}
                type="button"
                className={landingTemplatePriority === priority ? "active" : ""}
                onClick={() => setLandingTemplatePriority(priority)}
              >
                <span>{priority === "All" ? "All priorities" : `${priority} priority`}</span>
                <b>{templatePriorityCounts[priority]}</b>
              </button>
            ))}
          </div>
          <div className="template-category-chips" aria-label="Template category filters">
            {TEMPLATE_CATEGORY_FILTERS.map((category) => (
              <button
                key={category}
                type="button"
                className={landingTemplateCategory === category ? "active" : ""}
                onClick={() => setLandingTemplateCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        <div className="template-library-grid">
          {landingTemplateMatches.map((template) => (
            <article key={template.id}>
              <div>
                <span>{template.priority} priority</span>
                <h3>{template.label}</h3>
                <p>Use this Design.md style as starting context for tokens, components, layout rules, and implementation prompts.</p>
              </div>
              <div className="template-card-meta">
                <span>{template.category}</span>
                <span>{template.id}</span>
              </div>
              <div className="template-command">{getDesignMdUsageCommand(template.id)}</div>
              <button type="button" onClick={() => selectLandingTemplate(template.id)}>Use template</button>
            </article>
          ))}
          {landingTemplateMatches.length === 0 && (
            <article className="template-empty">
              <h3>No matching template</h3>
              <p>Try a brand name, product type, or design system keyword.</p>
            </article>
          )}
        </div>
      </section>

      <section id="router-layout" className="landing-section router-section">
        <div className="router-heading">
          <div>
            <span>Design.md handoff router</span>
            <h2>One workspace for prompts, previews, tokens, and export-ready context.</h2>
            <p>Design-md-ai keeps design-system information close to the prompt, so implementation agents receive grounded instructions instead of generic UI requests.</p>
          </div>
          <div className="router-stats">
            {[
              [String(DESIGN_MD_TEMPLATES.length), "Design.md templates"],
              ["5", "Agent targets"],
              ["3", "Input modes"],
              ["1", "Design.md source"],
            ].map(([value, label]) => (
              <article key={label}><strong>{value}</strong><span>{label}</span></article>
            ))}
          </div>
        </div>
        <div className="service-grid">
          {LANDING_SERVICES.map(([title, text], index) => (
            <article key={title}>
              <b>{index + 1}</b>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="ai-gallery" className="landing-section gallery-section">
        <div className="section-heading">
          <span>Workflow coverage</span>
          <h2>The demo focuses on concrete design handoff surfaces.</h2>
        </div>
        <div className="gallery-grid">
          {LANDING_SHOWCASE.map(([title, type], index) => (
            <article key={title}>
              <div className={`gallery-art art-${index + 1}`}>
                <span>{type}</span>
                <strong>{index + 1}</strong>
              </div>
              <small>{type}</small>
              <h3>{title}</h3>
              <p>Ready for <b>handoff</b></p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section dark-demo">
        <div>
          <span>Agent context</span>
          <h2>Show the design rules before generated code.</h2>
          <p>The workspace keeps Design.md, token decisions, preview, benchmark notes, and export actions visible in the same flow.</p>
        </div>
        <div>
          {["Design.md", "Token map", "Prompt export", "Figma frame"].map((item) => (
            <article key={item}>
              <b>&lt;/&gt;</b>
              <h3>{item}</h3>
              <p>Ready for handoff with clear product and design-system context.</p>
            </article>
          ))}
        </div>
      </section>

      <section id="login" className="landing-auth-section">
        <div className="landing-auth-card">
          <div>
            <span>Secure workspace</span>
            <h2>{authMode === "login" ? `Sign in to ${PRODUCT_NAME}.` : `Create your ${PRODUCT_NAME} workspace.`}</h2>
            <p>This public demo stores credentials locally with Web Crypto, expires sessions automatically, and locks repeated failed attempts. Use production backend auth before handling real customer accounts.</p>
          </div>
          <form onSubmit={handleAuthSubmit}>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <label>
              Password
              <span className="password-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  minLength={12}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>
            {authError && <div className="auth-error">{authError}</div>}
            <button className="primary-action warm" type="submit">{authMode === "login" ? "Login" : "Create account"}</button>
          </form>
          <button className="text-button" type="button" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
            {authMode === "login" ? "No account yet? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

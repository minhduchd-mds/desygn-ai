/**
 * Authentication module — extracted from main.tsx for code splitting (Sprint 3).
 * Handles user registration, login, session management, and encrypted chat storage.
 */
import type { AccountPlan, ChatMessage, ChatSession, SessionUser, UserRecord } from "./types";

const USER_STORE_KEY = "ai-design-agent.users.v1";
const SESSION_STORE_KEY = "ai-design-agent.session.v1";
const AUTH_ATTEMPT_PREFIX = "ai-design-agent.auth-attempt.v1";
const PROJECT_HISTORY_KEY = "ai-design-agent.project-history.v1";
export const CHAT_HISTORY_PREFIX = "ai-design-agent.chat-history.v1";
export const CHAT_HISTORY_LIMIT = 40;
export const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_LOCK_MS = 1000 * 60 * 15;

const encoder = new TextEncoder();

interface AuthAttemptRecord {
  count: number;
  lockedUntil: number;
}

// ─── Crypto helpers ───
function bytesToBase64(bytes: Uint8Array): string {
  let value = "";
  bytes.forEach((byte) => { value += String.fromCharCode(byte); });
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
    { name: "PBKDF2", salt: toArrayBuffer(salt), iterations: 310000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: toArrayBuffer(salt), iterations: 310000, hash: "SHA-256" },
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

// ─── User store ───
function getUsers(): UserRecord[] {
  try { return JSON.parse(localStorage.getItem(USER_STORE_KEY) ?? "[]") as UserRecord[]; }
  catch { return []; }
}

function saveUsers(users: UserRecord[]) {
  localStorage.setItem(USER_STORE_KEY, JSON.stringify(users));
}

// ─── Public API ───
export async function register(email: string, password: string): Promise<SessionUser> {
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

export async function login(email: string, password: string): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  const emailHash = await hashEmail(normalized);
  assertAuthNotLocked(emailHash);
  const users = getUsers();
  const record = users.find((user) => user.emailHash === emailHash || user.email === normalized);
  if (!record) { recordFailedAuthAttempt(emailHash); throw new Error("Email or password is incorrect."); }
  const verifier = await hashPassword(password, base64ToBytes(record.salt));
  if (!timingSafeEqual(verifier, record.verifier)) { recordFailedAuthAttempt(emailHash); throw new Error("Email or password is incorrect."); }
  clearAuthAttempt(emailHash);
  const salt = base64ToBytes(record.salt);
  let displayEmail = normalized;
  if (record.encryptedEmail) {
    try { displayEmail = await decryptProfile<string>(password, salt, record.encryptedEmail); }
    catch { displayEmail = record.email ?? normalized; }
  }
  if (!record.emailHash || !record.encryptedEmail || record.email) {
    const encryptedEmail = record.encryptedEmail || await encryptProfile(password, salt, displayEmail);
    saveUsers(users.map((user) => (user === record ? { ...user, email: undefined, emailHash, encryptedEmail } : user)));
  }
  return { emailHash, displayEmail, plan: record.plan, expiresAt: Date.now() + SESSION_TTL_MS };
}

export function updatePlan(emailHash: string, plan: AccountPlan) {
  saveUsers(getUsers().map((user) => (user.emailHash === emailHash ? { ...user, plan } : user)));
}

export function getSessionUser(): SessionUser | null {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_STORE_KEY) ?? "null") as (SessionUser & { email?: string }) | null;
    if (!session?.emailHash) return null;
    if (!session.expiresAt || session.expiresAt <= Date.now()) { clearSessionUser(); return null; }
    // Enrich from user record if available (local auth); for Google/OAuth sessions
    // the user record may not exist — return session data directly.
    const record = getUsers().find((user) => user.emailHash === session.emailHash);
    return {
      emailHash: record?.emailHash ?? session.emailHash,
      displayEmail: session.displayEmail || record?.emailHash || "User",
      plan: record?.plan ?? session.plan ?? "free",
      expiresAt: session.expiresAt,
    };
  } catch { return null; }
}

export function saveSessionUser(user: SessionUser) {
  localStorage.setItem(SESSION_STORE_KEY, JSON.stringify({ ...user, expiresAt: Date.now() + SESSION_TTL_MS }));
}

export function clearSessionUser() {
  localStorage.removeItem(SESSION_STORE_KEY);
}

export function getProjectHistory(): ProjectHistoryItem[] {
  try {
    const items = JSON.parse(localStorage.getItem(PROJECT_HISTORY_KEY) ?? "null") as ProjectHistoryItem[] | null;
    return items?.length ? items : PROJECT_HISTORY;
  } catch { return PROJECT_HISTORY; }
}

export function saveProjectHistory(items: ProjectHistoryItem[]) {
  localStorage.setItem(PROJECT_HISTORY_KEY, JSON.stringify(items.slice(0, 12)));
}

// Keep original project history defaults
const PROJECT_HISTORY = [
  { name: "Modern SaaS Landing Page", date: "07/05/2024, 09:45 AM", prompt: "Create a modern SaaS landing page with login, dashboard, and Pro upgrade page.", category: "SaaS", openDesign: "openai" as const, target: "React + Vite" },
  { name: "AI Chat Dashboard", date: "08/05/2024, 09:45 AM", prompt: "Create an AI chat dashboard with sidebar, billing, prompt composer, and preview output.", category: "AI tool", openDesign: "openai" as const, target: "React + Vite" },
  { name: "E-commerce Website", date: "09/05/2024, 11:15 AM", prompt: "Create an e-commerce website with product page, cart, checkout, and admin view.", category: "E-commerce", openDesign: "shopify" as const, target: "React + Vite" },
];

export function getChatHistoryKey(emailHash: string) {
  return `${CHAT_HISTORY_PREFIX}.${emailHash}`;
}

export async function encryptChatMessages(emailHash: string, messages: ChatMessage[]): Promise<string> {
  const salt = encoder.encode(`chat:${emailHash}:v1`);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(emailHash, salt, ["encrypt"]);
  const payload = encoder.encode(JSON.stringify(messages.slice(-CHAT_HISTORY_LIMIT)));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipher))}`;
}

export async function decryptChatMessages(emailHash: string, payload: string): Promise<ChatMessage[]> {
  const [ivValue, cipherValue] = payload.split(".");
  if (!ivValue || !cipherValue) return [];
  const salt = encoder.encode(`chat:${emailHash}:v1`);
  const key = await deriveKey(emailHash, salt, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(base64ToBytes(ivValue)) }, key, toArrayBuffer(base64ToBytes(cipherValue)));
  return JSON.parse(new TextDecoder().decode(plain)) as ChatMessage[];
}

// ─── Chat session index helpers ───
const SESSIONS_INDEX_PREFIX = "ai-design-agent.sessions-index.v1";

function getSessionsIndexKey(emailHash: string): string {
  return `${SESSIONS_INDEX_PREFIX}.${emailHash}`;
}

export function loadSessionIndex(emailHash: string): ChatSession[] {
  try {
    const raw = localStorage.getItem(getSessionsIndexKey(emailHash));
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

export function saveSessionIndex(emailHash: string, sessions: ChatSession[]): void {
  // Keep at most 50 sessions
  localStorage.setItem(getSessionsIndexKey(emailHash), JSON.stringify(sessions.slice(0, 50)));
}

export function getSessionStorageKey(emailHash: string, sessionId: string): string {
  return `${CHAT_HISTORY_PREFIX}.session.${emailHash}.${sessionId}`;
}

export async function saveSessionMessages(emailHash: string, sessionId: string, messages: ChatMessage[]): Promise<void> {
  const payload = await encryptChatMessages(emailHash, messages);
  localStorage.setItem(getSessionStorageKey(emailHash, sessionId), payload);
}

export async function loadSessionMessages(emailHash: string, sessionId: string): Promise<ChatMessage[]> {
  const encrypted = localStorage.getItem(getSessionStorageKey(emailHash, sessionId));
  if (!encrypted) return [];
  try {
    return await decryptChatMessages(emailHash, encrypted);
  } catch {
    return [];
  }
}

export function deleteSessionStorage(emailHash: string, sessionId: string): void {
  localStorage.removeItem(getSessionStorageKey(emailHash, sessionId));
}

export function createMessage(
  role: ChatMessage["role"],
  content: string,
  title?: string,
  htmlCode?: string,
  attachments?: ChatMessage["attachments"],
): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    title,
    content,
    htmlCode,
    ...(attachments?.length ? { attachments } : {}),
  };
}

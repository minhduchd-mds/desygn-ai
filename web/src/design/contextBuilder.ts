import JSZip from "jszip";
import type { SerializedNode } from "../../../shared/types";
import type { DesignContext, DocSource } from "../../../shared/designContext";
import { createEmptyContext } from "../../../shared/designContext";
import { sanitize } from "../../../shared/sanitize";
import { getCached, setCached } from "../lib/requestCache";

export interface InputSources {
  pluginScanResult: SerializedNode[] | null;
  variableCount?: number;
  pageCount?: number;
  uploadedFiles: File[];
  textPrompt: string;
}

function getFileType(fileName: string): "md" | "txt" | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".txt")) return "txt";
  return null;
}

async function readTextFile(file: File, type: "md" | "txt"): Promise<DocSource> {
  return {
    filename: file.name,
    content: await file.text(),
    type,
  };
}

async function parseZipFile(file: File): Promise<DocSource[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter((entry) => {
    if (entry.dir) return false;
    const type = getFileType(entry.name);
    return type === "md" || type === "txt";
  });

  return Promise.all(
    entries.map(async (entry) => ({
      filename: entry.name,
      content: await entry.async("text"),
      type: "zip-entry" as const,
    })),
  );
}

export async function parseFileSources(files: File[]): Promise<DocSource[]> {
  const docs: DocSource[] = [];

  for (const file of files) {
    const type = getFileType(file.name);
    if (type) {
      docs.push(await readTextFile(file, type));
      continue;
    }

    if (file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip") {
      docs.push(...(await parseZipFile(file)));
    }
  }

  return docs;
}

function parseBootstrapSuggestions(value: unknown): string[] {
  const components =
    Array.isArray(value)
      ? value
      : typeof value === "object" && value !== null && Array.isArray((value as { components?: unknown }).components)
        ? (value as { components: unknown[] }).components
        : [];
  return components.filter((item): item is string => typeof item === "string").map((item) => sanitize(item)).filter(Boolean).slice(0, 12);
}

async function fetchBootstrapSuggestions(prompt: string, docs: DocSource[]): Promise<string[]> {
  const sanitizedPrompt = sanitize(prompt);
  const cacheKey = { prompt: sanitizedPrompt, docs };
  const cached = getCached<string[]>(cacheKey);
  if (cached) return cached;

  const response = await fetch("/api/bootstrap-context", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: sanitizedPrompt, docs }),
  });

  if (!response.ok) return [];

  const result = await response.json() as { components?: unknown };
  const suggestions = parseBootstrapSuggestions(result.components);
  setCached(cacheKey, suggestions);
  return suggestions;
}

export async function buildContext(sources: InputSources): Promise<DesignContext> {
  const context = createEmptyContext();
  context.components = sources.pluginScanResult ?? [];
  context.variableCount = sources.variableCount ?? 0;
  context.pageCount = sources.pageCount ?? 0;
  context.docs = await parseFileSources(sources.uploadedFiles);
  context.prompt = sanitize(sources.textPrompt);

  if (context.components.length === 0) {
    context.bootstrapSuggestions = await fetchBootstrapSuggestions(context.prompt, context.docs);
  }

  return context;
}

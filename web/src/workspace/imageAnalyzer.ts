import type { DesignContext, LayoutPattern, TemplateMatch } from "../../../shared/designContext";
import { sanitize } from "../../../shared/sanitize";
import { MAX_IMAGE_SIZE_BYTES } from "../design/constants";
import { DESIGN_MD_TEMPLATES } from "../design/templateRegistry";
import { matchTemplates } from "../design/templateMatcher";

const MAX_IMAGE_SIDE = 1024;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export interface ImageAnalysisResult {
  layoutPattern: LayoutPattern | null;
  top3: TemplateMatch[];
  enrichedContext: DesignContext;
}

function validateImage(file: File): void {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error("Unsupported format. Use PNG, JPG, or WebP.");
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image too large. Max 5MB.");
  }
}

async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  if ("OffscreenCanvas" in window) {
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: file.type, quality: 0.85 });
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), file.type, 0.85));
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

function buildContextSummary(context: DesignContext): string {
  return [
    `Project has ${context.components.length} components.`,
    `Prompt: ${sanitize(context.prompt).slice(0, 200)}.`,
    `Bootstrap suggestions: ${context.bootstrapSuggestions.join(", ")}.`,
    `Docs: ${context.docs.map((doc) => doc.filename).join(", ")}.`,
  ].join(" ");
}

function fallbackResult(context: DesignContext): ImageAnalysisResult {
  console.warn("Vision API unavailable, falling back to keyword matching");
  const top3 = matchTemplates(context);
  const enrichedContext = {
    ...context,
    templateMatches: top3,
  };
  return {
    layoutPattern: null,
    top3,
    enrichedContext,
  };
}

export async function analyzeImage(file: File, context: DesignContext): Promise<ImageAnalysisResult> {
  validateImage(file);

  const url = import.meta.env.VITE_ANALYZE_IMAGE_URL || "/api/analyze-image";
  if (!url) {
    return fallbackResult(context);
  }

  try {
    const resized = await resizeImage(file);
    const dataUrl = await fileToDataUrl(resized);
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        base64Image: dataUrl.split(",")[1] ?? dataUrl,
        mimeType: file.type,
        contextSummary: buildContextSummary(context),
        templateMeta: DESIGN_MD_TEMPLATES.map(({ id, category, priority, keywords }) => ({
          id,
          category,
          priority,
          keywords,
        })),
      }),
    });

    if (!response.ok) return fallbackResult(context);

    const result = (await response.json()) as { layoutPattern: LayoutPattern; top3: TemplateMatch[]; error?: string };
    if (result.error) return fallbackResult(context);

    const enrichedContext = {
      ...context,
      layoutPattern: result.layoutPattern,
      templateMatches: result.top3,
    };
    return {
      layoutPattern: result.layoutPattern,
      top3: result.top3,
      enrichedContext,
    };
  } catch {
    return fallbackResult(context);
  }
}

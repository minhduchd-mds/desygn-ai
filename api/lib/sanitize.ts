import { API_SANITIZE_HTML_LIMIT, API_SANITIZE_SCREENS_LIMIT } from "../../shared/constants";

/**
 * Strip HTML tags and non-printable characters from user input.
 * Two variants: short (for HTML generation prompts) and long (for screen specs).
 */
export function sanitizeShort(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[^\x20-\x7E\n\rÀ-ɏ]/g, "")
    .trim()
    .slice(0, API_SANITIZE_HTML_LIMIT);
}

export function sanitizeLong(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[^\x20-\x7E\n\r\tÀ-ɏ一-鿿]/g, "")
    .trim()
    .slice(0, API_SANITIZE_SCREENS_LIMIT);
}

/**
 * Strip accidental markdown code fences that LLMs sometimes wrap HTML in.
 * Handles: ```html ... ```, ``` ... ```, and leading/trailing whitespace.
 */
export function stripCodeFences(text: string): string {
  return text.replace(/^```(?:html)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

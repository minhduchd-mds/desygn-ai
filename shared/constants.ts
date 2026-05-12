/**
 * Shared constants — single source of truth for magic numbers across plugin + UI + API.
 * Import from here instead of scattering literals throughout the codebase.
 */

// ── Scoring thresholds ──────────────────────────────────────────────────────
export const SCORE_UNLOCK_THRESHOLD = 75;   // minimum score to unlock prompt export
export const SCORE_WARN_THRESHOLD   = 50;   // below this → warning state

// ── Naming heuristics ───────────────────────────────────────────────────────
export const MAX_SHORT_NAME_LENGTH  = 2;    // names ≤ this are "too short"
export const MAX_FUZZY_COLOR_DELTA  = 5;    // per-channel RGB tolerance for token matching

// ── Structure heuristics ────────────────────────────────────────────────────
export const MAX_OPTIMAL_NESTING    = 8;    // frame depth above which we warn
export const MAX_DEEP_NESTING       = 10;   // depth above which score penalty applies
export const SPACING_GRID_MINOR     = 4;    // 4px minor grid
export const SPACING_GRID_MAJOR     = 8;    // 8px major grid
export const MAX_PALETTE_COLORS     = 10;   // unique colors above this → warning
export const MAX_FONT_SIZES         = 6;    // unique font sizes above this → warning
export const MIN_TYPE_SCALE         = 2;    // minimum sizes for a proper type scale
export const MAX_TYPE_SCALE         = 5;    // upper bound of a healthy type scale

// ── Prompt / tokens ─────────────────────────────────────────────────────────
export const CHARS_PER_TOKEN        = 4;    // rough GPT-4 tokenization ratio
export const PROMPT_COMPACT_MAX_DEPTH = 12; // max serialization depth for prompt builder

// ── Display limits ──────────────────────────────────────────────────────────
export const TOKEN_MAP_DISPLAY_LIMIT = 6;   // visible rows in collapsed TokenMap
export const RING_COLORS = [
  "#00d4ff",  // --glow  (atom)
  "#7c3aed",  // --glow2 (molecule)
  "#06ffa5",  // --glow3 (organism)
  "#ffd166",  // warning
  "#f5a623",  // orange
  "#ff6b9d",  // pink (variants)
] as const;

// ── API / network ────────────────────────────────────────────────────────────
export const GROQ_MODEL             = "llama-3.3-70b-versatile";
export const HTML_GEN_MAX_TOKENS    = 6000;
export const SCREEN_GEN_MAX_TOKENS  = 7000;
export const API_SANITIZE_HTML_LIMIT    = 4000;  // max chars for HTML generation prompt
export const API_SANITIZE_SCREENS_LIMIT = 10000; // max chars for screens generation prompt

// ── Plugin UI ────────────────────────────────────────────────────────────────
export const SCAN_TIMEOUT_MS        = 10_000;  // postMessage scan timeout
export const DEBOUNCE_MS            = 300;
export const COPY_FEEDBACK_MS       = 1_800;   // duration of "Copied!" tooltip

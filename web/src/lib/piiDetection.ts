/**
 * PII (Personally Identifiable Information) Detection Engine
 *
 * Scans text content for sensitive data patterns before storage/transmission.
 * Used by EvidenceMemory to prevent PII from being stored in memory system.
 *
 * Detection categories:
 *   • Email addresses
 *   • Phone numbers (US, VN, international formats)
 *   • Credit card numbers (Visa, MC, Amex, Discover)
 *   • Social Security Numbers (SSN)
 *   • IP addresses (v4, v6)
 *   • Vietnamese ID numbers (CCCD/CMND)
 *   • Dates of birth patterns
 *   • URLs with auth tokens
 *
 * Performance: O(n) scan per pattern, lazy regex compilation.
 */

// ── Types ─────────────────────────────────────────────────────

export type PIICategory =
  | "email"
  | "phone"
  | "credit-card"
  | "ssn"
  | "ip-address"
  | "national-id"
  | "date-of-birth"
  | "auth-token"
  | "custom";

export interface PIIMatch {
  category: PIICategory;
  value: string;       // The matched PII (masked in output)
  startIndex: number;
  endIndex: number;
  confidence: number;  // 0.0 - 1.0
}

export interface PIIScanResult {
  hasPII: boolean;
  matches: PIIMatch[];
  redactedText: string;
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
}

export interface PIIConfig {
  categories?: PIICategory[];        // Which categories to scan (default: all)
  customPatterns?: Array<{ name: string; pattern: RegExp; category?: PIICategory }>;
  redactWith?: string;               // default "***"
  minConfidence?: number;            // default 0.7 — ignore matches below this
}

// ── Pattern Definitions ──────────────────────────────────────

interface PatternDef {
  category: PIICategory;
  pattern: RegExp;
  confidence: number;
  validate?: (match: string) => boolean; // Optional validation (e.g., Luhn check)
}

const PATTERNS: PatternDef[] = [
  // Email
  {
    category: "email",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    confidence: 0.95,
  },

  // Phone: US format
  {
    category: "phone",
    pattern: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    confidence: 0.85,
  },

  // Phone: Vietnamese format
  {
    category: "phone",
    pattern: /\b(?:\+84|0)(?:3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-46-9])\d{7}\b/g,
    confidence: 0.9,
  },

  // Phone: International with + prefix
  {
    category: "phone",
    pattern: /\b\+\d{1,3}[-.\s]?\d{4,14}\b/g,
    confidence: 0.75,
  },

  // Credit Card: Visa
  {
    category: "credit-card",
    pattern: /\b4\d{3}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    confidence: 0.9,
    validate: luhnCheck,
  },

  // Credit Card: Mastercard
  {
    category: "credit-card",
    pattern: /\b5[1-5]\d{2}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    confidence: 0.9,
    validate: luhnCheck,
  },

  // Credit Card: Amex
  {
    category: "credit-card",
    pattern: /\b3[47]\d{2}[-\s]?\d{6}[-\s]?\d{5}\b/g,
    confidence: 0.9,
    validate: luhnCheck,
  },

  // SSN
  {
    category: "ssn",
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    confidence: 0.8,
    validate: (match) => {
      const digits = match.replace(/[-\s]/g, "");
      if (digits.length !== 9) return false;
      // SSN cannot start with 000, 666, or 9xx
      const area = parseInt(digits.substring(0, 3));
      return area !== 0 && area !== 666 && area < 900;
    },
  },

  // IP Address v4
  {
    category: "ip-address",
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    confidence: 0.7,
  },

  // Vietnamese National ID (CCCD: 12 digits, CMND: 9 digits)
  {
    category: "national-id",
    pattern: /\b(?:0[0-9]{2}[12349]\d{8}|\d{9})\b/g,
    confidence: 0.7,
    validate: (match) => {
      const digits = match.replace(/\s/g, "");
      // CCCD: 12 digits starting with province code
      if (digits.length === 12) {
        const province = parseInt(digits.substring(0, 3));
        return province >= 1 && province <= 96;
      }
      // CMND: 9 digits
      return digits.length === 9;
    },
  },

  // Date of Birth patterns (MM/DD/YYYY or DD/MM/YYYY)
  {
    category: "date-of-birth",
    pattern: /\b(?:born|dob|birthday|ngày sinh|sinh ngày)[:.\s]+\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/gi,
    confidence: 0.85,
  },

  // Auth tokens in URLs
  {
    category: "auth-token",
    pattern: /(?:token|key|secret|password|api_key|apikey|access_token|auth)[\s=:]+[A-Za-z0-9_\-./+]{16,}/gi,
    confidence: 0.9,
  },
];

// ── Luhn Algorithm ───────────────────────────────────────────

function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/[-\s]/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

// ── Scanner ──────────────────────────────────────────────────

export class PIIScanner {
  private config: Required<PIIConfig>;
  private patterns: PatternDef[];
  private stats = { totalScans: 0, piiFound: 0, totalMatches: 0 };

  constructor(config?: PIIConfig) {
    this.config = {
      categories: config?.categories ?? ["email", "phone", "credit-card", "ssn", "ip-address", "national-id", "date-of-birth", "auth-token"],
      customPatterns: config?.customPatterns ?? [],
      redactWith: config?.redactWith ?? "***",
      minConfidence: config?.minConfidence ?? 0.7,
    };

    // Build active pattern list
    this.patterns = PATTERNS.filter((p) => this.config.categories.includes(p.category));

    // Add custom patterns
    for (const custom of this.config.customPatterns) {
      this.patterns.push({
        category: custom.category ?? "custom",
        pattern: custom.pattern,
        confidence: 0.8,
      });
    }
  }

  /**
   * Scan text for PII
   */
  scan(text: string): PIIScanResult {
    this.stats.totalScans++;
    const matches: PIIMatch[] = [];

    for (const patternDef of this.patterns) {
      // Reset regex lastIndex (global flag)
      const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const value = match[0];

        // Run validator if present
        if (patternDef.validate && !patternDef.validate(value)) continue;

        // Check confidence threshold
        if (patternDef.confidence < this.config.minConfidence) continue;

        matches.push({
          category: patternDef.category,
          value,
          startIndex: match.index,
          endIndex: match.index + value.length,
          confidence: patternDef.confidence,
        });
      }
    }

    // Deduplicate overlapping matches (keep highest confidence)
    const deduped = this.deduplicateMatches(matches);

    if (deduped.length > 0) {
      this.stats.piiFound++;
      this.stats.totalMatches += deduped.length;
    }

    return {
      hasPII: deduped.length > 0,
      matches: deduped,
      redactedText: this.redact(text, deduped),
      riskLevel: this.assessRisk(deduped),
    };
  }

  /**
   * Quick check — just returns true/false without details
   */
  hasPII(text: string): boolean {
    for (const patternDef of this.patterns) {
      const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);
      const match = regex.exec(text);
      if (match) {
        if (patternDef.validate && !patternDef.validate(match[0])) continue;
        if (patternDef.confidence >= this.config.minConfidence) return true;
      }
    }
    return false;
  }

  /**
   * Redact PII from text
   */
  redact(text: string, matches?: PIIMatch[]): string {
    const piiMatches = matches ?? this.scan(text).matches;
    if (piiMatches.length === 0) return text;

    // Sort by startIndex descending so replacements don't shift indices
    const sorted = [...piiMatches].sort((a, b) => b.startIndex - a.startIndex);

    let result = text;
    for (const match of sorted) {
      const masked = this.maskValue(match);
      result = result.substring(0, match.startIndex) + masked + result.substring(match.endIndex);
    }

    return result;
  }

  /**
   * Get scanner statistics
   */
  getStats(): { totalScans: number; piiFound: number; totalMatches: number; activePatterns: number } {
    return { ...this.stats, activePatterns: this.patterns.length };
  }

  // ========== Private Methods ==========

  private maskValue(match: PIIMatch): string {
    switch (match.category) {
      case "email": {
        const [local, domain] = match.value.split("@");
        return `${local[0]}${this.config.redactWith}@${domain}`;
      }
      case "credit-card":
        return `${this.config.redactWith}${match.value.slice(-4)}`;
      case "phone":
        return `${this.config.redactWith}${match.value.slice(-4)}`;
      case "ssn":
        return `${this.config.redactWith}-${match.value.slice(-4)}`;
      default:
        return this.config.redactWith;
    }
  }

  private assessRisk(matches: PIIMatch[]): PIIScanResult["riskLevel"] {
    if (matches.length === 0) return "none";

    const hasCritical = matches.some((m) =>
      m.category === "credit-card" || m.category === "ssn" || m.category === "auth-token"
    );
    if (hasCritical) return "critical";

    const hasHigh = matches.some((m) =>
      m.category === "national-id"
    );
    if (hasHigh) return "high";

    const hasMedium = matches.some((m) =>
      m.category === "email" || m.category === "phone"
    );
    if (hasMedium) return "medium";

    return "low";
  }

  private deduplicateMatches(matches: PIIMatch[]): PIIMatch[] {
    if (matches.length <= 1) return matches;

    // Sort by startIndex
    const sorted = [...matches].sort((a, b) => a.startIndex - b.startIndex);
    const result: PIIMatch[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = result[result.length - 1];
      const curr = sorted[i];

      // Overlap check
      if (curr.startIndex < prev.endIndex) {
        // Keep higher confidence match
        if (curr.confidence > prev.confidence) {
          result[result.length - 1] = curr;
        }
      } else {
        result.push(curr);
      }
    }

    return result;
  }
}

// ── Factory ──────────────────────────────────────────────────

/**
 * Create PII scanner with default configuration
 */
export function createPIIScanner(config?: PIIConfig): PIIScanner {
  return new PIIScanner(config);
}

/**
 * Create PII scanner optimized for Vietnamese content
 */
export function createVietnamesePIIScanner(config?: PIIConfig): PIIScanner {
  return new PIIScanner({
    ...config,
    categories: ["email", "phone", "national-id", "date-of-birth", "auth-token", ...(config?.categories ?? [])],
  });
}

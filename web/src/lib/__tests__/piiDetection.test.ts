import { describe, it, expect, beforeEach } from "vitest";
import { PIIScanner, createPIIScanner, createVietnamesePIIScanner } from "../piiDetection";

describe("PIIScanner", () => {
  let scanner: PIIScanner;

  beforeEach(() => {
    scanner = new PIIScanner();
  });

  describe("email detection", () => {
    it("detects standard email", () => {
      const result = scanner.scan("Contact john@example.com for details");
      expect(result.hasPII).toBe(true);
      expect(result.matches[0].category).toBe("email");
      expect(result.matches[0].value).toBe("john@example.com");
    });

    it("detects emails with subdomains", () => {
      const result = scanner.scan("Send to user@mail.company.co.uk");
      expect(result.hasPII).toBe(true);
      expect(result.matches[0].category).toBe("email");
    });

    it("redacts email preserving first char", () => {
      const result = scanner.scan("Email: john@example.com");
      expect(result.redactedText).toContain("j***@example.com");
    });
  });

  describe("phone detection", () => {
    it("detects US phone number", () => {
      const result = scanner.scan("Call (555) 123-4567");
      expect(result.hasPII).toBe(true);
      expect(result.matches[0].category).toBe("phone");
    });

    it("detects Vietnamese phone number", () => {
      const result = scanner.scan("SĐT: 0912345678");
      expect(result.hasPII).toBe(true);
      expect(result.matches[0].category).toBe("phone");
    });

    it("detects international format", () => {
      const result = scanner.scan("Phone: +84 912345678");
      expect(result.hasPII).toBe(true);
    });

    it("redacts phone keeping last 4 digits", () => {
      const result = scanner.scan("Call 0912345678");
      expect(result.redactedText).toContain("***5678");
    });
  });

  describe("credit card detection", () => {
    it("detects Visa number", () => {
      const result = scanner.scan("Card: 4532015112830366");
      expect(result.hasPII).toBe(true);
      expect(result.matches[0].category).toBe("credit-card");
      expect(result.riskLevel).toBe("critical");
    });

    it("detects formatted card number", () => {
      const result = scanner.scan("Visa: 4532-0151-1283-0366");
      expect(result.hasPII).toBe(true);
    });

    it("rejects invalid Luhn numbers", () => {
      const result = scanner.scan("Not a card: 4111111111111112");
      // Luhn check should fail for this number
      expect(result.matches.filter((m) => m.category === "credit-card").length).toBe(0);
    });

    it("redacts card keeping last 4 digits", () => {
      const result = scanner.scan("Card: 4532015112830366");
      expect(result.redactedText).toContain("***0366");
    });
  });

  describe("SSN detection", () => {
    it("detects SSN format", () => {
      const result = scanner.scan("SSN: 123-45-6789");
      expect(result.hasPII).toBe(true);
      expect(result.matches[0].category).toBe("ssn");
      expect(result.riskLevel).toBe("critical");
    });

    it("rejects invalid SSN starting with 000", () => {
      const result = scanner.scan("Number: 000-12-3456");
      const ssnMatches = result.matches.filter((m) => m.category === "ssn");
      expect(ssnMatches.length).toBe(0);
    });

    it("rejects invalid SSN starting with 666", () => {
      const result = scanner.scan("Number: 666-12-3456");
      const ssnMatches = result.matches.filter((m) => m.category === "ssn");
      expect(ssnMatches.length).toBe(0);
    });
  });

  describe("IP address detection", () => {
    it("detects IPv4 address", () => {
      const result = scanner.scan("Server at 192.168.1.100");
      expect(result.hasPII).toBe(true);
      expect(result.matches[0].category).toBe("ip-address");
    });

    it("ignores invalid IP octets", () => {
      const result = scanner.scan("Not IP: 999.999.999.999");
      const ipMatches = result.matches.filter((m) => m.category === "ip-address");
      expect(ipMatches.length).toBe(0);
    });
  });

  describe("auth token detection", () => {
    it("detects API keys", () => {
      const result = scanner.scan("api_key=sk_live_1234567890abcdef");
      expect(result.hasPII).toBe(true);
      expect(result.matches[0].category).toBe("auth-token");
      expect(result.riskLevel).toBe("critical");
    });

    it("detects access tokens", () => {
      const result = scanner.scan("access_token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkw");
      expect(result.hasPII).toBe(true);
    });

    it("detects password in text", () => {
      const result = scanner.scan("password=MySecretPassword123!");
      expect(result.hasPII).toBe(true);
    });
  });

  describe("date of birth detection", () => {
    it("detects English DOB pattern", () => {
      const result = scanner.scan("born: 15/03/1990");
      expect(result.hasPII).toBe(true);
      expect(result.matches[0].category).toBe("date-of-birth");
    });

    it("detects Vietnamese DOB pattern", () => {
      const result = scanner.scan("ngày sinh: 15/03/1990");
      expect(result.hasPII).toBe(true);
    });
  });

  describe("risk level assessment", () => {
    it("returns none for clean text", () => {
      const result = scanner.scan("This is a normal design description");
      expect(result.riskLevel).toBe("none");
    });

    it("returns critical for credit cards", () => {
      const result = scanner.scan("Card: 4532015112830366");
      expect(result.riskLevel).toBe("critical");
    });

    it("returns medium for email/phone", () => {
      const result = scanner.scan("Email: test@example.com");
      expect(result.riskLevel).toBe("medium");
    });
  });

  describe("hasPII quick check", () => {
    it("returns true for text with PII", () => {
      expect(scanner.hasPII("john@test.com")).toBe(true);
    });

    it("returns false for clean text", () => {
      expect(scanner.hasPII("Button component with hover state")).toBe(false);
    });
  });

  describe("redaction", () => {
    it("redacts multiple PII in one text", () => {
      const result = scanner.scan("Email john@test.com, call 0912345678");
      expect(result.redactedText).not.toContain("john@test.com");
      expect(result.redactedText).not.toContain("0912345678");
    });

    it("preserves non-PII text", () => {
      const result = scanner.scan("Button color: blue, email: a@b.com");
      expect(result.redactedText).toContain("Button color: blue");
    });

    it("uses custom redaction string", () => {
      const custom = new PIIScanner({ redactWith: "[REDACTED]" });
      const result = custom.scan("Email: user@test.com");
      expect(result.redactedText).toContain("[REDACTED]");
    });
  });

  describe("configuration", () => {
    it("scans only specified categories", () => {
      const emailOnly = new PIIScanner({ categories: ["email"] });
      const result = emailOnly.scan("Email: a@b.com, Phone: 0912345678");

      expect(result.matches.length).toBe(1);
      expect(result.matches[0].category).toBe("email");
    });

    it("supports custom patterns", () => {
      const custom = new PIIScanner({
        customPatterns: [
          { name: "employee-id", pattern: /EMP-\d{6}/g, category: "custom" },
        ],
      });

      const result = custom.scan("Employee: EMP-123456");
      expect(result.hasPII).toBe(true);
      expect(result.matches.some((m) => m.category === "custom")).toBe(true);
    });

    it("respects minimum confidence threshold", () => {
      const strict = new PIIScanner({ minConfidence: 0.95 });
      // IP addresses have 0.7 confidence — should be filtered out
      const result = strict.scan("Server: 192.168.1.1");
      const ipMatches = result.matches.filter((m) => m.category === "ip-address");
      expect(ipMatches.length).toBe(0);
    });
  });

  describe("getStats", () => {
    it("tracks scanning statistics", () => {
      scanner.scan("test@example.com");
      scanner.scan("No PII here");
      scanner.scan("Card: 4532015112830366");

      const stats = scanner.getStats();
      expect(stats.totalScans).toBe(3);
      expect(stats.piiFound).toBe(2);
      expect(stats.totalMatches).toBe(2);
      expect(stats.activePatterns).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      const result = scanner.scan("");
      expect(result.hasPII).toBe(false);
      expect(result.matches.length).toBe(0);
    });

    it("handles text with no matches", () => {
      const result = scanner.scan("Design system tokens: spacing-4, color-primary");
      expect(result.hasPII).toBe(false);
    });

    it("deduplicates overlapping matches", () => {
      // A phone number might match multiple patterns
      const result = scanner.scan("Phone: +84912345678");
      // Should not have duplicate entries for same text span
      const unique = new Set(result.matches.map((m) => `${m.startIndex}-${m.endIndex}`));
      expect(unique.size).toBe(result.matches.length);
    });
  });
});

describe("createPIIScanner", () => {
  it("creates scanner with defaults", () => {
    const scanner = createPIIScanner();
    expect(scanner.getStats().activePatterns).toBeGreaterThan(0);
  });

  it("creates scanner with custom config", () => {
    const scanner = createPIIScanner({ categories: ["email"] });
    expect(scanner.hasPII("test@example.com")).toBe(true);
  });
});

describe("createVietnamesePIIScanner", () => {
  it("creates scanner optimized for Vietnamese", () => {
    const scanner = createVietnamesePIIScanner();
    expect(scanner.getStats().activePatterns).toBeGreaterThan(0);
  });

  it("detects Vietnamese phone numbers", () => {
    const scanner = createVietnamesePIIScanner();
    expect(scanner.hasPII("0912345678")).toBe(true);
  });
});

/**
 * Self-Hosted Edition tests.
 */

import { describe, it, expect } from "vitest";
import {
  generateDefaultConfig,
  generateDockerCompose,
  generateEnvFile,
  createHealthCheck,
  validateLicense,
  generateBackupScript,
  getEditionLimits,
  getEditionFeatures,
  isFeatureEnabled,
} from "../selfHosted";

describe("Configuration Generator", () => {
  it("generates community config", () => {
    const config = generateDefaultConfig("community");
    expect(config.edition).toBe("community");
    expect(config.database.type).toBe("sqlite");
    expect(config.tls.enabled).toBe(false);
    expect(config.limits.maxUsers).toBe(5);
  });

  it("generates team config", () => {
    const config = generateDefaultConfig("team");
    expect(config.edition).toBe("team");
    expect(config.tls.enabled).toBe(true);
    expect(config.limits.maxUsers).toBe(25);
  });

  it("generates enterprise config", () => {
    const config = generateDefaultConfig("enterprise");
    expect(config.edition).toBe("enterprise");
    expect(config.database.type).toBe("postgres");
    expect(config.auth.type).toBe("sso");
    expect(config.auth.mfaRequired).toBe(true);
    expect(config.telemetry.enabled).toBe(false);
  });

  it("uses Groq as default AI provider", () => {
    const config = generateDefaultConfig("community");
    expect(config.ai.provider).toBe("groq");
    expect(config.ai.model).toContain("70b");
  });
});

describe("Docker Compose Generator", () => {
  it("generates valid YAML for community", () => {
    const config = generateDefaultConfig("community");
    const compose = generateDockerCompose(config);
    expect(compose).toContain("services:");
    expect(compose).toContain("designready-app");
    expect(compose).toContain("EDITION=community");
    expect(compose).toContain("healthcheck:");
    expect(compose).not.toContain("postgres"); // sqlite = no db service
  });

  it("includes postgres for enterprise", () => {
    const config = generateDefaultConfig("enterprise");
    const compose = generateDockerCompose(config);
    expect(compose).toContain("postgres:16-alpine");
    expect(compose).toContain("postgres-data:");
  });

  it("includes AI config", () => {
    const config = generateDefaultConfig("community");
    const compose = generateDockerCompose(config);
    expect(compose).toContain("AI_PROVIDER=groq");
    expect(compose).toContain("AI_MODEL=");
  });
});

describe("Environment File Generator", () => {
  it("generates .env content", () => {
    const config = generateDefaultConfig("team");
    const env = generateEnvFile(config);
    expect(env).toContain("NODE_ENV=production");
    expect(env).toContain("EDITION=team");
    expect(env).toContain("AI_PROVIDER=groq");
    expect(env).toContain("AI_API_KEY=your-api-key-here");
  });

  it("includes postgres password for enterprise", () => {
    const config = generateDefaultConfig("enterprise");
    const env = generateEnvFile(config);
    expect(env).toContain("DB_PASSWORD=");
  });
});

describe("Health Check", () => {
  it("reports healthy status", () => {
    const config = generateDefaultConfig("community");
    const health = createHealthCheck(config, 3600);
    expect(health.status).toBe("healthy");
    expect(health.checks.length).toBe(4);
    expect(health.uptime).toBe(3600);
    expect(health.version).toBe("1.1.6");
  });

  it("checks all services", () => {
    const config = generateDefaultConfig("enterprise");
    const health = createHealthCheck(config, 100);
    const names = health.checks.map(c => c.name);
    expect(names).toContain("application");
    expect(names).toContain("database");
    expect(names).toContain("ai-provider");
    expect(names).toContain("storage");
  });

  it("reports unhealthy if database fails", () => {
    const config = generateDefaultConfig("community");
    config.database.connectionString = "";
    const health = createHealthCheck(config, 0);
    expect(health.status).toBe("unhealthy");
  });
});

describe("License Validation", () => {
  it("validates community license", () => {
    const ts = Date.now();
    const license = validateLicense(`COM-5-${ts}-abc123`);
    expect(license.edition).toBe("community");
    expect(license.seats).toBe(5);
    expect(license.valid).toBe(true);
  });

  it("validates team license", () => {
    const ts = Date.now();
    const license = validateLicense(`TEAM-25-${ts}-xyz789`);
    expect(license.edition).toBe("team");
    expect(license.seats).toBe(25);
  });

  it("validates enterprise license", () => {
    const ts = Date.now();
    const license = validateLicense(`ENT-100-${ts}-ent999`);
    expect(license.edition).toBe("enterprise");
  });

  it("rejects invalid key format", () => {
    const license = validateLicense("invalid");
    expect(license.valid).toBe(false);
  });

  it("rejects expired license", () => {
    const oldTs = Date.now() - 400 * 24 * 60 * 60 * 1000; // 400 days ago
    const license = validateLicense(`TEAM-10-${oldTs}-hash`);
    expect(license.valid).toBe(false);
  });

  it("includes edition features", () => {
    const ts = Date.now();
    const license = validateLicense(`TEAM-10-${ts}-hash`);
    expect(license.features.length).toBeGreaterThan(0);
    expect(license.features).toContain("git-sync");
  });
});

describe("Backup Script Generator", () => {
  it("generates bash backup script", () => {
    const script = generateBackupScript({
      frequency: "daily",
      retentionDays: 30,
      destination: "/backups",
      encrypt: false,
    });
    expect(script).toContain("#!/bin/bash");
    expect(script).toContain("tar -czf");
    expect(script).toContain("-mtime +30");
    expect(script).not.toContain("openssl");
  });

  it("includes encryption when enabled", () => {
    const script = generateBackupScript({
      frequency: "hourly",
      retentionDays: 7,
      destination: "/secure-backups",
      encrypt: true,
    });
    expect(script).toContain("openssl enc -aes-256-cbc");
  });
});

describe("Edition Utilities", () => {
  it("getEditionLimits returns correct limits", () => {
    const limits = getEditionLimits("enterprise");
    expect(limits.maxUsers).toBe(-1); // unlimited
    expect(limits.concurrentGenerations).toBe(20);
  });

  it("getEditionFeatures returns feature list", () => {
    const features = getEditionFeatures("team");
    expect(features).toContain("git-sync");
    expect(features).toContain("sso");
  });

  it("isFeatureEnabled checks correctly", () => {
    expect(isFeatureEnabled("community", "basic-scanning")).toBe(true);
    expect(isFeatureEnabled("community", "sso")).toBe(false);
    expect(isFeatureEnabled("team", "basic-scanning")).toBe(true);
    expect(isFeatureEnabled("team", "sso")).toBe(true);
    expect(isFeatureEnabled("enterprise", "anything")).toBe(true);
  });
});

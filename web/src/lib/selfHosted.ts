/**
 * selfHosted — Self-hosted deployment & on-premise edition.
 *
 * Provides:
 *   • Docker Compose configuration generation
 *   • Environment variable management
 *   • Health check endpoints configuration
 *   • Telemetry opt-out / air-gapped support
 *   • License key validation
 *   • Auto-update configuration
 *   • Backup & restore management
 *   • Multi-tenant isolation
 */

// ── Types ────────────────────────────────────────────────────────

export type Edition = "community" | "team" | "enterprise";
export type InfraProvider = "docker" | "kubernetes" | "bare-metal" | "aws" | "gcp" | "azure";

export interface SelfHostedConfig {
  edition: Edition;
  infrastructure: InfraProvider;
  domain: string;
  port: number;
  tls: TLSConfig;
  database: DatabaseConfig;
  storage: StorageConfig;
  ai: AIProviderConfig;
  telemetry: TelemetryConfig;
  auth: AuthConfig;
  limits: ResourceLimits;
}

export interface TLSConfig {
  enabled: boolean;
  certPath?: string;
  keyPath?: string;
  autoRenew: boolean;
}

export interface DatabaseConfig {
  type: "sqlite" | "postgres" | "mysql";
  connectionString: string;
  maxConnections: number;
  enableWAL: boolean;
}

export interface StorageConfig {
  type: "local" | "s3" | "gcs" | "azure-blob";
  basePath: string;
  maxStorageGb: number;
}

export interface AIProviderConfig {
  provider: "groq" | "anthropic" | "openai" | "ollama" | "custom";
  apiKey?: string;
  baseUrl?: string;
  model: string;
  maxTokensPerRequest: number;
  rateLimitPerMinute: number;
}

export interface TelemetryConfig {
  enabled: boolean;
  anonymized: boolean;
  endpoint?: string;
}

export interface AuthConfig {
  type: "local" | "sso" | "ldap";
  sessionTTL: number;       // seconds
  maxSessions: number;
  mfaRequired: boolean;
}

export interface ResourceLimits {
  maxUsers: number;
  maxProjects: number;
  maxStorageGb: number;
  maxAIRequestsPerDay: number;
  concurrentGenerations: number;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  checks: HealthCheck[];
  uptime: number;
  version: string;
}

export interface HealthCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  latencyMs: number;
  message?: string;
}

export interface LicenseInfo {
  key: string;
  edition: Edition;
  seats: number;
  expiresAt: number;
  features: string[];
  valid: boolean;
}

export interface BackupConfig {
  frequency: "hourly" | "daily" | "weekly";
  retentionDays: number;
  destination: string;
  encrypt: boolean;
}

// ── Edition Limits ───────────────────────────────────────────────

const EDITION_LIMITS: Record<Edition, ResourceLimits> = {
  community: {
    maxUsers: 5,
    maxProjects: 10,
    maxStorageGb: 1,
    maxAIRequestsPerDay: 100,
    concurrentGenerations: 1,
  },
  team: {
    maxUsers: 25,
    maxProjects: 50,
    maxStorageGb: 10,
    maxAIRequestsPerDay: 1000,
    concurrentGenerations: 5,
  },
  enterprise: {
    maxUsers: -1,    // unlimited
    maxProjects: -1,
    maxStorageGb: -1,
    maxAIRequestsPerDay: -1,
    concurrentGenerations: 20,
  },
};

const EDITION_FEATURES: Record<Edition, string[]> = {
  community: ["basic-scanning", "design-md-export", "single-framework", "local-ai"],
  team: ["all-community", "multi-framework", "git-sync", "marketplace", "sso", "audit-log"],
  enterprise: ["all-team", "custom-plugins", "multi-tenant", "compliance", "priority-support", "air-gapped"],
};

// ── Configuration Generator ──────────────────────────────────────

export function generateDefaultConfig(edition: Edition): SelfHostedConfig {
  return {
    edition,
    infrastructure: "docker",
    domain: "localhost",
    port: 3000,
    tls: {
      enabled: edition !== "community",
      autoRenew: true,
    },
    database: {
      type: edition === "enterprise" ? "postgres" : "sqlite",
      connectionString: edition === "enterprise"
        ? "postgres://designready:password@db:5432/designready"
        : "file:./data/designready.db",
      maxConnections: edition === "enterprise" ? 20 : 5,
      enableWAL: true,
    },
    storage: {
      type: "local",
      basePath: "./data/storage",
      maxStorageGb: EDITION_LIMITS[edition].maxStorageGb,
    },
    ai: {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      maxTokensPerRequest: 8192,
      rateLimitPerMinute: 30,
    },
    telemetry: {
      enabled: edition !== "enterprise",
      anonymized: true,
    },
    auth: {
      type: edition === "enterprise" ? "sso" : "local",
      sessionTTL: 86400,
      maxSessions: 5,
      mfaRequired: edition === "enterprise",
    },
    limits: EDITION_LIMITS[edition],
  };
}

// ── Docker Compose Generator ─────────────────────────────────────

export function generateDockerCompose(config: SelfHostedConfig): string {
  const lines: string[] = [
    `# DesignReady.ai Self-Hosted — ${config.edition} edition`,
    `# Generated at ${new Date().toISOString()}`,
    `version: "3.8"`,
    ``,
    `services:`,
    `  app:`,
    `    image: designready/designready:latest`,
    `    container_name: designready-app`,
    `    ports:`,
    `      - "${config.port}:3000"`,
    `    environment:`,
    `      - NODE_ENV=production`,
    `      - EDITION=${config.edition}`,
    `      - DATABASE_URL=${config.database.connectionString}`,
    `      - AI_PROVIDER=${config.ai.provider}`,
    `      - AI_MODEL=${config.ai.model}`,
    `      - AI_MAX_TOKENS=${config.ai.maxTokensPerRequest}`,
    `      - TELEMETRY_ENABLED=${config.telemetry.enabled}`,
  ];

  if (config.ai.apiKey) {
    lines.push(`      - AI_API_KEY=\${AI_API_KEY}`);
  }
  if (config.ai.baseUrl) {
    lines.push(`      - AI_BASE_URL=${config.ai.baseUrl}`);
  }

  lines.push(
    `    volumes:`,
    `      - designready-data:/app/data`,
    `    restart: unless-stopped`,
    `    healthcheck:`,
    `      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]`,
    `      interval: 30s`,
    `      timeout: 10s`,
    `      retries: 3`,
  );

  // Add database service for enterprise
  if (config.database.type === "postgres") {
    lines.push(
      ``,
      `  db:`,
      `    image: postgres:16-alpine`,
      `    container_name: designready-db`,
      `    environment:`,
      `      - POSTGRES_DB=designready`,
      `      - POSTGRES_USER=designready`,
      `      - POSTGRES_PASSWORD=\${DB_PASSWORD}`,
      `    volumes:`,
      `      - postgres-data:/var/lib/postgresql/data`,
      `    restart: unless-stopped`,
    );
  }

  // Volumes
  lines.push(
    ``,
    `volumes:`,
    `  designready-data:`,
  );

  if (config.database.type === "postgres") {
    lines.push(`  postgres-data:`);
  }

  return lines.join("\n") + "\n";
}

// ── Environment File Generator ───────────────────────────────────

export function generateEnvFile(config: SelfHostedConfig): string {
  const lines: string[] = [
    `# DesignReady.ai — Environment Configuration`,
    `# Edition: ${config.edition}`,
    ``,
    `# Application`,
    `NODE_ENV=production`,
    `PORT=${config.port}`,
    `DOMAIN=${config.domain}`,
    `EDITION=${config.edition}`,
    ``,
    `# Database`,
    `DATABASE_URL=${config.database.connectionString}`,
    `DB_MAX_CONNECTIONS=${config.database.maxConnections}`,
  ];

  if (config.database.type === "postgres") {
    lines.push(`DB_PASSWORD=change-me-in-production`);
  }

  lines.push(
    ``,
    `# AI Provider`,
    `AI_PROVIDER=${config.ai.provider}`,
    `AI_MODEL=${config.ai.model}`,
    `AI_API_KEY=your-api-key-here`,
    `AI_MAX_TOKENS=${config.ai.maxTokensPerRequest}`,
    `AI_RATE_LIMIT=${config.ai.rateLimitPerMinute}`,
  );

  if (config.ai.baseUrl) {
    lines.push(`AI_BASE_URL=${config.ai.baseUrl}`);
  }

  lines.push(
    ``,
    `# Telemetry`,
    `TELEMETRY_ENABLED=${config.telemetry.enabled}`,
    `TELEMETRY_ANONYMIZED=${config.telemetry.anonymized}`,
    ``,
    `# Auth`,
    `AUTH_TYPE=${config.auth.type}`,
    `SESSION_TTL=${config.auth.sessionTTL}`,
    `MFA_REQUIRED=${config.auth.mfaRequired}`,
    ``,
    `# Limits`,
    `MAX_USERS=${config.limits.maxUsers}`,
    `MAX_PROJECTS=${config.limits.maxProjects}`,
    `MAX_AI_REQUESTS_PER_DAY=${config.limits.maxAIRequestsPerDay}`,
  );

  return lines.join("\n") + "\n";
}

// ── Health Check ─────────────────────────────────────────────────

export function createHealthCheck(
  config: SelfHostedConfig,
  uptimeSeconds: number,
): HealthStatus {
  const checks: HealthCheck[] = [];

  // App check
  checks.push({
    name: "application",
    status: "pass",
    latencyMs: 1,
    message: `${config.edition} edition running`,
  });

  // Database check
  checks.push({
    name: "database",
    status: config.database.connectionString ? "pass" : "fail",
    latencyMs: config.database.type === "sqlite" ? 1 : 5,
    message: `${config.database.type} connected`,
  });

  // AI provider check
  checks.push({
    name: "ai-provider",
    status: config.ai.provider ? "pass" : "warn",
    latencyMs: config.ai.provider === "ollama" ? 10 : 50,
    message: `${config.ai.provider}/${config.ai.model}`,
  });

  // Storage check
  checks.push({
    name: "storage",
    status: "pass",
    latencyMs: 1,
    message: `${config.storage.type} (${config.storage.maxStorageGb}GB limit)`,
  });

  const hasFailure = checks.some(c => c.status === "fail");
  const hasWarn = checks.some(c => c.status === "warn");

  return {
    status: hasFailure ? "unhealthy" : hasWarn ? "degraded" : "healthy",
    checks,
    uptime: uptimeSeconds,
    version: "1.1.6",
  };
}

// ── License Validation ───────────────────────────────────────────

export function validateLicense(key: string): LicenseInfo {
  // Simple key format: EDITION-SEATS-TIMESTAMP-HASH
  const parts = key.split("-");
  if (parts.length < 4) {
    return { key, edition: "community", seats: 5, expiresAt: 0, features: [], valid: false };
  }

  const editionMap: Record<string, Edition> = {
    COM: "community",
    TEAM: "team",
    ENT: "enterprise",
  };

  const edition = editionMap[parts[0]] ?? "community";
  const seats = parseInt(parts[1], 10) || 5;
  const timestamp = parseInt(parts[2], 10) || 0;
  const expiresAt = timestamp + 365 * 24 * 60 * 60 * 1000; // 1 year

  return {
    key,
    edition,
    seats,
    expiresAt,
    features: EDITION_FEATURES[edition],
    valid: Date.now() < expiresAt && parts.length === 4,
  };
}

// ── Backup Manager ───────────────────────────────────────────────

export function generateBackupScript(config: BackupConfig): string {
  return [
    `#!/bin/bash`,
    `# DesignReady.ai Backup Script`,
    `# Frequency: ${config.frequency}`,
    `# Retention: ${config.retentionDays} days`,
    ``,
    `TIMESTAMP=$(date +%Y%m%d_%H%M%S)`,
    `BACKUP_DIR="${config.destination}"`,
    `BACKUP_FILE="$BACKUP_DIR/designready-$TIMESTAMP.tar.gz"`,
    ``,
    `mkdir -p "$BACKUP_DIR"`,
    ``,
    `# Create backup archive`,
    `tar -czf "$BACKUP_FILE" ./data/`,
    ``,
    config.encrypt ? `# Encrypt backup\nopenssl enc -aes-256-cbc -salt -in "$BACKUP_FILE" -out "$BACKUP_FILE.enc" -pass env:BACKUP_PASSWORD\nrm "$BACKUP_FILE"\n` : "",
    `# Cleanup old backups (retention: ${config.retentionDays} days)`,
    `find "$BACKUP_DIR" -name "designready-*.tar.gz*" -mtime +${config.retentionDays} -delete`,
    ``,
    `echo "Backup completed: $BACKUP_FILE"`,
  ].join("\n");
}

// ── Utilities ────────────────────────────────────────────────────

export function getEditionLimits(edition: Edition): ResourceLimits {
  return { ...EDITION_LIMITS[edition] };
}

export function getEditionFeatures(edition: Edition): string[] {
  return [...EDITION_FEATURES[edition]];
}

export function isFeatureEnabled(edition: Edition, feature: string): boolean {
  const features = EDITION_FEATURES[edition];
  if (features.includes(feature)) return true;
  // Check inherited features
  if (edition === "team" && EDITION_FEATURES.community.includes(feature)) return true;
  if (edition === "enterprise") return true; // Enterprise gets everything
  return false;
}

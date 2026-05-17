/**
 * Usage Analytics & Feature Flags — SaaS Tier Management
 *
 * Tracks product usage for insights, enforces subscription limits,
 * and manages feature flags for gradual rollouts.
 *
 * Architecture:
 *   • Event-based analytics with batched flush
 *   • Subscription tiers: Free / Pro / Team / Enterprise
 *   • Feature flags with percentage rollouts and user targeting
 *   • Usage quotas with soft/hard limits
 *   • Privacy-first: no PII in analytics events
 *
 * Used by all modules to check tier access and track engagement.
 */

// ── Types ─────────────────────────────────────────────────────

export type SubscriptionTier = "free" | "pro" | "team" | "enterprise";

export interface AnalyticsEvent {
  name: string;
  timestamp: number;
  properties: Record<string, string | number | boolean>;
  tier: SubscriptionTier;
  sessionId: string;
}

export interface UsageQuota {
  feature: string;
  limit: number;
  used: number;
  resetAt: number; // Timestamp when quota resets
  period: "daily" | "weekly" | "monthly";
}

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  tiers: SubscriptionTier[];          // Which tiers have access
  rolloutPercentage: number;          // 0-100 for gradual rollout
  targetUsers?: string[];             // Specific user IDs (for beta)
  metadata?: Record<string, unknown>;
}

export interface TierLimits {
  maxGenerationsPerDay: number;
  maxDesignFiles: number;
  maxTeamMembers: number;
  maxMemoryRecords: number;
  maxAgentConcurrency: number;
  features: string[];
}

export interface AnalyticsConfig {
  enabled?: boolean;          // default true
  batchSize?: number;         // default 20
  flushIntervalMs?: number;   // default 30000 (30s)
  endpoint?: string;          // Analytics API endpoint
  anonymize?: boolean;        // default true — hash user IDs
}

// ── Tier Definitions ────────────────────────────────────────

const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxGenerationsPerDay: 10,
    maxDesignFiles: 3,
    maxTeamMembers: 1,
    maxMemoryRecords: 100,
    maxAgentConcurrency: 1,
    features: ["basic-generation", "design-analysis", "single-framework"],
  },
  pro: {
    maxGenerationsPerDay: 100,
    maxDesignFiles: 20,
    maxTeamMembers: 1,
    maxMemoryRecords: 5000,
    maxAgentConcurrency: 3,
    features: ["basic-generation", "design-analysis", "multi-framework", "evidence-memory", "custom-prompts", "export-code"],
  },
  team: {
    maxGenerationsPerDay: 500,
    maxDesignFiles: 100,
    maxTeamMembers: 20,
    maxMemoryRecords: 50000,
    maxAgentConcurrency: 5,
    features: ["basic-generation", "design-analysis", "multi-framework", "evidence-memory", "custom-prompts", "export-code", "collaboration", "shared-memory", "team-templates"],
  },
  enterprise: {
    maxGenerationsPerDay: -1, // Unlimited
    maxDesignFiles: -1,
    maxTeamMembers: -1,
    maxMemoryRecords: -1,
    maxAgentConcurrency: 10,
    features: ["basic-generation", "design-analysis", "multi-framework", "evidence-memory", "custom-prompts", "export-code", "collaboration", "shared-memory", "team-templates", "sso", "audit-log", "self-hosted", "priority-support", "custom-models"],
  },
};

// ── Analytics Engine ─────────────────────────────────────────

export class UsageAnalyticsEngine {
  private config: Required<AnalyticsConfig>;
  private currentTier: SubscriptionTier = "free";
  private userId: string = "";
  private sessionId: string;
  private eventBuffer: AnalyticsEvent[] = [];
  private quotas: Map<string, UsageQuota> = new Map();
  private featureFlags: Map<string, FeatureFlag> = new Map();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private stats = { totalEvents: 0, flushedEvents: 0, droppedEvents: 0, quotaExceeded: 0 };

  constructor(config?: AnalyticsConfig) {
    this.config = {
      enabled: config?.enabled ?? true,
      batchSize: config?.batchSize ?? 20,
      flushIntervalMs: config?.flushIntervalMs ?? 30000,
      endpoint: config?.endpoint ?? "",
      anonymize: config?.anonymize ?? true,
    };
    this.sessionId = this.generateSessionId();
  }

  /**
   * Initialize with user context
   */
  initialize(userId: string, tier: SubscriptionTier): void {
    this.userId = this.config.anonymize ? this.hashId(userId) : userId;
    this.currentTier = tier;
    this.initializeQuotas();

    if (this.config.enabled && this.config.flushIntervalMs > 0) {
      this.startAutoFlush();
    }
  }

  /**
   * Track an analytics event
   */
  track(name: string, properties: Record<string, string | number | boolean> = {}): void {
    if (!this.config.enabled) return;

    const event: AnalyticsEvent = {
      name,
      timestamp: Date.now(),
      properties: { ...properties, userId: this.userId },
      tier: this.currentTier,
      sessionId: this.sessionId,
    };

    this.eventBuffer.push(event);
    this.stats.totalEvents++;

    // Auto-flush when buffer is full
    if (this.eventBuffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Check if a feature is available for current tier
   */
  hasFeature(feature: string): boolean {
    // Check feature flags first
    const flag = this.featureFlags.get(feature);
    if (flag) {
      return this.evaluateFlag(flag);
    }

    // Fall back to tier limits
    const limits = TIER_LIMITS[this.currentTier];
    return limits.features.includes(feature);
  }

  /**
   * Check and consume quota
   * Returns true if within limits, false if exceeded
   */
  checkQuota(feature: string): boolean {
    const quota = this.quotas.get(feature);
    if (!quota) return true; // No quota configured = unlimited

    // Check if quota needs reset
    if (Date.now() > quota.resetAt) {
      this.resetQuota(quota);
    }

    // Unlimited check (-1 limit)
    if (quota.limit === -1) return true;

    if (quota.used >= quota.limit) {
      this.stats.quotaExceeded++;
      return false;
    }

    quota.used++;
    return true;
  }

  /**
   * Get current quota status for a feature
   */
  getQuotaStatus(feature: string): { used: number; limit: number; remaining: number; resetAt: number } | null {
    const quota = this.quotas.get(feature);
    if (!quota) return null;

    if (Date.now() > quota.resetAt) {
      this.resetQuota(quota);
    }

    return {
      used: quota.used,
      limit: quota.limit,
      remaining: quota.limit === -1 ? Infinity : Math.max(0, quota.limit - quota.used),
      resetAt: quota.resetAt,
    };
  }

  /**
   * Register a feature flag
   */
  registerFlag(flag: FeatureFlag): void {
    this.featureFlags.set(flag.name, flag);
  }

  /**
   * Register multiple feature flags
   */
  registerFlags(flags: FeatureFlag[]): void {
    for (const flag of flags) {
      this.featureFlags.set(flag.name, flag);
    }
  }

  /**
   * Update a feature flag
   */
  updateFlag(name: string, updates: Partial<FeatureFlag>): boolean {
    const flag = this.featureFlags.get(name);
    if (!flag) return false;
    this.featureFlags.set(name, { ...flag, ...updates, name });
    return true;
  }

  /**
   * Get tier limits
   */
  getTierLimits(tier?: SubscriptionTier): TierLimits {
    return { ...TIER_LIMITS[tier ?? this.currentTier] };
  }

  /**
   * Upgrade tier
   */
  upgradeTier(newTier: SubscriptionTier): void {
    this.currentTier = newTier;
    this.initializeQuotas();
    this.track("tier_upgraded", { newTier, previousTier: this.currentTier });
  }

  /**
   * Get current tier
   */
  getCurrentTier(): SubscriptionTier {
    return this.currentTier;
  }

  /**
   * Flush event buffer (send to analytics endpoint)
   */
  flush(): AnalyticsEvent[] {
    const events = [...this.eventBuffer];
    this.eventBuffer = [];
    this.stats.flushedEvents += events.length;

    // In production, would POST to analytics endpoint
    // For now, just return the flushed events
    return events;
  }

  /**
   * Get analytics stats
   */
  getStats(): typeof this.stats & { bufferSize: number; tier: SubscriptionTier; flagCount: number } {
    return {
      ...this.stats,
      bufferSize: this.eventBuffer.length,
      tier: this.currentTier,
      flagCount: this.featureFlags.size,
    };
  }

  /**
   * Stop auto-flush timer
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush(); // Final flush
  }

  // ========== Private Methods ==========

  private initializeQuotas(): void {
    const limits = TIER_LIMITS[this.currentTier];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    this.quotas.set("generations", {
      feature: "generations",
      limit: limits.maxGenerationsPerDay,
      used: 0,
      resetAt: now + dayMs,
      period: "daily",
    });

    this.quotas.set("design-files", {
      feature: "design-files",
      limit: limits.maxDesignFiles,
      used: 0,
      resetAt: now + 30 * dayMs,
      period: "monthly",
    });

    this.quotas.set("memory-records", {
      feature: "memory-records",
      limit: limits.maxMemoryRecords,
      used: 0,
      resetAt: now + 30 * dayMs,
      period: "monthly",
    });
  }

  private resetQuota(quota: UsageQuota): void {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    quota.used = 0;
    switch (quota.period) {
      case "daily":
        quota.resetAt = now + dayMs;
        break;
      case "weekly":
        quota.resetAt = now + 7 * dayMs;
        break;
      case "monthly":
        quota.resetAt = now + 30 * dayMs;
        break;
    }
  }

  private evaluateFlag(flag: FeatureFlag): boolean {
    if (!flag.enabled) return false;

    // Check tier access
    if (!flag.tiers.includes(this.currentTier)) return false;

    // Check specific user targeting
    if (flag.targetUsers && flag.targetUsers.length > 0) {
      return flag.targetUsers.includes(this.userId);
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const hash = this.simpleHash(`${flag.name}:${this.userId}`);
      return (hash % 100) < flag.rolloutPercentage;
    }

    return true;
  }

  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);
  }

  private generateSessionId(): string {
    return `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private hashId(id: string): string {
    // Simple hash for anonymization (not cryptographic)
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const chr = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return `anon_${Math.abs(hash).toString(36)}`;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

// ── Factory ──────────────────────────────────────────────────

/**
 * Create analytics engine with default config
 */
export function createUsageAnalytics(config?: AnalyticsConfig): UsageAnalyticsEngine {
  return new UsageAnalyticsEngine(config);
}

/**
 * Create analytics engine for testing (disabled auto-flush)
 */
export function createTestAnalytics(): UsageAnalyticsEngine {
  return new UsageAnalyticsEngine({ enabled: true, flushIntervalMs: 0, batchSize: 1000 });
}

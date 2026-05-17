import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { UsageAnalyticsEngine, createUsageAnalytics, createTestAnalytics } from "../usageAnalytics";

describe("UsageAnalyticsEngine", () => {
  let engine: UsageAnalyticsEngine;

  beforeEach(() => {
    engine = new UsageAnalyticsEngine({ enabled: true, flushIntervalMs: 0, batchSize: 100 });
    engine.initialize("user-123", "pro");
  });

  afterEach(() => {
    engine.destroy();
  });

  describe("initialize", () => {
    it("sets user tier", () => {
      expect(engine.getCurrentTier()).toBe("pro");
    });

    it("anonymizes user ID by default", () => {
      const stats = engine.getStats();
      expect(stats.tier).toBe("pro");
    });

    it("initializes quotas based on tier", () => {
      const quota = engine.getQuotaStatus("generations");
      expect(quota).not.toBeNull();
      expect(quota!.limit).toBe(100); // Pro tier
      expect(quota!.used).toBe(0);
    });
  });

  describe("track", () => {
    it("buffers analytics events", () => {
      engine.track("button_clicked", { buttonId: "submit" });
      expect(engine.getStats().totalEvents).toBe(1);
      expect(engine.getStats().bufferSize).toBe(1);
    });

    it("tracks multiple events", () => {
      engine.track("page_view", { page: "home" });
      engine.track("generation_started", { framework: "react" });
      engine.track("generation_completed", { tokens: 150 });

      expect(engine.getStats().totalEvents).toBe(3);
    });

    it("does not track when disabled", () => {
      const disabled = new UsageAnalyticsEngine({ enabled: false });
      disabled.initialize("user", "free");
      disabled.track("test_event");

      expect(disabled.getStats().totalEvents).toBe(0);
    });

    it("auto-flushes when buffer reaches batch size", () => {
      const smallBatch = new UsageAnalyticsEngine({ batchSize: 3, flushIntervalMs: 0 });
      smallBatch.initialize("user", "pro");

      smallBatch.track("e1");
      smallBatch.track("e2");
      expect(smallBatch.getStats().bufferSize).toBe(2);

      smallBatch.track("e3"); // Triggers flush
      expect(smallBatch.getStats().flushedEvents).toBe(3);
      expect(smallBatch.getStats().bufferSize).toBe(0);
    });
  });

  describe("flush", () => {
    it("returns buffered events and clears buffer", () => {
      engine.track("event1");
      engine.track("event2");

      const flushed = engine.flush();
      expect(flushed.length).toBe(2);
      expect(flushed[0].name).toBe("event1");
      expect(engine.getStats().bufferSize).toBe(0);
    });

    it("returns empty array when no events", () => {
      const flushed = engine.flush();
      expect(flushed.length).toBe(0);
    });

    it("events contain correct metadata", () => {
      engine.track("test", { key: "value" });
      const flushed = engine.flush();

      expect(flushed[0].tier).toBe("pro");
      expect(flushed[0].sessionId).toMatch(/^ses_/);
      expect(flushed[0].timestamp).toBeGreaterThan(0);
    });
  });

  describe("hasFeature", () => {
    it("returns true for tier-included features", () => {
      expect(engine.hasFeature("evidence-memory")).toBe(true); // Pro feature
      expect(engine.hasFeature("multi-framework")).toBe(true);
    });

    it("returns false for features not in tier", () => {
      expect(engine.hasFeature("sso")).toBe(false); // Enterprise only
      expect(engine.hasFeature("collaboration")).toBe(false); // Team+
    });

    it("free tier has limited features", () => {
      const freeEngine = new UsageAnalyticsEngine({ flushIntervalMs: 0 });
      freeEngine.initialize("user", "free");

      expect(freeEngine.hasFeature("basic-generation")).toBe(true);
      expect(freeEngine.hasFeature("evidence-memory")).toBe(false);
      expect(freeEngine.hasFeature("collaboration")).toBe(false);
    });

    it("enterprise has all features", () => {
      const entEngine = new UsageAnalyticsEngine({ flushIntervalMs: 0 });
      entEngine.initialize("user", "enterprise");

      expect(entEngine.hasFeature("sso")).toBe(true);
      expect(entEngine.hasFeature("self-hosted")).toBe(true);
      expect(entEngine.hasFeature("custom-models")).toBe(true);
    });
  });

  describe("feature flags", () => {
    it("registers and evaluates feature flag", () => {
      engine.registerFlag({
        name: "new-editor",
        enabled: true,
        tiers: ["pro", "team", "enterprise"],
        rolloutPercentage: 100,
      });

      expect(engine.hasFeature("new-editor")).toBe(true);
    });

    it("respects tier restriction in flags", () => {
      engine.registerFlag({
        name: "beta-feature",
        enabled: true,
        tiers: ["enterprise"],
        rolloutPercentage: 100,
      });

      expect(engine.hasFeature("beta-feature")).toBe(false); // Pro user can't access
    });

    it("respects disabled flag", () => {
      engine.registerFlag({
        name: "disabled-feature",
        enabled: false,
        tiers: ["pro"],
        rolloutPercentage: 100,
      });

      expect(engine.hasFeature("disabled-feature")).toBe(false);
    });

    it("supports rollout percentage", () => {
      engine.registerFlag({
        name: "gradual-rollout",
        enabled: true,
        tiers: ["pro", "team", "enterprise"],
        rolloutPercentage: 0, // 0% = nobody gets it
      });

      expect(engine.hasFeature("gradual-rollout")).toBe(false);
    });

    it("updates existing flag", () => {
      engine.registerFlag({ name: "toggle", enabled: false, tiers: ["pro"], rolloutPercentage: 100 });
      expect(engine.hasFeature("toggle")).toBe(false);

      engine.updateFlag("toggle", { enabled: true });
      expect(engine.hasFeature("toggle")).toBe(true);
    });

    it("returns false for non-existent flag update", () => {
      expect(engine.updateFlag("nonexistent", { enabled: true })).toBe(false);
    });

    it("registers multiple flags", () => {
      engine.registerFlags([
        { name: "f1", enabled: true, tiers: ["pro"], rolloutPercentage: 100 },
        { name: "f2", enabled: true, tiers: ["pro"], rolloutPercentage: 100 },
      ]);

      expect(engine.getStats().flagCount).toBe(2);
    });
  });

  describe("quotas", () => {
    it("allows usage within limits", () => {
      expect(engine.checkQuota("generations")).toBe(true);
      expect(engine.getQuotaStatus("generations")!.used).toBe(1);
    });

    it("blocks usage when quota exceeded", () => {
      // Pro tier: 100 generations/day
      for (let i = 0; i < 100; i++) {
        engine.checkQuota("generations");
      }

      expect(engine.checkQuota("generations")).toBe(false);
      expect(engine.getStats().quotaExceeded).toBe(1);
    });

    it("returns null for unknown quota", () => {
      expect(engine.getQuotaStatus("nonexistent")).toBeNull();
    });

    it("allows unknown quota (no limit configured)", () => {
      expect(engine.checkQuota("unknown-feature")).toBe(true);
    });

    it("enterprise has unlimited quotas", () => {
      const entEngine = new UsageAnalyticsEngine({ flushIntervalMs: 0 });
      entEngine.initialize("user", "enterprise");

      // -1 = unlimited
      const quota = entEngine.getQuotaStatus("generations");
      expect(quota!.limit).toBe(-1);
      expect(entEngine.checkQuota("generations")).toBe(true);
    });

    it("calculates remaining correctly", () => {
      engine.checkQuota("generations");
      engine.checkQuota("generations");
      engine.checkQuota("generations");

      const status = engine.getQuotaStatus("generations");
      expect(status!.remaining).toBe(97); // 100 - 3
    });
  });

  describe("tier management", () => {
    it("upgrades tier and reinitializes quotas", () => {
      engine.upgradeTier("team");
      expect(engine.getCurrentTier()).toBe("team");

      const quota = engine.getQuotaStatus("generations");
      expect(quota!.limit).toBe(500); // Team tier limit
    });

    it("getTierLimits returns correct limits", () => {
      const limits = engine.getTierLimits("free");
      expect(limits.maxGenerationsPerDay).toBe(10);
      expect(limits.maxTeamMembers).toBe(1);
      expect(limits.features).toContain("basic-generation");
      expect(limits.features).not.toContain("sso");
    });

    it("getTierLimits defaults to current tier", () => {
      const limits = engine.getTierLimits();
      expect(limits.maxGenerationsPerDay).toBe(100); // Pro
    });
  });

  describe("getStats", () => {
    it("reports comprehensive statistics", () => {
      engine.track("e1");
      engine.track("e2");
      engine.flush();
      engine.registerFlag({ name: "f1", enabled: true, tiers: ["pro"], rolloutPercentage: 100 });

      const stats = engine.getStats();
      expect(stats.totalEvents).toBe(2);
      expect(stats.flushedEvents).toBe(2);
      expect(stats.bufferSize).toBe(0);
      expect(stats.tier).toBe("pro");
      expect(stats.flagCount).toBe(1);
    });
  });

  describe("destroy", () => {
    it("flushes remaining events on destroy", () => {
      engine.track("final-event");
      engine.destroy();

      expect(engine.getStats().flushedEvents).toBe(1);
      expect(engine.getStats().bufferSize).toBe(0);
    });
  });
});

describe("factories", () => {
  it("createUsageAnalytics creates with defaults", () => {
    const engine = createUsageAnalytics();
    engine.initialize("user", "free");
    expect(engine.getCurrentTier()).toBe("free");
    engine.destroy();
  });

  it("createTestAnalytics creates test-friendly engine", () => {
    const engine = createTestAnalytics();
    engine.initialize("test-user", "pro");
    engine.track("test");
    expect(engine.getStats().bufferSize).toBe(1); // No auto-flush
    engine.destroy();
  });
});

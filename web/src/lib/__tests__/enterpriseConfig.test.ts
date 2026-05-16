/**
 * Enterprise configuration tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EnterpriseManager,
  AuditLogger,
  RBACEngine,
  ComplianceEngine,
} from "../enterpriseConfig";
import type { SSOConfig, DeploymentConfig } from "../enterpriseConfig";

describe("EnterpriseManager", () => {
  let manager: EnterpriseManager;

  beforeEach(() => {
    manager = new EnterpriseManager();
  });

  describe("SSO configuration", () => {
    const validSSO: SSOConfig = {
      provider: "okta",
      entityId: "https://app.designready.ai",
      ssoUrl: "https://company.okta.com/sso/saml",
      certificate: "MIICpDCCAYwCCQDU...",
      allowedDomains: ["company.com"],
      autoProvision: true,
      defaultRole: "role-editor",
    };

    it("configures SSO", () => {
      manager.configureSSO(validSSO);
      expect(manager.getSSOConfig()?.provider).toBe("okta");
    });

    it("validates valid SSO config", () => {
      const errors = manager.validateSSOConfig(validSSO);
      expect(errors.length).toBe(0);
    });

    it("rejects SSO without entity ID", () => {
      const errors = manager.validateSSOConfig({ ...validSSO, entityId: "" });
      expect(errors).toContain("Entity ID is required");
    });

    it("rejects non-HTTPS SSO URL", () => {
      const errors = manager.validateSSOConfig({ ...validSSO, ssoUrl: "http://insecure.com" });
      expect(errors).toContain("SSO URL must use HTTPS");
    });

    it("rejects empty allowed domains", () => {
      const errors = manager.validateSSOConfig({ ...validSSO, allowedDomains: [] });
      expect(errors).toContain("At least one allowed domain is required");
    });

    it("logs SSO configuration as audit event", () => {
      manager.configureSSO(validSSO);
      const events = manager.audit.getRecent(1);
      expect(events[0].action).toBe("sso.configure");
    });
  });

  describe("deployment management", () => {
    it("returns default deployment config", () => {
      const config = manager.getDeployment();
      expect(config.mode).toBe("cloud");
      expect(config.encryptionAtRest).toBe(true);
    });

    it("accepts custom deployment config", () => {
      const custom = new EnterpriseManager({ mode: "self-hosted", region: "eu-west-1" });
      expect(custom.getDeployment().mode).toBe("self-hosted");
      expect(custom.getDeployment().region).toBe("eu-west-1");
    });

    it("updates deployment config", () => {
      manager.updateDeployment({ mode: "air-gapped", retentionDays: 365 });
      const config = manager.getDeployment();
      expect(config.mode).toBe("air-gapped");
      expect(config.retentionDays).toBe(365);
    });

    it("logs deployment updates", () => {
      manager.updateDeployment({ mode: "hybrid" });
      const events = manager.audit.getRecent(1);
      expect(events[0].action).toBe("deployment.update");
    });
  });

  describe("state export", () => {
    it("exports full state", () => {
      const state = manager.getState();
      expect(state.deployment).toBeDefined();
      expect(state.roles.length).toBeGreaterThan(0);
      expect(state.sso).toBeNull();
    });
  });
});

describe("AuditLogger", () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger(100);
  });

  it("logs events", () => {
    logger.log({ userId: "user-1", action: "login", resource: "auth", details: {}, outcome: "success" });
    expect(logger.size).toBe(1);
  });

  it("assigns unique IDs", () => {
    const e1 = logger.log({ userId: "u1", action: "a", resource: "r", details: {}, outcome: "success" });
    const e2 = logger.log({ userId: "u1", action: "a", resource: "r", details: {}, outcome: "success" });
    expect(e1.id).not.toBe(e2.id);
  });

  it("queries by userId", () => {
    logger.log({ userId: "alice", action: "read", resource: "ds", details: {}, outcome: "success" });
    logger.log({ userId: "bob", action: "write", resource: "ds", details: {}, outcome: "success" });
    const results = logger.query({ userId: "alice" });
    expect(results.length).toBe(1);
  });

  it("queries by action", () => {
    logger.log({ userId: "u1", action: "login", resource: "auth", details: {}, outcome: "success" });
    logger.log({ userId: "u1", action: "logout", resource: "auth", details: {}, outcome: "success" });
    expect(logger.query({ action: "login" }).length).toBe(1);
  });

  it("queries by outcome", () => {
    logger.log({ userId: "u1", action: "delete", resource: "ds", details: {}, outcome: "denied" });
    logger.log({ userId: "u1", action: "read", resource: "ds", details: {}, outcome: "success" });
    expect(logger.query({ outcome: "denied" }).length).toBe(1);
  });

  it("returns recent events in reverse order", () => {
    logger.log({ userId: "u1", action: "first", resource: "r", details: {}, outcome: "success" });
    logger.log({ userId: "u1", action: "second", resource: "r", details: {}, outcome: "success" });
    const recent = logger.getRecent(2);
    expect(recent[0].action).toBe("second");
  });

  it("respects max events limit", () => {
    const small = new AuditLogger(5);
    for (let i = 0; i < 10; i++) {
      small.log({ userId: "u1", action: `action-${i}`, resource: "r", details: {}, outcome: "success" });
    }
    expect(small.size).toBe(5);
  });

  it("clears all events", () => {
    logger.log({ userId: "u1", action: "a", resource: "r", details: {}, outcome: "success" });
    logger.clear();
    expect(logger.size).toBe(0);
  });

  it("exports events", () => {
    logger.log({ userId: "u1", action: "a", resource: "r", details: {}, outcome: "success" });
    const exported = logger.export();
    expect(exported.length).toBe(1);
  });
});

describe("RBACEngine", () => {
  let rbac: RBACEngine;

  beforeEach(() => {
    rbac = new RBACEngine();
  });

  it("has built-in roles", () => {
    expect(rbac.getRoles().length).toBe(3);
    expect(rbac.getRole("role-admin")).toBeDefined();
    expect(rbac.getRole("role-editor")).toBeDefined();
    expect(rbac.getRole("role-viewer")).toBeDefined();
  });

  it("adds custom roles", () => {
    rbac.addRole({
      id: "role-custom",
      name: "Custom",
      description: "Custom role",
      permissions: [{ resource: "templates", actions: ["read"] }],
      isBuiltIn: false,
    });
    expect(rbac.getRoles().length).toBe(4);
  });

  it("prevents removing built-in roles", () => {
    expect(rbac.removeRole("role-admin")).toBe(false);
  });

  it("removes custom roles", () => {
    rbac.addRole({ id: "r-custom", name: "C", description: "", permissions: [], isBuiltIn: false });
    expect(rbac.removeRole("r-custom")).toBe(true);
  });

  it("assigns roles to users", () => {
    rbac.assignRole("user-1", "role-editor");
    const roles = rbac.getUserRoles("user-1");
    expect(roles.length).toBe(1);
    expect(roles[0].name).toBe("Editor");
  });

  it("revokes roles from users", () => {
    rbac.assignRole("user-1", "role-editor");
    rbac.revokeRole("user-1", "role-editor");
    expect(rbac.getUserRoles("user-1").length).toBe(0);
  });

  it("checks permissions - admin has all", () => {
    rbac.assignRole("admin-user", "role-admin");
    expect(rbac.checkPermission("admin-user", "design-system", "write")).toBe(true);
    expect(rbac.checkPermission("admin-user", "anything", "admin")).toBe(true);
  });

  it("checks permissions - viewer read-only", () => {
    rbac.assignRole("viewer-user", "role-viewer");
    expect(rbac.checkPermission("viewer-user", "design-system", "read")).toBe(true);
    expect(rbac.checkPermission("viewer-user", "design-system", "write")).toBe(false);
  });

  it("denies permissions for users with no roles", () => {
    expect(rbac.checkPermission("nobody", "design-system", "read")).toBe(false);
  });

  it("prevents assigning non-existent roles", () => {
    expect(rbac.assignRole("user-1", "role-fake")).toBe(false);
  });
});

describe("ComplianceEngine", () => {
  let engine: ComplianceEngine;

  const secureConfig: DeploymentConfig = {
    mode: "self-hosted",
    region: "eu-west-1",
    dataResidency: "eu-west",
    encryptionAtRest: true,
    encryptionInTransit: true,
    backupFrequency: "daily",
    retentionDays: 90,
  };

  beforeEach(() => {
    engine = new ComplianceEngine();
  });

  it("reports SOC2 compliant for secure config", () => {
    const report = engine.checkCompliance(secureConfig, "soc2");
    expect(report.status).toBe("compliant");
    expect(report.score).toBe(100);
  });

  it("reports GDPR compliant for EU config", () => {
    const report = engine.checkCompliance(secureConfig, "gdpr");
    expect(report.status).toBe("compliant");
  });

  it("reports GDPR non-compliant for US config", () => {
    const usConfig = { ...secureConfig, dataResidency: "us-east" };
    const report = engine.checkCompliance(usConfig, "gdpr");
    expect(report.status).not.toBe("compliant");
  });

  it("reports HIPAA requires self-hosted", () => {
    const cloudConfig = { ...secureConfig, mode: "cloud" as const };
    const report = engine.checkCompliance(cloudConfig, "hipaa");
    const airGapCheck = report.checks.find(c => c.id === "air-gap");
    expect(airGapCheck?.status).toBe("fail");
  });

  it("generates score based on checks", () => {
    const report = engine.checkCompliance(secureConfig, "soc2");
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it("includes check details", () => {
    const report = engine.checkCompliance(secureConfig, "gdpr");
    expect(report.checks.length).toBeGreaterThan(0);
    expect(report.checks[0].name).toBeDefined();
  });
});

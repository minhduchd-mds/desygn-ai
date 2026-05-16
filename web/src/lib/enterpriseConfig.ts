/**
 * enterpriseConfig — Enterprise self-hosted deployment management.
 *
 * Provides:
 *   • SSO/SAML configuration (Okta, Azure AD, Google Workspace)
 *   • Audit trail logging with structured events
 *   • Deployment configuration (on-prem, private cloud, air-gapped)
 *   • Role-based access control (RBAC) with granular permissions
 *   • Compliance reporting (SOC2, GDPR, HIPAA markers)
 *
 * Architecture:
 *   EnterpriseConfig → DeploymentManager + AuditLogger + RBACEngine
 */

// ── Types ────────────────────────────────────────────────────────

export type SSOProvider = "okta" | "azure-ad" | "google" | "saml-generic" | "oidc";
export type DeploymentMode = "cloud" | "self-hosted" | "air-gapped" | "hybrid";
export type ComplianceStandard = "soc2" | "gdpr" | "hipaa" | "iso27001" | "fedramp";

export interface SSOConfig {
  provider: SSOProvider;
  entityId: string;
  ssoUrl: string;
  certificate: string;
  allowedDomains: string[];
  autoProvision: boolean;
  defaultRole: string;
}

export interface DeploymentConfig {
  mode: DeploymentMode;
  region: string;
  dataResidency: string;
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  backupFrequency: "hourly" | "daily" | "weekly";
  retentionDays: number;
  customDomain?: string;
  proxyUrl?: string;
}

export interface Permission {
  resource: string;
  actions: ("read" | "write" | "delete" | "admin")[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isBuiltIn: boolean;
}

export interface AuditEvent {
  id: string;
  timestamp: number;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  ip?: string;
  outcome: "success" | "failure" | "denied";
}

export interface ComplianceReport {
  standard: ComplianceStandard;
  generatedAt: number;
  status: "compliant" | "non-compliant" | "partial";
  checks: ComplianceCheck[];
  score: number;
}

export interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  status: "pass" | "fail" | "warning";
  details?: string;
}

export interface EnterpriseState {
  sso: SSOConfig | null;
  deployment: DeploymentConfig;
  roles: Role[];
  auditLog: AuditEvent[];
  compliance: ComplianceReport[];
}

// ── Built-in Roles ───────────────────────────────────────────────

const BUILT_IN_ROLES: Role[] = [
  {
    id: "role-admin",
    name: "Admin",
    description: "Full system access",
    permissions: [
      { resource: "*", actions: ["read", "write", "delete", "admin"] },
    ],
    isBuiltIn: true,
  },
  {
    id: "role-editor",
    name: "Editor",
    description: "Can modify design systems and generate code",
    permissions: [
      { resource: "design-system", actions: ["read", "write"] },
      { resource: "code-generation", actions: ["read", "write"] },
      { resource: "templates", actions: ["read", "write"] },
      { resource: "audit-log", actions: ["read"] },
    ],
    isBuiltIn: true,
  },
  {
    id: "role-viewer",
    name: "Viewer",
    description: "Read-only access",
    permissions: [
      { resource: "design-system", actions: ["read"] },
      { resource: "code-generation", actions: ["read"] },
      { resource: "templates", actions: ["read"] },
    ],
    isBuiltIn: true,
  },
];

// ── Audit Logger ─────────────────────────────────────────────────

export class AuditLogger {
  private events: AuditEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents = 10000) {
    this.maxEvents = maxEvents;
  }

  log(event: Omit<AuditEvent, "id" | "timestamp">): AuditEvent {
    const full: AuditEvent = {
      ...event,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    this.events.push(full);

    // Ring buffer — drop oldest when exceeding max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    return full;
  }

  query(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    outcome?: AuditEvent["outcome"];
    from?: number;
    to?: number;
  }): AuditEvent[] {
    return this.events.filter(e => {
      if (filters.userId && e.userId !== filters.userId) return false;
      if (filters.action && e.action !== filters.action) return false;
      if (filters.resource && e.resource !== filters.resource) return false;
      if (filters.outcome && e.outcome !== filters.outcome) return false;
      if (filters.from && e.timestamp < filters.from) return false;
      if (filters.to && e.timestamp > filters.to) return false;
      return true;
    });
  }

  getRecent(count = 50): AuditEvent[] {
    return this.events.slice(-count).reverse();
  }

  get size(): number {
    return this.events.length;
  }

  clear(): void {
    this.events = [];
  }

  export(): AuditEvent[] {
    return [...this.events];
  }
}

// ── RBAC Engine ──────────────────────────────────────────────────

export class RBACEngine {
  private roles: Map<string, Role> = new Map();
  private userRoles: Map<string, string[]> = new Map();

  constructor() {
    for (const role of BUILT_IN_ROLES) {
      this.roles.set(role.id, role);
    }
  }

  addRole(role: Role): void {
    this.roles.set(role.id, role);
  }

  removeRole(roleId: string): boolean {
    const role = this.roles.get(roleId);
    if (!role || role.isBuiltIn) return false;
    this.roles.delete(roleId);
    return true;
  }

  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  getRoles(): Role[] {
    return [...this.roles.values()];
  }

  assignRole(userId: string, roleId: string): boolean {
    if (!this.roles.has(roleId)) return false;
    const current = this.userRoles.get(userId) || [];
    if (!current.includes(roleId)) {
      current.push(roleId);
      this.userRoles.set(userId, current);
    }
    return true;
  }

  revokeRole(userId: string, roleId: string): boolean {
    const current = this.userRoles.get(userId);
    if (!current) return false;
    const idx = current.indexOf(roleId);
    if (idx === -1) return false;
    current.splice(idx, 1);
    this.userRoles.set(userId, current);
    return true;
  }

  getUserRoles(userId: string): Role[] {
    const roleIds = this.userRoles.get(userId) || [];
    return roleIds.map(id => this.roles.get(id)).filter(Boolean) as Role[];
  }

  checkPermission(userId: string, resource: string, action: Permission["actions"][number]): boolean {
    const roles = this.getUserRoles(userId);
    for (const role of roles) {
      for (const perm of role.permissions) {
        if (perm.resource === "*" || perm.resource === resource) {
          if (perm.actions.includes(action)) return true;
        }
      }
    }
    return false;
  }
}

// ── Compliance Engine ────────────────────────────────────────────

export class ComplianceEngine {
  checkCompliance(
    config: DeploymentConfig,
    standard: ComplianceStandard,
  ): ComplianceReport {
    const checks = this.getChecksForStandard(standard, config);
    const passed = checks.filter(c => c.status === "pass").length;
    const score = checks.length > 0 ? Math.round((passed / checks.length) * 100) : 0;

    let status: ComplianceReport["status"];
    if (score === 100) status = "compliant";
    else if (score >= 70) status = "partial";
    else status = "non-compliant";

    return {
      standard,
      generatedAt: Date.now(),
      status,
      checks,
      score,
    };
  }

  private getChecksForStandard(standard: ComplianceStandard, config: DeploymentConfig): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];

    // Common checks across standards
    checks.push({
      id: "enc-rest",
      name: "Encryption at Rest",
      description: "Data must be encrypted when stored",
      status: config.encryptionAtRest ? "pass" : "fail",
    });

    checks.push({
      id: "enc-transit",
      name: "Encryption in Transit",
      description: "Data must be encrypted during transmission",
      status: config.encryptionInTransit ? "pass" : "fail",
    });

    checks.push({
      id: "backup",
      name: "Regular Backups",
      description: "System must have automated backups",
      status: config.backupFrequency !== "weekly" ? "pass" : "warning",
      details: config.backupFrequency === "weekly" ? "Weekly backups may not meet SLA" : undefined,
    });

    // Standard-specific checks
    if (standard === "gdpr") {
      checks.push({
        id: "data-residency",
        name: "EU Data Residency",
        description: "Data must be stored within EU boundaries",
        status: isEURegion(config.dataResidency) ? "pass" : "fail",
        details: `Data residency: ${config.dataResidency}`,
      });

      checks.push({
        id: "retention",
        name: "Data Retention Policy",
        description: "Retention period must be defined and reasonable",
        status: config.retentionDays <= 365 ? "pass" : "warning",
      });
    }

    if (standard === "hipaa") {
      checks.push({
        id: "air-gap",
        name: "Network Isolation",
        description: "Healthcare data must be isolated",
        status: config.mode === "air-gapped" || config.mode === "self-hosted" ? "pass" : "fail",
      });
    }

    if (standard === "soc2") {
      checks.push({
        id: "monitoring",
        name: "Audit Logging",
        description: "All access must be logged",
        status: "pass", // We always have audit logging
      });

      checks.push({
        id: "access-control",
        name: "Access Control",
        description: "Role-based access must be enforced",
        status: "pass", // RBAC is built-in
      });
    }

    if (standard === "fedramp") {
      checks.push({
        id: "gov-cloud",
        name: "Government Cloud",
        description: "Must run on FedRAMP-authorized infrastructure",
        status: config.mode === "self-hosted" || config.mode === "air-gapped" ? "pass" : "fail",
      });
    }

    return checks;
  }
}

function isEURegion(region: string): boolean {
  const euRegions = ["eu-west", "eu-central", "eu-north", "eu-south", "europe"];
  return euRegions.some(r => region.toLowerCase().includes(r));
}

// ── Enterprise Manager ───────────────────────────────────────────

export class EnterpriseManager {
  readonly audit = new AuditLogger();
  readonly rbac = new RBACEngine();
  readonly compliance = new ComplianceEngine();

  private ssoConfig: SSOConfig | null = null;
  private deploymentConfig: DeploymentConfig;

  constructor(deployment?: Partial<DeploymentConfig>) {
    this.deploymentConfig = {
      mode: "cloud",
      region: "us-east-1",
      dataResidency: "us-east",
      encryptionAtRest: true,
      encryptionInTransit: true,
      backupFrequency: "daily",
      retentionDays: 90,
      ...deployment,
    };
  }

  // SSO Management
  configureSSO(config: SSOConfig): void {
    this.ssoConfig = config;
    this.audit.log({
      userId: "system",
      action: "sso.configure",
      resource: "auth",
      details: { provider: config.provider, domains: config.allowedDomains },
      outcome: "success",
    });
  }

  getSSOConfig(): SSOConfig | null {
    return this.ssoConfig;
  }

  validateSSOConfig(config: SSOConfig): string[] {
    const errors: string[] = [];
    if (!config.entityId) errors.push("Entity ID is required");
    if (!config.ssoUrl) errors.push("SSO URL is required");
    if (!config.certificate) errors.push("Certificate is required");
    if (!config.allowedDomains.length) errors.push("At least one allowed domain is required");
    if (config.ssoUrl && !config.ssoUrl.startsWith("https://")) {
      errors.push("SSO URL must use HTTPS");
    }
    return errors;
  }

  // Deployment Management
  getDeployment(): DeploymentConfig {
    return { ...this.deploymentConfig };
  }

  updateDeployment(updates: Partial<DeploymentConfig>): void {
    this.deploymentConfig = { ...this.deploymentConfig, ...updates };
    this.audit.log({
      userId: "system",
      action: "deployment.update",
      resource: "infrastructure",
      details: updates,
      outcome: "success",
    });
  }

  // Compliance
  runComplianceCheck(standard: ComplianceStandard): ComplianceReport {
    return this.compliance.checkCompliance(this.deploymentConfig, standard);
  }

  // State export
  getState(): EnterpriseState {
    return {
      sso: this.ssoConfig,
      deployment: this.deploymentConfig,
      roles: this.rbac.getRoles(),
      auditLog: this.audit.export(),
      compliance: [],
    };
  }
}

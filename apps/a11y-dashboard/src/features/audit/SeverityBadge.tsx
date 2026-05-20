/**
 * SeverityBadge — a @desygn/ui Badge tinted by audit severity.
 *
 * Maps `Severity` → badge tone via the design-system `severityToTone` helper
 * and renders a localized label.
 */

import { Badge, severityToTone } from "@desygn/ui";
import type { Severity } from "@desygn/audit-engine";
import { useTranslation } from "../../i18n/index.js";
import type { TranslationKey } from "../../i18n/index.js";

export interface SeverityBadgeProps {
  severity: Severity;
}

const LABEL_KEY: Record<Severity, TranslationKey> = {
  critical: "audit.severity.critical",
  serious: "audit.severity.serious",
  moderate: "audit.severity.moderate",
  minor: "audit.severity.minor",
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const { t } = useTranslation();
  return <Badge tone={severityToTone(severity)}>{t(LABEL_KEY[severity])}</Badge>;
}

/**
 * IssueList — renders a list of audit issues.
 *
 * Each row shows a severity badge, the human-readable message, the WCAG
 * criterion and the offending node name. Renders an empty state when there
 * are no issues.
 */

import type { AuditIssue } from "@desygn/audit-engine";
import { useTranslation } from "../../i18n/index.js";
import { SeverityBadge } from "./SeverityBadge.js";
import styles from "./IssueList.module.css";

export interface IssueListProps {
  issues: AuditIssue[];
}

export function IssueList({ issues }: IssueListProps) {
  const { t } = useTranslation();

  if (issues.length === 0) {
    return <p className={styles.empty}>{t("audit.issues.empty")}</p>;
  }

  return (
    <ul className={styles.list}>
      {issues.map((issue) => (
        <li key={issue.id} className={styles.item}>
          <div className={styles.head}>
            <SeverityBadge severity={issue.severity} />
            <p className={styles.message}>{issue.message}</p>
          </div>
          <div className={styles.meta}>
            <span>
              <span className={styles.metaTerm}>{t("audit.issues.wcag")}: </span>
              {issue.wcagCriterion}
            </span>
            <span>
              <span className={styles.metaTerm}>{t("audit.issues.node")}: </span>
              {issue.nodeName}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * AuditList — a table of recent audits with an empty state.
 *
 * There is no list endpoint yet, so `audits` defaults to an empty array and
 * the component renders its empty state. When rows are supplied (e.g. once a
 * backend lands, or in tests/stories) it renders an accessible table.
 */

import { Badge, Card, severityToTone } from "@desygn/ui";
import { useTranslation } from "../../i18n/index.js";
import styles from "./AuditList.module.css";

export interface AuditListRow {
  id: string;
  score: number;
  source: string;
  issueCount: number;
  /** ISO date string. */
  createdAt: string;
}

export interface AuditListProps {
  audits?: AuditListRow[];
}

/** Pick a badge tone for a score, reusing the severity scale. */
function toneForScore(score: number) {
  if (score >= 90) return severityToTone("minor");
  if (score >= 70) return severityToTone("moderate");
  if (score >= 50) return severityToTone("serious");
  return severityToTone("critical");
}

export function AuditList({ audits = [] }: AuditListProps) {
  const { t } = useTranslation();

  if (audits.length === 0) {
    return (
      <Card variant="outlined">
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{t("audit.list.empty")}</p>
          <p className={styles.emptyHint}>{t("audit.list.emptyHint")}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>{t("audit.list.heading")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("audit.list.colScore")}</th>
            <th scope="col">{t("audit.list.colSource")}</th>
            <th scope="col">{t("audit.list.colIssues")}</th>
            <th scope="col">{t("audit.list.colDate")}</th>
          </tr>
        </thead>
        <tbody>
          {audits.map((row) => (
            <tr key={row.id}>
              <td>
                <Badge tone={toneForScore(row.score)}>{row.score}</Badge>
              </td>
              <td>{row.source}</td>
              <td>{row.issueCount}</td>
              <td>{new Date(row.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

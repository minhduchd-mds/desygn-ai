import type { ScanIssue } from "../../shared/types";
import { LocateIcon } from "./LocateIcon";
import styles from "./IssueList.module.scss";

interface IssueListProps {
  issues: ScanIssue[];
}

const SEVERITY_CLASS: Record<string, string> = {
  critical: styles.severityCritical,
  warning: styles.severityWarning,
  info: styles.severityInfo,
};

function severityIcon(severity: "critical" | "warning" | "info"): string {
  switch (severity) {
    case "critical":
      return "!!";
    case "warning":
      return "!";
    case "info":
      return "i";
  }
}

function selectInFigma(nodeId: string) {
  parent.postMessage({ pluginMessage: { type: "select-node", nodeId } }, "*");
}

function CrosshairButton({ nodeId }: { nodeId: string }) {
  return (
    <button
      className={styles.btnCrosshair}
      onClick={(e) => {
        e.stopPropagation();
        selectInFigma(nodeId);
      }}
      title="Select in Figma"
    >
      <LocateIcon size={14} />
    </button>
  );
}

export function IssueList({ issues }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <div className={styles.listEmpty}>No issues found. Your design is well-prepared for AI code generation.</div>
    );
  }

  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <div className={styles.list}>
      <div className={styles.header}>
        <span className={styles.count}>{issues.length} issues</span>
        {critical.length > 0 && <span className={`${styles.badge} ${styles.severityCritical}`}>{critical.length} critical</span>}
        {warnings.length > 0 && <span className={`${styles.badge} ${styles.severityWarning}`}>{warnings.length} warnings</span>}
      </div>
      {issues.map((issue) => (
        <div key={issue.id} className={`${styles.item} ${SEVERITY_CLASS[issue.severity] ?? ""}`}>
          <div className={styles.itemHeader}>
            <span className={`${styles.icon} ${SEVERITY_CLASS[issue.severity] ?? ""}`}>{severityIcon(issue.severity)}</span>
            <span className={styles.message}>{issue.message}</span>
            {issue.nodeId && <CrosshairButton nodeId={issue.nodeId} />}
          </div>
          <div className={styles.path}>{issue.path}</div>
          {issue.suggestion && <div className={styles.suggestion}>{issue.suggestion}</div>}
        </div>
      ))}
    </div>
  );
}

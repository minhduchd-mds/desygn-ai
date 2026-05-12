import { useState } from "react";
import type { ScanHistoryEntry } from "../hooks/useScanHistory";
import styles from "./ScanHistory.module.css";

interface ScanHistoryProps {
  history: ScanHistoryEntry[];
  onClear: () => void;
}

function scoreClass(score: number): string {
  if (score >= 75) return styles.green;
  if (score >= 50) return styles.yellow;
  return styles.red;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString();
}

export function ScanHistory({ history, onClear }: ScanHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  if (history.length === 0) return null;

  return (
    <div className={styles.root}>
      <button className={styles.toggle} onClick={() => setExpanded(!expanded)}>
        <span className={styles.toggleLabel}>Scan History ({history.length})</span>
        <span className={styles.toggleIcon}>{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <>
          <div className={styles.list}>
            {history.map(entry => (
              <div key={entry.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <span className={styles.name}>{entry.componentName}</span>
                  {entry.atomicLevel && (
                    <span className={styles.level}>{entry.atomicLevel}</span>
                  )}
                </div>
                <div className={styles.itemMeta}>
                  <span className={`${styles.score} ${scoreClass(entry.score)}`}>{entry.score}</span>
                  <span className={styles.issues}>{entry.issueCount} issues</span>
                  <span className={styles.time}>{formatTime(entry.scannedAt)}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-link" onClick={onClear} style={{ fontSize: 10, marginTop: 6, opacity: 0.6 }}>
            Clear history
          </button>
        </>
      )}
    </div>
  );
}

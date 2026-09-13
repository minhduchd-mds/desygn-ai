import { useState, useEffect, useCallback, useRef } from "react";
import type { AutoLayoutCandidate, AutoLayoutSkipped } from "../../shared/types";
import styles from "./AutoLayoutFix.module.scss";

interface AutoLayoutFixProps {
  hasSelection: boolean;
  onApplied: () => void;
  /** When true, renders without card container (embedded in parent wrapper) */
  embedded?: boolean;
  /** Storybook: initial candidates for preview */
  initialCandidates?: AutoLayoutCandidate[];
  /** Storybook: initial skipped for preview */
  initialSkipped?: AutoLayoutSkipped[];
  /** Storybook: show success banner with count */
  initialAppliedCount?: number | null;
  /** Storybook: start in analyzing state */
  initialAnalyzing?: boolean;
}

function isTrustedFigmaMessage(event: MessageEvent): boolean {
  if (event.source !== parent) return false;
  return event.origin === "null" || event.origin === "https://www.figma.com";
}

export function AutoLayoutFix({ hasSelection, onApplied, embedded, initialCandidates, initialSkipped, initialAppliedCount, initialAnalyzing }: AutoLayoutFixProps) {
  const [candidates, setCandidates] = useState<AutoLayoutCandidate[]>(initialCandidates ?? []);
  const [skipped, setSkipped] = useState<AutoLayoutSkipped[]>(initialSkipped ?? []);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialCandidates?.map(c => c.nodeId) ?? []));
  const [analyzed, setAnalyzed] = useState((initialCandidates ?? []).length > 0 || (initialSkipped ?? []).length > 0);
  const [analyzing, setAnalyzing] = useState(initialAnalyzing ?? false);
  const [applying, setApplying] = useState(false);
  const [appliedCount, setAppliedCount] = useState<number | null>(initialAppliedCount ?? null);
  const [showSkipped, setShowSkipped] = useState(false);
  const fadeTimer = useRef<number>(0);
  useEffect(() => () => clearTimeout(fadeTimer.current), []);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!isTrustedFigmaMessage(event)) return;
      const msg = event.data?.pluginMessage;
      if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;

      if (msg.type === "autolayout-analysis-result") {
        if (!Array.isArray(msg.candidates) || !Array.isArray(msg.skipped)) return;
        setCandidates(msg.candidates);
        setSkipped(msg.skipped);
        setSelected(new Set(msg.candidates.map((c: AutoLayoutCandidate) => c.nodeId)));
        setAnalyzed(true);
        setAnalyzing(false);
      }

      if (msg.type === "autolayout-applied") {
        setApplying(false);
        setAppliedCount(typeof msg.count === "number" ? msg.count : 0);
        setAnalyzed(false);
        setCandidates([]);
        onApplied();
        fadeTimer.current = window.setTimeout(() => setAppliedCount(null), 3000);
      }
    },
    [onApplied],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  const handleAnalyze = () => {
    setAnalyzing(true);
    setAnalyzed(false);
    setAppliedCount(null);
    parent.postMessage({ pluginMessage: { type: "request-autolayout-analysis" } }, "*");
  };

  const handleApply = () => {
    if (selected.size === 0) return;
    setApplying(true);
    parent.postMessage({ pluginMessage: { type: "apply-autolayout", nodeIds: Array.from(selected) } }, "*");
  };

  const toggleCandidate = (nodeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  return (
    <div className={embedded ? styles.section : styles.root}>
      {!embedded && (
        <div className={styles.header}>
          <span className={styles.title}>Auto Layout Fix</span>
        </div>
      )}
      <p className={styles.description}>
        Detect frames without Auto Layout and convert them. Best effort — some
        layouts (like a value pinned to the right edge) need manual grouping
        first. Press Cmd+Z if a result shifts unexpectedly.
      </p>

      {!analyzed && (
        <button
          className={`btn-primary ${styles.actionBtn}`}
          onClick={handleAnalyze}
          disabled={analyzing || !hasSelection}
        >
          {analyzing ? "Analyzing..." : "Analyze Selection"}
        </button>
      )}

      {appliedCount !== null && (
        <div className={styles.success}>
          Converted {appliedCount} frame{appliedCount !== 1 ? "s" : ""}. Review the result and press Cmd+Z if a layout shifted unexpectedly.
        </div>
      )}

      {analyzed && (
        <>
          {candidates.length === 0 ? (
            <div className={styles.empty}>
              No convertible frames found. {skipped.length > 0 ? `${skipped.length} skipped.` : "All frames already have Auto Layout."}
            </div>
          ) : (
            <>
              <div className={styles.candidatesSection}>
                <div className={styles.candidatesHeader}>
                  <span>{candidates.length} frame{candidates.length !== 1 ? "s" : ""} to convert</span>
                  <button
                    className="btn-link"
                    onClick={() => {
                      if (selected.size === candidates.length) {
                        setSelected(new Set());
                      } else {
                        setSelected(new Set(candidates.map((c) => c.nodeId)));
                      }
                    }}
                  >
                    {selected.size === candidates.length ? "Deselect all" : "Select all"}
                  </button>
                </div>

                <div className={styles.list}>
                  {candidates.map((c) => (
                    <label key={c.nodeId} className={styles.item}>
                      <input
                        type="checkbox"
                        checked={selected.has(c.nodeId)}
                        onChange={() => toggleCandidate(c.nodeId)}
                      />
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{c.name}</span>
                        <span className={styles.itemMeta}>
                          {c.direction === "HORIZONTAL" ? "Row" : "Column"}
                          {" · "}gap {c.gap}px
                          {" · "}{c.childCount} children
                          {" · "}{Math.round(c.confidence * 100)}%
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                className={`btn-primary ${styles.actionBtn}`}
                onClick={handleApply}
                disabled={applying || selected.size === 0}
              >
                {applying
                  ? "Applying..."
                  : `Apply Auto Layout (${selected.size})`}
              </button>
            </>
          )}

          {skipped.length > 0 && (
            <div className={styles.skipped}>
              <button className="btn-link" onClick={() => setShowSkipped(!showSkipped)}>
                {showSkipped ? "Hide" : "Show"} {skipped.length} skipped
              </button>
              {showSkipped && (
                <div className={styles.skippedList}>
                  {skipped.map((s) => (
                    <div key={s.nodeId} className={styles.skippedItem}>
                      <span className={styles.skippedName}>{s.name}</span>
                      <span className={styles.skippedReason}>{s.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

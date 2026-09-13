import { useState, useEffect, useCallback, useRef } from "react";
import type { RenameEntry, ScanIssue } from "../../shared/types";
import { sendPluginMessage } from "../lib/pluginMessage";
import { DeleteIcon } from "./DeleteIcon";
import styles from "./FixPanel.module.scss";

interface FixPanelProps {
  issues: ScanIssue[];
  onFixesApplied: () => void;
  /** When true, renders without card container (embedded in parent wrapper) */
  embedded?: boolean;
}

type FixStatus = "idle" | "loading" | "success";

interface FixButtonState {
  dividers: FixStatus;
  delete: FixStatus;
  dividersMsg: string;
  deleteMsg: string;
}

function isTrustedFigmaMessage(event: MessageEvent): boolean {
  if (event.source !== parent) return false;
  return event.origin === "null" || event.origin === "https://www.figma.com";
}

export function FixPanel({ issues, onFixesApplied, embedded }: FixPanelProps) {
  const [renameEntries, setRenameEntries] = useState<RenameEntry[] | null>(null);
  const [selectedRenames, setSelectedRenames] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [renameStatus, setRenameStatus] = useState<FixStatus>("idle");
  const [renameMsg, setRenameMsg] = useState("");
  const [btnState, setBtnState] = useState<FixButtonState>({
    dividers: "idle",
    delete: "idle",
    dividersMsg: "",
    deleteMsg: "",
  });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const fadeTimers = useRef<number[]>([]);

  // Clear timers on unmount
  useEffect(() => {
    const timers = fadeTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  function autoFade(setter: (status: FixStatus) => void, delay = 3000) {
    const id = window.setTimeout(() => setter("idle"), delay);
    fadeTimers.current.push(id);
  }

  const hasNamingIssues = issues.some((i) => i.category === "naming");
  const placeholderIssues = issues.filter((i) => i.id.startsWith("meta-empty-"));
  const hiddenLayerIssues = issues.filter((i) => i.id.startsWith("meta-hidden-"));
  const dividerFrameIssues = issues.filter((i) => i.id.startsWith("meta-divider-frame-"));
  const deletableIssues = [...placeholderIssues, ...hiddenLayerIssues];

  // Listen for plugin responses
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!isTrustedFigmaMessage(event)) return;
      const msg = event.data?.pluginMessage;
      if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;

      if (msg.type === "renames-result") {
        if (!Array.isArray(msg.entries)) return;
        setRenameEntries(msg.entries);
        setSelectedRenames(new Set(msg.entries.map((e: RenameEntry) => e.nodeId)));
      }
      if (msg.type === "renames-applied") {
        setApplying(false);
        setRenameStatus("success");
        setRenameMsg(`${msg.count} layers renamed`);
        setRenameEntries(null);
        autoFade(setRenameStatus);
        setTimeout(() => onFixesApplied(), 500);
      }
      if (msg.type === "nodes-deleted") {
        setApplying(false);
        setBtnState((s) => ({ ...s, delete: "success", deleteMsg: `${msg.count} nodes deleted` }));
        autoFade((status) => setBtnState((s) => ({ ...s, delete: status })));
        setTimeout(() => onFixesApplied(), 800);
      }
      if (msg.type === "dividers-converted") {
        setApplying(false);
        setBtnState((s) => ({ ...s, dividers: "success", dividersMsg: `${msg.count} dividers converted` }));
        autoFade((status) => setBtnState((s) => ({ ...s, dividers: status })));
        setTimeout(() => onFixesApplied(), 800);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onFixesApplied]);

  const requestRenames = useCallback(() => {
    sendPluginMessage({ type: "request-renames" });
  }, []);

  const applyRenames = useCallback(() => {
    if (!renameEntries) return;
    const selected = renameEntries.filter((e) => selectedRenames.has(e.nodeId));
    if (selected.length === 0) return;
    setApplying(true);
    setRenameStatus("loading");
    sendPluginMessage({ type: "apply-renames", entries: selected });
  }, [renameEntries, selectedRenames]);

  const toggleRename = useCallback((nodeId: string) => {
    setSelectedRenames((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const applyDelete = useCallback((nodeIds: string[]) => {
    if (nodeIds.length === 0) return;
    setApplying(true);
    setBtnState((s) => ({ ...s, delete: "loading" }));
    sendPluginMessage({ type: "delete-nodes", nodeIds });
  }, []);

  const convertDividers = useCallback((nodeIds: string[]) => {
    if (nodeIds.length === 0) return;
    setApplying(true);
    setBtnState((s) => ({ ...s, dividers: "loading" }));
    sendPluginMessage({ type: "convert-dividers", nodeIds });
  }, []);

  const hasActiveSuccess =
    renameStatus === "success" || btnState.dividers === "success" || btnState.delete === "success";

  if (!hasNamingIssues && deletableIssues.length === 0 && dividerFrameIssues.length === 0 && !hasActiveSuccess)
    return null;

  return (
    <div className={embedded ? styles.section : styles.root}>
      {!embedded && <div className={styles.panelHeader}>Quick Fixes</div>}

      {/* Rename Fixes */}
      {renameStatus === "success" ? (
        <div className={`${styles.success} ${styles.successFade}`}>
          <span>&#10003; {renameMsg}</span>
          <button className={styles.dismiss} onClick={() => setRenameStatus("idle")}>
            <DeleteIcon size={13} />
          </button>
        </div>
      ) : (
        <>
          {hasNamingIssues && !renameEntries && (
            <button className={styles.fixBtn} onClick={requestRenames}>
              Auto-Rename Generic Layers
            </button>
          )}

          {renameEntries && renameEntries.length > 0 && (
            <div className={styles.list}>
              <div className={styles.listHeader}>
                <span>{renameEntries.length} layers to rename</span>
                <div className={styles.listActions}>
                  <button
                    className="btn-link"
                    onClick={() => setSelectedRenames(new Set(renameEntries.map((e) => e.nodeId)))}
                  >
                    All
                  </button>
                  <button className="btn-link" onClick={() => setSelectedRenames(new Set())}>
                    None
                  </button>
                </div>
              </div>
              <div className={styles.entries}>
                {renameEntries.map((entry) => (
                  <label key={entry.nodeId} className={styles.entry}>
                    <input
                      type="checkbox"
                      checked={selectedRenames.has(entry.nodeId)}
                      onChange={() => toggleRename(entry.nodeId)}
                    />
                    <span className={styles.oldName}>{entry.oldName}</span>
                    <span className={styles.arrow}>&rarr;</span>
                    <span className={styles.newName}>{entry.newName}</span>
                  </label>
                ))}
              </div>
              <button
                className={`btn-primary ${styles.applyBtn}`}
                onClick={applyRenames}
                disabled={applying || selectedRenames.size === 0}
              >
                {renameStatus === "loading" ? "Renaming..." : `Rename ${selectedRenames.size} Layers`}
              </button>
            </div>
          )}

          {renameEntries && renameEntries.length === 0 && <div className={styles.empty}>No generic names found.</div>}
        </>
      )}

      {/* Convert divider frames */}
      {btnState.dividers === "success" ? (
        <div className={`${styles.success} ${styles.successFade}`}>
          <span>&#10003; {btnState.dividersMsg}</span>
          <button className={styles.dismiss} onClick={() => setBtnState((s) => ({ ...s, dividers: "idle" }))}>
            <DeleteIcon size={13} />
          </button>
        </div>
      ) : dividerFrameIssues.length > 0 ? (
        <button
          className={styles.fixBtn}
          onClick={() => convertDividers(dividerFrameIssues.map((i) => i.nodeId!).filter(Boolean))}
          disabled={applying || btnState.dividers === "loading"}
        >
          {btnState.dividers === "loading"
            ? "Converting..."
            : `Convert ${dividerFrameIssues.length} divider${dividerFrameIssues.length > 1 ? "s" : ""}`}
        </button>
      ) : null}

      {/* Bulk Delete placeholders/hidden */}
      {btnState.delete === "success" ? (
        <div className={`${styles.success} ${styles.successFade}`}>
          <span>&#10003; {btnState.deleteMsg}</span>
          <button className={styles.dismiss} onClick={() => setBtnState((s) => ({ ...s, delete: "idle" }))}>
            <DeleteIcon size={13} />
          </button>
        </div>
      ) : deletableIssues.length > 0 ? (
        deleteConfirm ? (
          <div className={styles.confirmBox}>
            <p className={styles.confirmText}>
              This will permanently delete {deletableIssues.length} layer{deletableIssues.length > 1 ? "s" : ""} from your Figma file.
            </p>
            <div className={styles.confirmActions}>
              <button
                className="btn-secondary"
                onClick={() => setDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className={styles.confirmDeleteBtn}
                onClick={() => {
                  setDeleteConfirm(false);
                  applyDelete(deletableIssues.map((i) => i.nodeId!).filter(Boolean));
                }}
                disabled={applying || btnState.delete === "loading"}
              >
                {btnState.delete === "loading" ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <button
            className={`${styles.fixBtn} ${styles.fixBtnDelete}`}
            onClick={() => setDeleteConfirm(true)}
            disabled={applying || btnState.delete === "loading"}
          >
            <>
              Delete {placeholderIssues.length > 0 ? `${placeholderIssues.length} empty` : ""}
              {placeholderIssues.length > 0 && hiddenLayerIssues.length > 0 ? " + " : ""}
              {hiddenLayerIssues.length > 0 ? `${hiddenLayerIssues.length} hidden` : ""} layers
            </>
          </button>
        )
      ) : null}
    </div>
  );
}

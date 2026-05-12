import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { useSelection } from "./hooks/useSelection";
import { useScan } from "./hooks/useScan";
import { useProfiles } from "./hooks/useProfiles";
import { ScoreOverview } from "./components/ScoreOverview";
import { PromptExport } from "./components/PromptExport";
import { FixPanel } from "./components/FixPanel";
import { AtomicBadge, LevelIcon, LEVEL_CONFIG } from "./components/AtomicBadge";
import { BatchPanel } from "./components/BatchPanel";
import { AutoLayoutFix } from "./components/AutoLayoutFix";
import { ExportReportButton } from "./components/ExportReportButton";
import { ScanHistory } from "./components/ScanHistory";
import { useBatchScan } from "./hooks/useBatchScan";
import { useScanHistory } from "./hooks/useScanHistory";
import { useFigmaColorVariables } from "./hooks/useFigmaColorVariables";
import { useDesignSystemSnapshot } from "./hooks/useDesignSystemSnapshot";
import type { PluginProfile } from "../shared/types";

const TokenMap = lazy(() => import("./components/TokenMap").then(m => ({ default: m.TokenMap })));
const DesignProjectPanel = lazy(() => import("./components/DesignProjectPanel").then(m => ({ default: m.DesignProjectPanel })));

type NavTab = "scan" | "design";


export function App() {
  const { selectedNode, selectionName, selectionCount, refreshSelection } = useSelection();
  const { result, isScanning, error, scan, reset, variants } = useScan();
  const {
    result: batchResult,
    isScanning: isBatchScanning,
    error: batchError,
    scan: batchScan,
    reset: batchReset,
  } = useBatchScan();
  const { activeProfile } = useProfiles();
  const figmaColorVariables = useFigmaColorVariables();
  const { history: scanHistory, addEntry: addHistoryEntry, clearHistory } = useScanHistory();
  const [activeTab, setActiveTab] = useState<NavTab>("scan");
  const designSystemSnapshot = useDesignSystemSnapshot(activeTab === "design");
  const lastNodeIdRef = useRef<string | null>(null);
  const pendingRescanRef = useRef(false);
  const lastVariableCountRef = useRef(0);

  const isMultiSelect = selectionCount > 1;
  const scanProfile = useMemo<PluginProfile | null>(() => {
    const hasFigmaVariables = Object.keys(figmaColorVariables.tokens).length > 0;
    if (!hasFigmaVariables) return activeProfile;

    return {
      id: activeProfile?.id ?? "figma-local-color-variables",
      name: activeProfile?.name ?? `${figmaColorVariables.fileName || "Figma"} Variables`,
      stack: activeProfile?.stack ?? "",
      layout: activeProfile?.layout ?? "",
      tokens: {
        ...(activeProfile?.tokens ?? {}),
        ...figmaColorVariables.tokens,
      },
      components: activeProfile?.components ?? [],
      guidelines: activeProfile?.guidelines ?? "",
    };
  }, [activeProfile, figmaColorVariables.fileName, figmaColorVariables.tokens]);

  useEffect(() => {
    if (selectedNode?.id && selectedNode.id !== lastNodeIdRef.current) {
      lastNodeIdRef.current = selectedNode.id;
      reset();
      batchReset();
    } else if (pendingRescanRef.current && selectedNode) {
      pendingRescanRef.current = false;
      scan(selectedNode, scanProfile);
    }
  }, [selectedNode, selectionName, reset, batchReset, scan, scanProfile]);

  useEffect(() => {
    if (result && selectionDisplayName) {
      addHistoryEntry({
        componentName: selectionDisplayName,
        score: result.score,
        atomicLevel: result.atomicInfo?.level ?? null,
        issueCount: result.issues.length,
      });
    }
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (figmaColorVariables.count === 0 || figmaColorVariables.count === lastVariableCountRef.current) return;
    lastVariableCountRef.current = figmaColorVariables.count;
    if (result && selectedNode) {
      scan(selectedNode, scanProfile);
    }
  }, [figmaColorVariables.count, result, scan, scanProfile, selectedNode]);

  const handleScan = () => {
    if (!selectedNode) return;
    if (result) {
      // Rescan: re-fetch fresh selection from the plugin so edits made in Figma
      // since the last scan are picked up. The useEffect on selectedNode picks
      // up pendingRescanRef and triggers scan() with the fresh node.
      pendingRescanRef.current = true;
      refreshSelection();
      return;
    }
    scan(selectedNode, scanProfile);
  };

  const handleBatchScan = () => batchScan(scanProfile);

  const handleSelectNode = useCallback((nodeId: string) => {
    parent.postMessage({ pluginMessage: { type: "select-node", nodeId } }, "*");
  }, []);

  const handleFixesApplied = useCallback(() => {
    pendingRescanRef.current = true;
    refreshSelection();
  }, [refreshSelection]);

  const hasResult = !!result;
  const selectionDisplayName = selectedNode?.componentName || selectedNode?.name || selectionName;

  // Resize plugin window: narrow when idle, wide when showing results
  useEffect(() => {
    const width = hasResult || activeTab === "design" ? 768 : 480;
    parent.postMessage({ pluginMessage: { type: "resize", width, height: 768 } }, "*");
  }, [activeTab, hasResult]);

  // State 3: Scanned → full dashboard

  return (
    <div className="app app-dashboard">
      {/* Ambient background layers */}
      <div className="bg-grid" />
      <div className="orb orb1" />
      <div className="orb orb2" />
      <div className="orb orb3" />
      <div className="scanline" />

      <header className="dashboard-topbar">
        <h1 className="dashboard-logo">DesignReady</h1>

        <div className="topbar-selection">
          <span className="topbar-status-dot" />
          <span className="topbar-component-label">{selectedNode ? "Selected" : "·"}</span>
          {result?.atomicInfo && (
            <LevelIcon
              level={result.atomicInfo.level}
              color={LEVEL_CONFIG[result.atomicInfo.level]?.color ?? "#999"}
              size={12}
            />
          )}
          <span
            className="topbar-component-name"
            style={result?.atomicInfo ? { color: LEVEL_CONFIG[result.atomicInfo.level]?.color } : undefined}
          >
            {selectionDisplayName || "ACTIVE"}
          </span>
        </div>

        <div className="topbar-actions">
          {result && selectedNode && (
            <button className="btn-secondary btn-sm" onClick={handleScan} disabled={isScanning}>
              {isScanning ? "..." : "Rescan"}
            </button>
          )}
        </div>
      </header>

      {/* Tab Bar — only after scan */}
      <nav className="dashboard-tabs">
        {[
          { id: "scan" as NavTab, label: "Scan" },
          { id: "design" as NavTab, label: "Design.md" },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="dashboard-content">
        {activeTab === "scan" && (
          <div className="panel-scan">
            {hasResult ? (
              <div className="scan-layout">
                {/* Row 1: Score | Prompt — same height */}
                <div className="scan-grid">
                  <ScoreOverview score={result.score} categories={result.categories} />
                  <PromptExport promptCompact={result.promptCompact ?? ""} score={result.score} />

                  {/* Row 2: Quick Fixes | TokenMap — same height */}
                  <div className="quick-fixes-card">
                    <span className="quick-fixes-title">Quick Fixes</span>
                    <AutoLayoutFix hasSelection={!!selectedNode} onApplied={handleFixesApplied} embedded />
                    <FixPanel issues={result.issues} onFixesApplied={handleFixesApplied} embedded />
                  </div>

                  {result.colorMappings && result.colorMappings.length > 0 ? (
                    <Suspense fallback={<div className="card" style={{ minHeight: 120 }} />}>
                      <TokenMap mappings={result.colorMappings} profileName={scanProfile?.name} />
                    </Suspense>
                  ) : (
                    <div />
                  )}
                </div>

                {/* Responsive Variants (full width, conditional) */}
                {(() => {
                  const seen = new Set<number>();
                  const unique = variants.filter((v) => {
                    if (seen.has(v.width)) return false;
                    seen.add(v.width);
                    return true;
                  });
                  if (unique.length <= 1) return null;
                  return (
                    <div className="variants-section">
                      <span className="variants-label">Responsive Variants</span>
                      <div className="variants-badge">
                        {unique.map((v) => (
                          <span
                            key={v.nodeId}
                            className={`variant-chip ${v.nodeId === selectedNode?.id ? "active" : ""}`}
                          >
                            {v.viewportType === "desktop"
                              ? "Desktop"
                              : v.viewportType === "tablet"
                                ? "Tablet"
                                : v.viewportType === "mobile"
                                  ? "Mobile"
                                  : "?"}{" "}
                            {v.width}px
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Full-width: Atomic Badge + Export Plan */}
                {result.atomicInfo && <AtomicBadge info={result.atomicInfo} exportPlan={result.exportPlan} />}

                {/* Export scan report */}
                <ExportReportButton result={result} componentName={selectionDisplayName || "component"} />
              </div>
            ) : batchResult ? (
              <BatchPanel result={batchResult} onSelectNode={handleSelectNode} />
            ) : (
              <div className="dashboard-empty">
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect
                        x="8"
                        y="8"
                        width="32"
                        height="32"
                        rx="4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray="4 3"
                        opacity="0.4"
                      />
                      <path
                        d="M20 24h8M24 20v8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        opacity="0.6"
                      />
                    </svg>
                  </div>
                  <div className="empty-title">
                    {selectedNode
                      ? `Selected: ${selectionDisplayName}`
                      : "Select a frame"}
                  </div>
                  <div className="empty-hint">
                    Score your Figma designs for AI-readiness, fix common issues, and generate structured code prompts.
                  </div>
                  {selectedNode && (
                    <>
                      {(error || batchError) && <p className="topbar-error">{error || batchError}</p>}
                      <div className="scan-prompt-buttons">
                        <button
                          className="btn-primary btn-scan-center"
                          onClick={handleScan}
                          disabled={isScanning || isBatchScanning}
                        >
                          {isScanning ? "Scanning..." : "Scan Component"}
                        </button>
                        {isMultiSelect && (
                          <button
                            className="btn-secondary btn-scan-center"
                            onClick={handleBatchScan}
                            disabled={isScanning || isBatchScanning}
                          >
                            {isBatchScanning ? "Scanning..." : `Batch Scan (${selectionCount})`}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <ScanHistory history={scanHistory} onClear={clearHistory} />
              </div>
            )}
          </div>
        )}
        {activeTab === "design" && (
          <div className="panel-design">
            <Suspense fallback={<div className="card" style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 11 }}>Loading...</div>}>
              <DesignProjectPanel
                snapshot={designSystemSnapshot.snapshot}
                isLoading={designSystemSnapshot.isLoading}
                error={designSystemSnapshot.error}
                scanResult={result}
                onRefresh={designSystemSnapshot.refreshSnapshot}
              />
            </Suspense>
          </div>
        )}
      </div>

      <ResizeHandle />
    </div>
  );
}

// ── Resize Handle ──

function ResizeHandle() {
  const handleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;

    function onPointerDown(e: PointerEvent) {
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      startW = document.documentElement.clientWidth;
      startH = document.documentElement.clientHeight;
      handle!.setPointerCapture(e.pointerId);
      handle!.addEventListener("pointermove", onPointerMove);
      handle!.addEventListener("pointerup", onPointerUp);
    }

    function onPointerMove(e: PointerEvent) {
      const w = startW + (e.clientX - startX);
      const h = startH + (e.clientY - startY);
      parent.postMessage({ pluginMessage: { type: "resize", width: w, height: h } }, "*");
    }

    function onPointerUp(e: PointerEvent) {
      handle!.releasePointerCapture(e.pointerId);
      handle!.removeEventListener("pointermove", onPointerMove);
      handle!.removeEventListener("pointerup", onPointerUp);
    }

    handle.addEventListener("pointerdown", onPointerDown);
    return () => handle.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={handleRef} className="resize-handle">
      <svg width="12" height="12" viewBox="0 0 12 12">
        <path d="M11 1L1 11M11 5L5 11M11 9L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

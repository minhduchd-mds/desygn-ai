import { useState, useRef, useEffect } from "react";
import type { ScanResult } from "../../shared/types";

interface ExportReportButtonProps {
  result: ScanResult;
  componentName: string;
}

export function ExportReportButton({ result, componentName }: ExportReportButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const buildReport = () => ({
    exportedAt: new Date().toISOString(),
    component: componentName,
    score: result.score,
    categories: result.categories.map(c => ({
      id: c.id,
      label: c.label,
      score: c.score,
      status: c.status,
    })),
    issues: result.issues.map(i => ({
      id: i.id,
      category: i.category,
      severity: i.severity,
      message: i.message,
      nodeId: i.nodeId ?? null,
    })),
    atomicLevel: result.atomicInfo?.level ?? null,
    colorMappings: result.colorMappings?.length ?? 0,
  });

  const handleExportJSON = () => {
    const report = buildReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `designready-report-${componentName.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJSON = async () => {
    const report = buildReport();
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    } catch {
      const ta = document.createElement("textarea");
      ta.value = JSON.stringify(report, null, 2);
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button className="btn-secondary btn-sm" onClick={handleExportJSON}>
        Export JSON
      </button>
      <button className="btn-secondary btn-sm" onClick={handleCopyJSON}>
        {copied ? "Copied!" : "Copy Report"}
      </button>
    </div>
  );
}

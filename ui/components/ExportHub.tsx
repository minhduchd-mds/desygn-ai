import { useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import styles from "./ExportHub.module.css";

interface ExportHubProps {
  onDownloadProject: () => void;
  onExportFigmaFrame: () => void;
  onCopyPrompt: () => void;
  onExportBAReport: () => void;
  isExporting: boolean;
  isCopied: boolean;
  frameStatus: string | null;
  tokenEstimate: number;
  fileCount: number;
}

export function ExportHub({
  onDownloadProject, onExportFigmaFrame, onCopyPrompt, onExportBAReport,
  isExporting, isCopied, frameStatus, tokenEstimate, fileCount,
}: ExportHubProps) {
  const [expanded, setExpanded] = useState(true);
  const { t } = useI18n();

  return (
    <div className={styles.root}>
      <button className={styles.header} onClick={() => setExpanded(!expanded)}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>{t.export}</span>
          <span className={styles.badge}>{fileCount} {t.files} · ~{formatTokens(tokenEstimate)} {t.tokens}</span>
        </div>
        <span className={styles.chevron}>{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className={styles.body}>
          <div className={styles.grid}>
            <button className={styles.exportCard} onClick={onDownloadProject}>
              <span className={styles.exportIcon}>📦</span>
              <span className={styles.exportLabel}>{t.downloadProject}</span>
              <span className={styles.exportDesc}>{t.downloadDesc}</span>
            </button>

            <button className={styles.exportCard} onClick={onExportFigmaFrame} disabled={isExporting}>
              <span className={styles.exportIcon}>🎨</span>
              <span className={styles.exportLabel}>{isExporting ? t.exportingFrame : t.exportFigmaFrame}</span>
              <span className={styles.exportDesc}>{t.figmaFrameDesc}</span>
            </button>

            <button className={styles.exportCard} onClick={onCopyPrompt}>
              <span className={styles.exportIcon}>📋</span>
              <span className={styles.exportLabel}>{isCopied ? t.copied : t.copyAiPrompt}</span>
              <span className={styles.exportDesc}>{t.copyDesc}</span>
            </button>

            <button className={styles.exportCard} onClick={onExportBAReport}>
              <span className={styles.exportIcon}>📄</span>
              <span className={styles.exportLabel}>{t.exportBaReport}</span>
              <span className={styles.exportDesc}>{t.baReportDesc}</span>
            </button>
          </div>

          {frameStatus && <div className={styles.status}>{frameStatus}</div>}
        </div>
      )}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

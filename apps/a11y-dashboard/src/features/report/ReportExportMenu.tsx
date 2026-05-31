/**
 * ReportExportMenu — download an audit report in any of four formats.
 *
 * Renders a labelled <Select> of formats (PDF / SARIF / CSV / Markdown) plus
 * a Download button. Each click hits `/api/a11y/report-{format}?id=<id>`,
 * pulls the response as a Blob, and triggers a browser download via a
 * synthetic <a download>. The fetch is wrapped in try/catch so an offline
 * dev (or a 404 in early Pro tiers) surfaces an inline localized error
 * rather than throwing past the React tree.
 *
 * Keeps zero global state — `auditId` is the only required prop so the
 * component is trivial to drop into AuditList rows, detail pages, or stories.
 */

import { useId, useState } from "react";
import { Button, Select, type SelectOption } from "@desygn/ui";
import { useTranslation } from "../../i18n/index.js";
import type { TranslationKey } from "../../i18n/types.js";
import styles from "./ReportExportMenu.module.css";

/** Supported export formats. Mirrors @desygn/report-generator's outputs. */
export type ReportFormat = "pdf" | "sarif" | "csv" | "markdown";

/** File extension served back by each format endpoint. */
const FORMAT_EXTENSION: Record<ReportFormat, string> = {
  pdf: "pdf",
  sarif: "sarif.json",
  csv: "csv",
  markdown: "md",
};

const FORMATS: ReadonlyArray<{ value: ReportFormat; labelKey: TranslationKey }> = [
  { value: "pdf", labelKey: "report.export.pdf" },
  { value: "sarif", labelKey: "report.export.sarif" },
  { value: "csv", labelKey: "report.export.csv" },
  { value: "markdown", labelKey: "report.export.markdown" },
];

export interface ReportExportMenuProps {
  /** Audit run id to download. Forwarded as `?id=` on each request. */
  auditId: string;
}

/**
 * Trigger a browser download for `blob` using `filename`. Uses a single
 * synthetic anchor that's cleaned up after the click — same shape as a
 * user-driven Save As, so it works in all evergreen browsers + jsdom.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function ReportExportMenu({ auditId }: ReportExportMenuProps) {
  const { t } = useTranslation();
  const selectId = useId();
  const errorId = useId();

  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const options: SelectOption[] = FORMATS.map((f) => ({
    value: f.value,
    label: t(f.labelKey),
  }));

  async function handleDownload() {
    setError(undefined);
    setDownloading(true);
    try {
      const url = `/api/a11y/report-${format}?id=${encodeURIComponent(auditId)}`;
      const response = await fetch(url);
      if (!response.ok) {
        // Surface 4xx/5xx as the localized "failed" string — do NOT leak
        // server-side error text into the UI.
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const filename = `desygn-a11y-${auditId}.${FORMAT_EXTENSION[format]}`;
      downloadBlob(blob, filename);
    } catch {
      setError(t("report.export.failed"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={styles.menu} aria-label={t("report.export.label")} role="group">
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={selectId}>
            {t("report.export.formatLabel")}
          </label>
          <Select
            id={selectId}
            options={options}
            value={format}
            onChange={(e) => setFormat(e.target.value as ReportFormat)}
            disabled={downloading}
          />
        </div>

        <Button
          variant="primary"
          onClick={handleDownload}
          loading={downloading}
          aria-describedby={error ? errorId : undefined}
        >
          {downloading ? t("report.export.downloading") : t("report.export.download")}
        </Button>
      </div>

      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

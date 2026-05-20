/**
 * AuditStartForm — collect a Figma URL + token + WCAG target and start an audit.
 *
 * On submit it parses the fileKey from the URL (see parseFileKeyFromUrl), POSTs
 * to /api/a11y/audit-start, and renders the returned score gauge + issue
 * summary. While the request is in flight a Spinner is shown; validation and
 * request failures surface through the URL field's `error` slot.
 *
 * Degradation: with no API server in local dev the fetch rejects; we catch it
 * and show a localized "request failed" message rather than crashing.
 */

import { useId, useState, type FormEvent } from "react";
import { Button, Input, Select, Spinner } from "@desygn/ui";
import type { SelectOption } from "@desygn/ui";
import type { WcagLevel, WcagVersion } from "@desygn/audit-engine";
import { useTranslation } from "../../i18n/index.js";
import {
  parseFileKeyFromUrl,
  startAudit,
  type StartAuditResponse,
} from "./useAudits.js";
import { AuditScoreGauge } from "./AuditScoreGauge.js";
import styles from "./AuditStartForm.module.css";

const VERSION_OPTIONS: Array<{ value: WcagVersion }> = [
  { value: "2.0" },
  { value: "2.1" },
  { value: "2.2" },
  { value: "3.0" },
];

const LEVEL_OPTIONS: Array<{ value: WcagLevel }> = [
  { value: "A" },
  { value: "AA" },
  { value: "AAA" },
];

export interface AuditStartFormProps {
  /** Called with the audit-start response after a successful run. */
  onCompleted?: (result: StartAuditResponse) => void;
}

export function AuditStartForm({ onCompleted }: AuditStartFormProps) {
  const { t } = useTranslation();
  const urlId = useId();
  const tokenId = useId();
  const versionId = useId();
  const levelId = useId();

  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [version, setVersion] = useState<WcagVersion>("2.2");
  const [level, setLevel] = useState<WcagLevel>("AA");

  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StartAuditResponse | null>(null);

  // WCAG version/level are enum codes — no translation needed for the values.
  const versionOptions: SelectOption[] = VERSION_OPTIONS.map((o) => ({
    value: o.value,
    label: o.value,
  }));
  const levelOptions: SelectOption[] = LEVEL_OPTIONS.map((o) => ({
    value: o.value,
    label: o.value,
  }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);

    const parsed = parseFileKeyFromUrl(url);
    if (!parsed) {
      setError(t("audit.form.invalidUrl"));
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const response = await startAudit({
        fileKey: parsed.fileKey,
        nodeId: parsed.nodeId,
        accessToken: token,
        options: { wcagVersion: version, wcagLevel: level },
      });
      setResult(response);
      onCompleted?.(response);
    } catch {
      // No backend in dev (or upstream failure) — degrade to an error message.
      setError(t("audit.form.requestFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={urlId}>
          {t("audit.form.urlLabel")}
        </label>
        <Input
          id={urlId}
          name="figmaUrl"
          type="url"
          inputMode="url"
          autoComplete="off"
          required
          value={url}
          placeholder={t("audit.form.urlPlaceholder")}
          error={error}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={tokenId}>
          {t("audit.form.tokenLabel")}
        </label>
        <Input
          id={tokenId}
          name="figmaToken"
          type="password"
          autoComplete="off"
          value={token}
          placeholder={t("audit.form.tokenPlaceholder")}
          onChange={(e) => setToken(e.target.value)}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={versionId}>
            {t("audit.form.versionLabel")}
          </label>
          <Select
            id={versionId}
            name="wcagVersion"
            options={versionOptions}
            value={version}
            onChange={(e) => setVersion(e.target.value as WcagVersion)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={levelId}>
            {t("audit.form.levelLabel")}
          </label>
          <Select
            id={levelId}
            name="wcagLevel"
            options={levelOptions}
            value={level}
            onChange={(e) => setLevel(e.target.value as WcagLevel)}
          />
        </div>
      </div>

      <Button type="submit" variant="primary" loading={loading}>
        {loading ? t("audit.form.submitting") : t("audit.form.submit")}
      </Button>

      {loading && (
        <div className={styles.pending}>
          <Spinner size="sm" />
          <span>{t("audit.form.submitting")}</span>
        </div>
      )}

      {result && (
        <div className={styles.result}>
          <AuditScoreGauge score={result.score} size={96} thickness={10} />
          <div className={styles.resultMeta}>
            <h3 className={styles.resultHeading}>{t("audit.form.successHeading")}</h3>
            <p className={styles.resultStat}>
              {t("audit.form.scoreLabel")}: {result.score}
            </p>
            <p className={styles.resultStat}>
              {t("audit.form.issuesLabel")}: {result.summary.total}
            </p>
          </div>
        </div>
      )}
    </form>
  );
}

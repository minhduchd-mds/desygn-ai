/**
 * Verify — PUBLIC PDF verification page (no auth, no AppShell).
 *
 * A customer (or auditor) drops a signed PDF + the signature string + the
 * canonical metadata blob; we base64-encode the file in the browser and POST
 * the bundle to /api/a11y/verify-pdf. The server holds REPORT_SIGNING_SECRET,
 * recomputes the HMAC, and returns `{ valid: boolean }`. We render the result
 * in a Card with a Badge so it's scannable.
 *
 * Owns its own <main> (the AppShell does NOT wrap this page — it lives as a
 * public sibling under the root route). Keeps exactly one <h1> and at least
 * one enabled <button> so the route satisfies the same a11y structural
 * contract the e2e suite asserts on `/`.
 *
 * Degradation:
 *   - Bad metadata JSON → localized inline error, no request fired.
 *   - Network / 5xx → "request failed" string, no leak of server errors.
 *   - 200 with `{ valid: true | false }` → success vs failure Card.
 */

import { useId, useState, type FormEvent } from "react";
import { Badge, Button, Card, Input } from "@desygn/ui";
import { useTranslation } from "../i18n/index.js";
import { LanguageToggle } from "../components/LanguageToggle.js";
import styles from "./Verify.module.css";

type VerifyState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "result"; valid: boolean }
  | { kind: "error"; message: string };

/**
 * Read a File as base64 (no `data:` prefix). FileReader is available in every
 * evergreen browser; we wrap it in a Promise so the submit handler stays flat.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("FileReader returned a non-string result"));
        return;
      }
      // `data:application/pdf;base64,<payload>` → keep only <payload>.
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Parse a JSON string and assert it's a plain object (the server schema
 * requires `metadata: Record<string, unknown>`). Returns null on any failure.
 */
function parseMetadata(input: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(input);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function VerifyPage() {
  const { t } = useTranslation();
  const fileId = useId();
  const signatureId = useId();
  const metadataId = useId();

  const [file, setFile] = useState<File | null>(null);
  const [signature, setSignature] = useState("");
  const [metadataRaw, setMetadataRaw] = useState("");
  const [state, setState] = useState<VerifyState>({ kind: "idle" });

  const submitting = state.kind === "submitting";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setState({ kind: "error", message: t("verify.missingFile") });
      return;
    }
    if (signature.trim().length === 0) {
      setState({ kind: "error", message: t("verify.missingSignature") });
      return;
    }
    const metadata = parseMetadata(metadataRaw);
    if (!metadata) {
      setState({ kind: "error", message: t("verify.invalidMetadata") });
      return;
    }

    setState({ kind: "submitting" });
    try {
      const pdfBase64 = await fileToBase64(file);
      const response = await fetch("/api/a11y/verify-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pdfBase64, signature: signature.trim(), metadata }),
      });
      if (!response.ok) {
        setState({ kind: "error", message: t("verify.requestFailed") });
        return;
      }
      const body = (await response.json()) as { valid?: boolean };
      setState({ kind: "result", valid: Boolean(body.valid) });
    } catch {
      setState({ kind: "error", message: t("verify.requestFailed") });
    }
  };

  return (
    <main className={styles.wrap}>
      <Card variant="elevated" className={styles.panel}>
        <div className={styles.header}>
          <h1 className={styles.heading}>{t("verify.title")}</h1>
          <LanguageToggle />
        </div>

        <p className={styles.intro}>{t("verify.intro")}</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={fileId}>
              {t("verify.fileLabel")}
            </label>
            <input
              id={fileId}
              name="pdf"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className={styles.hint}>{t("verify.fileHint")}</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={signatureId}>
              {t("verify.signatureLabel")}
            </label>
            <Input
              id={signatureId}
              name="signature"
              type="text"
              autoComplete="off"
              value={signature}
              placeholder={t("verify.signaturePlaceholder")}
              onChange={(e) => setSignature(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={metadataId}>
              {t("verify.metadataLabel")}
            </label>
            <textarea
              id={metadataId}
              name="metadata"
              className={styles.textarea}
              value={metadataRaw}
              placeholder={t("verify.metadataPlaceholder")}
              onChange={(e) => setMetadataRaw(e.target.value)}
            />
          </div>

          {state.kind === "error" && (
            <p className={styles.error} role="alert">
              {state.message}
            </p>
          )}

          <Button type="submit" variant="primary" loading={submitting}>
            {submitting ? t("verify.submitting") : t("verify.submit")}
          </Button>
        </form>

        {state.kind === "result" && (
          <Card
            variant="default"
            className={styles.result}
            role="status"
            aria-live="polite"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <Badge tone={state.valid ? "success" : "error"}>
                {state.valid
                  ? t("verify.resultValidTitle")
                  : t("verify.resultInvalidTitle")}
              </Badge>
              <h2 className={styles.resultHeading}>
                {state.valid
                  ? t("verify.resultValidTitle")
                  : t("verify.resultInvalidTitle")}
              </h2>
            </div>
            <p className={styles.resultBody}>
              {state.valid
                ? t("verify.resultValidBody")
                : t("verify.resultInvalidBody")}
            </p>
          </Card>
        )}
      </Card>
    </main>
  );
}

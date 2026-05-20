/**
 * Audits — list of accessibility audits + a "new audit" dialog.
 *
 * Renders one <h1> (the shell owns the <main>), a primary CTA that opens the
 * AuditStartForm inside a Dialog, and the AuditList (empty state until a list
 * endpoint exists). Keeping exactly one <h1> and no <main> here preserves the
 * e2e structural contract.
 */

import { useState } from "react";
import { Button, Dialog } from "@desygn/ui";
import { useTranslation } from "../i18n/index.js";
import { AuditList, AuditStartForm } from "../features/audit/index.js";

export function Audits() {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
        }}
      >
        <h1 style={{ margin: 0 }}>{t("audits.title")}</h1>
        <Button variant="primary" onClick={() => setDialogOpen(true)}>
          {t("audits.cta")}
        </Button>
      </header>

      <p style={{ color: "var(--color-slate-600)", marginTop: "var(--space-2)" }}>
        {t("audits.body")}
      </p>

      <div style={{ marginTop: "var(--space-4)" }}>
        <AuditList />
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t("audit.form.title")}
        size="md"
      >
        <AuditStartForm />
      </Dialog>
    </>
  );
}

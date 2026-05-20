# @desygn/report-generator

Render Desygn A11y audit results into shareable, machine-readable, and
legally-verifiable report formats.

## Install

```bash
npm install @desygn/report-generator
```

## Formats

```ts
import { generateMarkdown, generateSarif, generateCsv } from "@desygn/report-generator";

const md = generateMarkdown(auditResult, { watermark: true });      // human-readable
const sarif = generateSarif(auditResult);                           // GitHub Code Scanning
const csv = generateCsv(auditResult);                               // spreadsheet (RFC 4180)
```

- **Markdown** — supports Free-tier watermark + Pro branding (company name)
- **SARIF v2.1.0** — uploads to the GitHub Security tab via the Action
- **CSV** — RFC 4180-compliant, double-quote escaping

## Signed reports (compliance)

For EU Accessibility Act / ADA use, reports can be HMAC-SHA256 signed and
later verified as untampered:

```ts
import { signReport, verifyReport } from "@desygn/report-generator";

const sig = signReport(md, { auditId, score }, process.env.REPORT_SIGNING_SECRET);
// later, on the /verify page:
verifyReport(md, { auditId, score }, sig.signature); // true | false
```

Verification uses constant-time comparison and fails closed when the
secret is missing.

## License

MIT

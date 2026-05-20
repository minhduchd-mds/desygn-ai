/**
 * @desygn/report-generator — Build audit reports in multiple formats.
 *
 * Formats:
 *   - Markdown (everyone, no watermark for Pro+)
 *   - JSON / SARIF v2.1.0 (GitHub Code Scanning, machine-readable)
 *   - CSV (spreadsheet export)
 *   - PDF (Pro+ only, HMAC-signed for compliance verification)
 *
 * Note: PDF generation is stubbed in this scaffold and will use
 * `@react-pdf/renderer` once the package is wired in Week 8.
 */

export { generateMarkdown } from "./markdown.js";
export { generateSarif } from "./sarif.js";
export { generateCsv } from "./csv.js";
export { signReport, verifyReport, type ReportSignature } from "./signer.js";

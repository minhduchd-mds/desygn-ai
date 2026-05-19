# Export Audit Results to Markdown

**Labels:** `good-first-issue`, `enhancement`, `feature`

## Context
The checklist panel has CSV and PDF export but no Markdown export. Many developers prefer Markdown for embedding audit results in GitHub Issues or PRs.

## Requirements
- Add "Export Markdown" button in the export report modal
- Generate a well-formatted `.md` file with:
  - Summary header (project name, date, overall score)
  - Score breakdown table (category, score, status)
  - Detailed results table (criterion, status, score, reason)
  - Failed items section with fix suggestions
- Download as `audit-report-{date}.md`

## Files to modify
- `web/src/ux-checklist/ChecklistPanel.tsx` — Add button in export modal
- `web/src/ux-checklist/exportMarkdown.ts` — New file with export logic

## Acceptance criteria
- [ ] Markdown renders correctly on GitHub
- [ ] Tables are properly aligned
- [ ] Failed/warn items highlighted with emoji markers
- [ ] File downloads with correct filename
- [ ] Unit test for `exportMarkdown()` function

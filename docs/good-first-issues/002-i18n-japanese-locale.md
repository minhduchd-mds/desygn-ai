# Add Japanese Locale (i18n)

**Labels:** `good-first-issue`, `enhancement`, `i18n`

## Context
The app has bilingual README (Vietnamese + English) but UI text is hardcoded. This issue adds Japanese as the first i18n locale to establish the translation pattern.

## Requirements
- Create `web/src/i18n/` directory with locale JSON files
- Add `ja.json` with translations for the checklist panel (approx 40 strings)
- Add `en.json` as the base English locale
- Add `vi.json` as Vietnamese locale
- Create a `useTranslation()` hook or use a lightweight library
- Add language selector dropdown in Settings

## Scope (checklist panel only)
Translate strings in:
- `web/src/ux-checklist/ChecklistPanel.tsx`
- Filter tab labels (All, UI, UX, Pass, Fail, Warn)
- Score card labels (Visual Design, Typography, Accessibility, Interaction)
- Export report modal

## Acceptance criteria
- [ ] Japanese translations display correctly
- [ ] Language preference stored in localStorage
- [ ] No hardcoded strings remain in ChecklistPanel
- [ ] Other panels unaffected (translate later)

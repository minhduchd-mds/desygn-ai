# Add Dark/Light Theme Toggle

**Labels:** `good-first-issue`, `enhancement`, `ui`

## Context
The web workspace currently supports dark theme only (as per CLAUDE.md: "Dark theme only"). We want to add a theme toggle so users can switch between dark and light modes.

## Requirements
- Add a toggle button in the sidebar header (sun/moon icon)
- Store preference in `localStorage` key `desygn-theme`
- Apply `data-theme="light"` or `data-theme="dark"` attribute on `<html>`
- Create `_variables-light.scss` with light mode color overrides
- Default to system preference via `prefers-color-scheme`

## Files to modify
- `web/src/components/Sidebar.tsx` — Add toggle button
- `web/src/styles/_variables.scss` — Extract to dark/light variants
- `web/src/styles/_variables-light.scss` — New file
- `web/src/styles/global.scss` — Add `[data-theme="light"]` selector

## Acceptance criteria
- [ ] Toggle switches between dark and light themes
- [ ] Preference persists across page reloads
- [ ] All existing components readable in both themes
- [ ] No CSS Module changes break existing styles
- [ ] Storybook stories render correctly in both themes

# Add Keyboard Shortcuts

**Labels:** `good-first-issue`, `enhancement`, `accessibility`, `ux`

## Context
The web workspace has no keyboard shortcuts. Power users need fast navigation between panels and common actions.

## Requirements
- Create `web/src/lib/useKeyboardShortcuts.ts` hook
- Register shortcuts via the existing `eventBus` system
- Add a "Keyboard Shortcuts" help modal (triggered by `?` key)

## Shortcut map
| Key | Action |
|-----|--------|
| `?` | Show shortcuts help |
| `Ctrl+1` | Switch to Chat panel |
| `Ctrl+2` | Switch to Checklist panel |
| `Ctrl+3` | Switch to Builder panel |
| `Ctrl+E` | Open export dialog |
| `Ctrl+K` | Focus search input |
| `Escape` | Close active modal/dialog |

## Files to create/modify
- `web/src/lib/useKeyboardShortcuts.ts` — New hook
- `web/src/components/KeyboardShortcutsModal.tsx` — New component
- `web/src/App.tsx` — Register the hook
- `web/src/lib/__tests__/useKeyboardShortcuts.test.ts` — Tests

## Acceptance criteria
- [ ] All shortcuts work as described
- [ ] Help modal shows all available shortcuts
- [ ] Shortcuts disabled when typing in input/textarea
- [ ] No conflicts with browser defaults
- [ ] Works on both Mac (Cmd) and Windows/Linux (Ctrl)

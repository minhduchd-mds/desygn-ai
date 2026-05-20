# BA Handoff Guide - Desygn AI Output

## What is DESIGN.md?

DESIGN.md is a structured specification file that AI coding agents
(GPT Codex, Claude Code, Cursor, Windsurf) read to understand your UI
requirements before writing any code. Think of it as a bridge between
your design system and the code generator.

## How to read this document

Each `## Screen:` section describes one screen of your application.
Under each screen you will find:

- **Layout**: grid structure and navigation position
- **Components**: table of UI components with variants and props
- **Color tokens**: design system tokens used on this screen
- **Spacing**: key spacing rules
- **Interactions**: user flows and state changes

## How to update this document

1. Open the screen section you want to modify
2. Edit the relevant table or list
3. Save - the AI coding agent will pick up changes on next run

## Component naming convention

Component names match your Figma component set names exactly.
If listed as `Button/Primary`, your Figma file should have a component
named `Button` with a variant property `Type = Primary`.

## Color tokens

Token names use CSS custom property format: `--color-primary`.
These should match your Figma local variables exactly.

## Adding a note for the AI agent

Add a `> Note:` blockquote with your instruction anywhere in the document.
The AI agent will incorporate it as a constraint.

Example:
> Note: The login screen must support SSO via Google OAuth only.
> Do not implement email/password login.

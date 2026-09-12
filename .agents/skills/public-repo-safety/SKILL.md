---
name: public-repo-safety
description: Use when adding examples, fixtures, screenshots, documentation, datasets, prompts, design rules, templates, assets, logs, exports or content derived from external work.
---

# Public Repository Safety

## Goal
Keep the public repository independently authored, neutral, and free of private/customer/proprietary material.

## Procedure
1. Identify the origin of every non-code asset, checklist, screenshot, template, fixture or copied text.
2. Reject material sourced from private client work, internal systems, confidential documents, customer-specific design systems or non-public datasets.
3. Replace real names, identifiers, URLs, screenshots and business data with synthetic neutral examples.
4. For standards-based behavior, implement from public standards and document provenance without copying protected prose beyond what is necessary.
5. Check generated artifacts/logs/fixtures for accidental secrets, identifiers and customer references.
6. Ensure examples demonstrate the capability without recreating a private product or internal interface.

## Reject
- private screenshots/assets;
- customer/company branding unrelated to Desygn itself;
- proprietary checklists/rules copied from client work;
- credentials, private URLs, internal hostnames, personal data or exported production data;
- generated content that reproduces private source material.

## Output
Provenance summary, sanitization performed and pass/fail result for public-repository inclusion.

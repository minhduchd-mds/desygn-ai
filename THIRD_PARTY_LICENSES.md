# Third-Party Licenses (SBOM)

This document lists the production dependencies of **Desygn AI** and their respective licenses.

Generated from `package.json` `dependencies` (12 packages).  
To regenerate: `sh scripts/generate-sbom.sh`

---

## Production Dependencies

| Package | Version | License | Homepage / Repository |
|---------|---------|---------|----------------------|
| `@ai-sdk/groq` | 3.0.39 | Apache-2.0 | https://ai-sdk.dev/docs |
| `@supabase/supabase-js` | 2.105.4 | MIT | https://github.com/supabase/supabase-js |
| `@upstash/ratelimit` | 2.0.8 | MIT | https://github.com/upstash/ratelimit |
| `@upstash/redis` | 1.38.0 | MIT | https://github.com/upstash/upstash-redis |
| `ai` | 6.0.184 | Apache-2.0 | https://ai-sdk.dev/docs |
| `dompurify` | 3.4.4 | MPL-2.0 OR Apache-2.0 | https://github.com/cure53/DOMPurify |
| `highlight.js` | 11.11.1 | BSD-3-Clause | https://highlightjs.org/ |
| `jszip` | 3.10.1 | MIT OR GPL-3.0-or-later | https://github.com/Stuk/jszip |
| `marked` | 18.0.3 | MIT | https://marked.js.org |
| `marked-highlight` | 2.2.4 | MIT | https://github.com/markedjs/marked-highlight |
| `openai` | 6.38.0 | Apache-2.0 | https://github.com/openai/openai-node |
| `zod` | 4.4.3 | MIT | https://zod.dev |

---

## License Summary

| License | Count | Packages |
|---------|-------|----------|
| MIT | 6 | @supabase/supabase-js, @upstash/ratelimit, @upstash/redis, marked, marked-highlight, zod |
| Apache-2.0 | 3 | @ai-sdk/groq, ai, openai |
| BSD-3-Clause | 1 | highlight.js |
| MPL-2.0 OR Apache-2.0 | 1 | dompurify |
| MIT OR GPL-3.0-or-later | 1 | jszip |

---

## Notes

- **MIT**: Permissive license — allows use, copy, modify, merge, publish, distribute, sublicense.
- **Apache-2.0**: Permissive license with patent grant and attribution requirement.
- **BSD-3-Clause**: Permissive license requiring attribution in source and binary distributions.
- **MPL-2.0 OR Apache-2.0** (DOMPurify): Dual-licensed; either Mozilla Public License 2.0 or Apache 2.0 may be chosen.
- **MIT OR GPL-3.0-or-later** (JSZip): Dual-licensed; MIT chosen for this project.

This project itself is licensed under **MIT**. See [LICENSE](LICENSE) for details.

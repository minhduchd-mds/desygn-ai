# Self-Hosting Desygn AI

This guide covers running Desygn AI on your own infrastructure.

> For the full developer setup guide see [DEV_GUIDE.md](./DEV_GUIDE.md).
> For the API reference see [API.md](./API.md).

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker)](#quick-start-docker)
3. [Manual Setup](#manual-setup)
4. [Environment Variables](#environment-variables)
5. [Supabase Setup](#supabase-setup)
6. [Vercel Deployment](#vercel-deployment)
7. [Nginx Reverse Proxy](#nginx-reverse-proxy)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Minimum requirements

| Component | Minimum | Recommended |
|---|---|---|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Storage | 5 GB | 20 GB |
| Node.js | 20 LTS | 22 LTS |
| npm | 10 | 10+ |

### Required accounts / services

| Service | Required for | Notes |
|---|---|---|
| [Groq](https://console.groq.com) | All AI features | Free tier available. Powers `chat-stream`, `analyze-image`, `generate-html`, `generate-screens`. |
| [Upstash Redis](https://upstash.com) | Rate limiting | Free tier (10k requests/day). Graceful degradation: if not configured, all requests are allowed. |
| [Supabase](https://supabase.com) | Project version persistence | Optional. Falls back to `localStorage` when not configured. |
| [GitHub](https://github.com) | GitHub integration | Personal access token with `repo` scope. Only required if using the GitHub issue/webhook endpoints. |
| [Figma](https://www.figma.com) | Plugin (plugin side only) | Required to run the Figma plugin. Not required for the web workspace standalone. |

### Optional services

| Service | Purpose |
|---|---|
| [Anthropic](https://console.anthropic.com) | Alternative AI provider (`ANTHROPIC_API_KEY`) |
| Google OAuth | `VITE_GOOGLE_CLIENT_ID` — enables "Continue with Google" sign-in |

---

## Quick Start (Docker)

### 1. Clone the repository

```bash
git clone https://github.com/minhduchd-mds/desygn-ai.git
cd desygn-ai
```

### 2. Create environment file

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your values (see [Environment Variables](#environment-variables) below).

### 3. Start with Docker Compose

```yaml
# docker-compose.yml
version: "3.9"

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.local
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Optional: add Redis if you prefer self-hosted rate limiting
  # redis:
  #   image: redis:7-alpine
  #   ports:
  #     - "6379:6379"
  #   restart: unless-stopped
```

```bash
docker compose up -d
```

The app will be available at `http://localhost:3000`.

### 4. Build the Figma plugin (optional)

The plugin runs inside Figma and does not use Docker. Build it separately:

```bash
npm run build
```

Load `dist/` as an unpublished Figma plugin via `Figma menu → Plugins → Development → Import plugin from manifest`.

---

## Manual Setup

### 1. Install dependencies

```bash
npm install
```

This installs all workspace dependencies (root + `web/` + `api/`).

### 2. Set environment variables

```bash
cp .env.local.example .env.local
# Edit .env.local — see Environment Variables section
```

### 3. Development mode

```bash
npm run dev
```

This starts:
- The web UI (Vite dev server, hot reload)
- The plugin build in watch mode

### 4. Production build

```bash
npm run build
```

Output:
- `public/` — web UI static files (ready for any static host)
- `dist/` — Figma plugin bundle
- `api/` — Vercel serverless functions (deployed as-is to Vercel)

### 5. Run the web UI locally with API

The API functions require Vercel CLI for local development:

```bash
npm install -g vercel
vercel dev
```

This starts the full stack (Vite frontend + serverless functions) on `http://localhost:3000`.

---

## Environment Variables

Copy `.env.local.example` to `.env.local`. All variables with `VITE_` prefix are injected into the browser bundle at build time. Variables without that prefix are server-side only.

### AI providers

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | **Yes** | Groq API key. Used by all AI endpoints (`chat-stream`, `analyze-image`, `generate-html`, `generate-screens`, `bootstrap-context`). Get from [console.groq.com](https://console.groq.com). |
| `ANTHROPIC_API_KEY` | No | Anthropic API key. Alternative AI provider. Get from [console.anthropic.com](https://console.anthropic.com). |

### Rate limiting (Upstash Redis)

| Variable | Required | Description |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis REST URL. Format: `https://<id>.upstash.io`. If omitted, rate limiting is disabled (all requests allowed). |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis REST token. Required when `UPSTASH_REDIS_REST_URL` is set. |

Both variables must be set together. If either is missing, the rate limiter gracefully degrades to allow-all mode with a console warning.

Default limits (requests per 60-second sliding window per IP):

| Endpoint | Limit |
|---|---|
| `/api/chat-stream` | 20 |
| `/api/analyze-image` | 20 |
| `/api/checklist/audit-web` | 10 |
| `/api/github/create-checklist-issues` | 20 |
| `/api/github/sync-webhook` | 50 |

### Supabase (project persistence)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | No | Your Supabase project URL. Format: `https://<project-id>.supabase.co`. |
| `VITE_SUPABASE_ANON_KEY` | No | Supabase anon (public) key from your project's API settings. |

When not configured, project versions are stored in the browser's `localStorage` only (not synced across devices or browsers).

### GitHub integration

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | No* | GitHub personal access token with `repo` scope. Required for `POST /api/github/create-checklist-issues`. |
| `GITHUB_WEBHOOK_SECRET` | No* | HMAC secret for verifying webhook payloads from GitHub. Required for `POST /api/github/sync-webhook`. If absent, signature verification is skipped with a warning. |

*Required only if you use those specific endpoints.

### Client-side variables

| Variable | Required | Description |
|---|---|---|
| `VITE_ANALYZE_IMAGE_URL` | No | URL for the image analysis API. Defaults to `/api/analyze-image`. Override if running the API on a different host. |
| `VITE_GOOGLE_CLIENT_ID` | No | Google OAuth client ID. If omitted, the "Continue with Google" button is hidden. Format: `<id>.apps.googleusercontent.com`. Get from [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials. |
| `VITE_SCREENSHOT_TO_CODE_WS_URL` | No | WebSocket URL for the screenshot-to-code service (optional add-on). Leave empty to disable. |

### Runtime / infrastructure

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | No | Set to `production` in production deployments. In development mode, CORS is permissive (`*`). |

---

## Supabase Setup

Supabase provides persistence for projects, audit runs, evidence, and RBAC. Without it, the app falls back to `localStorage`.

### Option A: Local development (recommended for contributors)

```bash
# Prerequisites: Docker Desktop + Supabase CLI
npm install -g supabase

# One-command setup — starts Supabase, applies all migrations, seeds demo data
chmod +x scripts/setup-local-db.sh
./scripts/setup-local-db.sh
```

This runs 3 migrations automatically:
- `001_project_versions.sql` — Projects + design versions
- `002_audit_evidence.sql` — Audit runs, checklist results, evidence, GitHub links, agent logs
- `003_user_profiles_rbac.sql` — User profiles, project members, API keys, RLS

Plus `seed.sql` with demo project data for development.

### Option B: Hosted Supabase

1. Create a project at [app.supabase.com](https://app.supabase.com)
2. Note the **Project URL** and **Anon key** from `Settings > API`
3. Apply migrations in order via `SQL Editor > New query`:
   - `supabase/migrations/001_project_versions.sql`
   - `supabase/migrations/002_audit_evidence.sql`
   - `supabase/migrations/003_user_profiles_rbac.sql`
4. Optionally run `supabase/seed.sql` for demo data

### Environment variables

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co  # or http://127.0.0.1:54321 for local
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Database schema overview

| Table | Purpose |
|---|---|
| `projects` | User projects |
| `project_versions` | Design.md version history |
| `design_context_versions` | Figma/screenshot/URL design context snapshots |
| `audit_runs` | Audit execution records |
| `checklist_results` | Per-criterion results per audit |
| `evidence_artifacts` | Screenshots, node refs, observed vs expected |
| `github_issues` / `github_pull_requests` | Linked GitHub items |
| `agent_runs` | AI agent execution log (cost, latency) |
| `user_profiles` | Display name, avatar, global role |
| `project_members` | Project-level RBAC |
| `api_keys` | CI/CD integration keys |

### Notes

- All tables use Row Level Security (RLS) — users only see their own data
- The client falls back to `localStorage` if Supabase is unavailable
- The `user_profiles` trigger auto-creates a profile on signup

---

## Vercel Deployment

Desygn AI is designed to deploy on Vercel. The `vercel.json` in the repository root configures the deployment.

### 1. Connect your repository

```bash
npm install -g vercel
vercel login
vercel link   # links to an existing project, or creates one
```

Or connect via the Vercel dashboard: `New Project → Import Git Repository`.

### 2. Configure environment variables

In the Vercel dashboard (`Project → Settings → Environment Variables`) or via CLI:

```bash
vercel env add GROQ_API_KEY production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add GITHUB_TOKEN production
vercel env add GITHUB_WEBHOOK_SECRET production
```

For `VITE_` variables (browser-side), also add them in the Vercel dashboard so they are injected at build time.

### 3. Deploy

```bash
vercel --prod
```

Or push to your connected Git branch — Vercel deploys automatically on push to `main`.

### Build configuration (from `vercel.json`)

| Setting | Value |
|---|---|
| Build command | `npm run web:build` |
| Output directory | `public` |
| Install command | `npm ci` |

### Security headers

The following security headers are set on all routes:

| Header | Value |
|---|---|
| `Content-Security-Policy` | Restricts scripts to `self` + Google GSI; images to `self`, `data:`, `blob:`, Google avatars |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |

### Serverless function runtimes

| Endpoint | Runtime | Max duration |
|---|---|---|
| `/api/chat-stream` | Edge | 30 s |
| All other `/api/*` | Node.js serverless | 10 s (Vercel default) |

---

## Nginx Reverse Proxy

Use this configuration when self-hosting behind Nginx (e.g., on a VPS).

```nginx
upstream designai_app {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP → HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # TLS certificates (use Certbot / Let's Encrypt)
    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Modern TLS settings
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache   shared:SSL:10m;
    ssl_stapling        on;
    ssl_stapling_verify on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API routes — proxy to Node.js
    location /api/ {
        proxy_pass         http://designai_app;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 35s;    # Slightly above the 30s edge function max
        proxy_buffering    off;    # Required for Server-Sent Events (chat-stream)
    }

    # Static files — serve from build output
    location / {
        root  /path/to/desygn-ai/public;
        index index.html;
        try_files $uri $uri/ /index.html;  # SPA fallback

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Webhook endpoint — increase body size for large payloads
    location /api/github/sync-webhook {
        client_max_body_size 10m;
        proxy_pass http://designai_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Hub-Signature-256 $http_x_hub_signature_256;
        proxy_set_header X-GitHub-Event $http_x_github_event;
    }
}
```

**Install Let's Encrypt certificate:**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

**Important:** The `proxy_buffering off` directive is required for the streaming chat endpoint (`/api/chat-stream`). Without it, Nginx will buffer the entire SSE stream before forwarding it to the client, breaking the real-time experience.

---

## Troubleshooting

### AI responses are empty or failing

1. Verify `GROQ_API_KEY` is set and valid: `curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models`
2. Check for rate limits on the Groq console dashboard.
3. Review server logs for `GROQ_API_KEY not configured` errors.

### Rate limiting is not working

1. Verify both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.
2. Test connectivity: `curl $UPSTASH_REDIS_REST_URL/ping -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"`
3. If Redis is unreachable, the system degrades to allow-all with a console warning — no requests will be rejected.

### GitHub webhook signature verification is failing

1. Ensure the same secret is set in both GitHub (`Repository Settings → Webhooks → Secret`) and the `GITHUB_WEBHOOK_SECRET` env var.
2. The raw request body must be used for HMAC calculation. If you have a reverse proxy that re-encodes the body (e.g., JSON pretty-printing), signature verification will fail. Ensure the proxy passes the body through unmodified.
3. Verify the `Content-Type` sent by GitHub is `application/json` (not `application/x-www-form-urlencoded`).

### GitHub issues are not being created

1. Check `GITHUB_TOKEN` is set with `repo` scope: `curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user`
2. Verify the `repo` field in the request body uses `owner/repo` format.
3. Confirm the token has write access to the target repository.
4. Check the response body for `"setup"` hints when a 500 is returned.

### Supabase connection fails / project versions not saving

1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly.
2. Confirm the `project_versions` table exists (run the setup SQL above).
3. Check the browser console for Supabase error messages — the app falls back to `localStorage` automatically, so data is not lost.
4. If using Row Level Security, ensure your policy allows anon reads/writes.

### Streaming chat is not working behind Nginx

Ensure `proxy_buffering off` is set for the `/api/chat-stream` location block. Without this, Nginx buffers the response and the client receives nothing until the full response is complete, which defeats the streaming behavior.

### Plugin fails to connect to the UI

- In development mode, the plugin opens the UI at the port Vite is running on. Ensure the dev server is running.
- CORS in development mode is permissive (`*`). In production, the allowed origin is derived from the request's `Origin` header — ensure the Figma plugin's UI URL matches your deployment domain.
- The `SCAN_TIMEOUT_MS` constant (10 000 ms) controls how long the UI waits for a plugin response before timing out. If the plugin is slow to serialize large files, you may see timeout errors in the UI.

### Build errors on Vercel

- If you see registry-related errors in `package-lock.json`, run `npm install` locally and commit the updated lockfile. The project uses `npm ci` on Vercel by default.
- Verify the `VITE_` environment variables are set in the Vercel dashboard before the build runs — they are injected at build time, not runtime.

### Memory engine is full

The `EvidenceMemoryEngine` defaults to `maxRecords: 10000`. When full, it attempts garbage collection (removes records below `gcThreshold: 0.05` confidence). If GC cannot free enough space, `storeEvidence()` throws `"Memory limit reached"`. To address:
- Increase `maxRecords` in the engine configuration.
- Call `engine.garbageCollect()` manually before storing new evidence.
- Reduce `gcThreshold` to be more aggressive about removing low-confidence records.

### Self-hosted edition limits

| Edition | Max users | Max projects | AI requests/day | Concurrent generations |
|---|---|---|---|---|
| `community` | 5 | 10 | 100 | 1 |
| `team` | 25 | 50 | 1 000 | 5 |
| `enterprise` | Unlimited | Unlimited | Unlimited | 20 |

Edition features:
- **Community:** basic scanning, design-md export, single framework, local AI
- **Team:** all community + multi-framework, git sync, marketplace, SSO, audit log
- **Enterprise:** all team + custom plugins, multi-tenant, compliance, priority support, air-gapped mode

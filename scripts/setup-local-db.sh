#!/usr/bin/env bash
# scripts/setup-local-db.sh
# One-command local Supabase setup for contributors.
#
# Usage:
#   chmod +x scripts/setup-local-db.sh
#   ./scripts/setup-local-db.sh
#
# Prerequisites:
#   - Docker Desktop running
#   - Supabase CLI: npm install -g supabase

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Desygn AI — Local Database Setup ===${NC}"
echo ""

# 1. Check prerequisites
if ! command -v supabase &> /dev/null; then
  echo -e "${RED}Error: supabase CLI not found.${NC}"
  echo "Install: npm install -g supabase"
  exit 1
fi

if ! docker info &> /dev/null 2>&1; then
  echo -e "${RED}Error: Docker is not running.${NC}"
  echo "Please start Docker Desktop and try again."
  exit 1
fi

# 2. Start Supabase
echo -e "${YELLOW}Starting Supabase local stack...${NC}"
supabase start

# 3. Apply migrations
echo -e "${YELLOW}Applying migrations...${NC}"
supabase db reset

# 4. Show connection info
echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Local services:"
echo "  Studio:     http://127.0.0.1:54323"
echo "  API:        http://127.0.0.1:54321"
echo "  DB:         postgresql://postgres:postgres@127.0.0.1:54322/postgres"
echo ""
echo "Add to .env.local:"

STATUS=$(supabase status --output json 2>/dev/null || echo "{}")
API_URL=$(echo "$STATUS" | grep -o '"API_URL":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "http://127.0.0.1:54321")
ANON_KEY=$(echo "$STATUS" | grep -o '"ANON_KEY":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "<check supabase status>")

echo ""
echo "  VITE_SUPABASE_URL=$API_URL"
echo "  VITE_SUPABASE_ANON_KEY=$ANON_KEY"
echo ""
echo -e "${GREEN}Run 'npm run dev' to start the app.${NC}"

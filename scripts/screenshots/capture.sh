#!/usr/bin/env bash
# Regenerates the README screenshots from the real UI.
#
# Renders the actual React app against an in-memory stub backend with fake
# demo data, so no real secret is ever captured. Requires Google Chrome.
#
#   npm run dev            # in one terminal
#   ./scripts/screenshots/capture.sh
set -euo pipefail

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
URL="${URL:-http://localhost:1420/scripts/screenshots/index.html}"
OUT="$(cd "$(dirname "$0")/../.." && pwd)/.github/assets"

[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME (override with CHROME=...)"; exit 1; }
curl -sfo /dev/null "$URL" || { echo "Dev server not reachable at $URL. Run 'npm run dev' first."; exit 1; }

mkdir -p "$OUT"
shoot() {
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=2 --window-size=1280,700 --virtual-time-budget=9000 \
    --screenshot="$OUT/$1.png" "$URL?$2" >/dev/null 2>&1
  echo "  wrote $1.png"
}

shoot screenshot-dark     "theme=dark&scene=reveal"
shoot screenshot-light    "theme=light&scene=reveal"
shoot screenshot-raw      "theme=dark&scene=raw"
shoot screenshot-conflict "theme=dark&scene=conflict"

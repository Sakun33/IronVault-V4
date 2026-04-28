#!/usr/bin/env bash
# Rebuild client/public/chrome-extension.zip from chrome-extension/ source.
# Run after editing the extension; the resulting ZIP is shipped as a static
# asset and downloaded by users from the in-app extension prompt.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/client/public/chrome-extension.zip"

rm -f "$OUT"
(cd "$ROOT/chrome-extension" && zip -rq "$OUT" . \
  -x ".DS_Store" "node_modules/*" "*.DS_Store")

echo "wrote $(wc -c < "$OUT") bytes -> client/public/chrome-extension.zip"

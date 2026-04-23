#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-localhost}"
TEMPLATE="$(dirname "$0")/nginx.conf.template"
OUTPUT="$(dirname "$0")/nginx.conf"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Template not found: $TEMPLATE" >&2
  exit 1
fi

sed "s/\${DOMAIN}/${DOMAIN}/g" "$TEMPLATE" > "$OUTPUT"
echo "Generated: $OUTPUT (DOMAIN=${DOMAIN})"

#!/usr/bin/env bash
# Usage: bash scripts/checkpoint.sh <label>   e.g. phase2-data
# Runs `aiden doctor` and `aiden upgrade --dry-run`, saves both outputs, and fails on a red doctor.
set -u
LABEL=${1:?label required}; TS=$(date +%Y%m%d-%H%M%S)
DIR=docs/evidence/checkpoints; mkdir -p "$DIR"
CLI="npx @upstart13-com/aiden-cli"

echo "== [$LABEL] aiden doctor"
$CLI doctor 2>&1 | tee "$DIR/${TS}_${LABEL}_doctor.txt"; DOC=${PIPESTATUS[0]}

echo "== [$LABEL] aiden upgrade --dry-run"
if [ -n "$(git status --porcelain)" ]; then
  echo "SKIPPED: working tree dirty. Commit first, then re-run." | tee "$DIR/${TS}_${LABEL}_upgrade.txt"; UPG=2
else
  $CLI upgrade --dry-run 2>&1 | tee "$DIR/${TS}_${LABEL}_upgrade.txt"; UPG=${PIPESTATUS[0]}
fi

printf "%s | %s | doctor=%s | upgrade-dry-run=%s\n" "$TS" "$LABEL" "$DOC" "$UPG" | tee -a "$DIR/LOG.md"
[ "$DOC" -eq 0 ] || { echo "DOCTOR RED: fix before continuing"; exit 1; }
[ "$UPG" -ne 2 ] || { echo "UPGRADE SKIPPED: commit and re-run"; exit 1; }

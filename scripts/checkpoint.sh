#!/usr/bin/env bash
# Usage: bash scripts/checkpoint.sh <label>   e.g. phase2-data
# Runs `aiden doctor` and `aiden upgrade --dry-run`, saves both outputs, and fails on a red doctor.
# The upgrade dry-run ALWAYS runs: a dirty tree is recorded and fails the checkpoint
# afterwards, but it never skips the check.
set -u
LABEL=${1:?label required}; TS=$(date +%Y%m%d-%H%M%S)
DIR=docs/evidence/checkpoints; mkdir -p "$DIR"
CLI="npx @upstart13-com/aiden-cli"

# Build artefacts must never dirty the tree. next-env.d.ts is rewritten differently by
# `next dev` and `next build`, so it has to stay untracked and ignored.
if git ls-files --error-unmatch next-env.d.ts >/dev/null 2>&1 || ! git check-ignore -q --no-index next-env.d.ts; then
  echo "GUARD FAILED: next-env.d.ts must be untracked and gitignored (git rm --cached next-env.d.ts)"; exit 1
fi

# Check before doctor writes its output file, which would itself dirty the tree.
DIRTY=$(git status --porcelain)
HEAD=$(git rev-parse --short HEAD)
if [ -n "$DIRTY" ]; then TREE="dirty($(printf "%s\n" "$DIRTY" | wc -l | tr -d " "))"; else TREE=clean; fi

echo "== [$LABEL] aiden doctor"
$CLI doctor 2>&1 | tee "$DIR/${TS}_${LABEL}_doctor.txt"; DOC=${PIPESTATUS[0]}

echo "== [$LABEL] aiden upgrade --dry-run (head $HEAD, tree $TREE)"
{
  echo "head: $HEAD"; echo "tree: $TREE"
  [ -n "$DIRTY" ] && printf "uncommitted:\n%s\n" "$DIRTY"
  echo
} > "$DIR/${TS}_${LABEL}_upgrade.txt"
# aiden-cli 2.0.1 resolves "latest" via spawnSync("npm") without a shell, which
# fails with ENOENT on Windows (npm is npm.cmd). Resolve it here and pass --target.
LATEST=$(npm view @upstart13-com/aiden-ai version 2>/dev/null)
if [ -z "$LATEST" ]; then
  echo "could not resolve the latest aiden version from the registry" | tee -a "$DIR/${TS}_${LABEL}_upgrade.txt"; UPG=3
else
  $CLI upgrade --dry-run --target "$LATEST" 2>&1 | tee -a "$DIR/${TS}_${LABEL}_upgrade.txt"; UPG=${PIPESTATUS[0]}
fi

printf "%s | %s | doctor=%s | upgrade-dry-run=%s | tree=%s | head=%s\n" "$TS" "$LABEL" "$DOC" "$UPG" "$TREE" "$HEAD" | tee -a "$DIR/LOG.md"
[ "$DOC" -eq 0 ] || { echo "DOCTOR RED: fix before continuing"; exit 1; }
[ "$UPG" -eq 0 ] || { echo "UPGRADE DRY-RUN FAILED (exit $UPG): fix before continuing"; exit 1; }
[ -z "$DIRTY" ] || { echo "TREE DIRTY: checks ran, but commit and re-run for a record tied to a commit"; exit 1; }

#!/usr/bin/env bash
# One-command smoke run against a local server with the seeded data:
# signs in agent1@acme.test and viewer@acme.test with SEED_PASSWORD from
# .env.local, exports the cookies and seeded ticket ids scripts/smoke.sh
# expects, then runs it.   Usage: bash scripts/smoke-local.sh [base-url]
set -u
BASE=${1:-${BASE:-http://localhost:3000}}
PW=$(node -e 'const s=require("fs").readFileSync(".env.local","utf8");const m=s.match(/^SEED_PASSWORD="?([^"\r\n]+)/m);process.stdout.write(m?m[1]:"")')
[ -n "$PW" ] || { echo "Set SEED_PASSWORD in .env.local (and run npm run db:seed) first."; exit 1; }

JAR_DIR=$(mktemp -d)
trap 'rm -f "$JAR_DIR"/*.jar; rmdir "$JAR_DIR" 2>/dev/null' EXIT
signin() { # email -> "authjs.session-token=..." on stdout
  local jar="$JAR_DIR/$2.jar" csrf
  csrf=$(curl -s -c "$jar" "$BASE/api/auth/csrf" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).csrfToken))')
  curl -s -o /dev/null -b "$jar" -c "$jar" -X POST "$BASE/api/auth/callback/credentials" \
    --data-urlencode "csrfToken=$csrf" --data-urlencode "email=$1" --data-urlencode "password=$PW"
  local tok
  tok=$(grep session-token "$jar" | awk '{print $7}')
  [ -n "$tok" ] || { echo "Sign-in failed for $1 (wrong SEED_PASSWORD, not seeded, or rate-limited: wait a minute)." >&2; return 1; }
  echo "authjs.session-token=$tok"
}

A_AGENT1=$(signin agent1@acme.test agent1) || exit 1
A_VIEWER=$(signin viewer@acme.test viewer) || exit 1

# Fixed ids from prisma/seed.ts (also printed by npm run db:seed).
export BASE A_AGENT1 A_VIEWER
export A_T1=cdeskline0ticket0a1 A_T_AGENT2=cdeskline0ticket0a3 B_T1=cdeskline0ticket0b1
bash scripts/smoke.sh

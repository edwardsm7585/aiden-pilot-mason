#!/usr/bin/env bash
# DeskLine perimeter smoke suite. Only the HTTP status code is graded.
# Export session cookies (e.g. A_AGENT1="authjs.session-token=...") and the
# seed ids printed by `npm run db:seed`, then: bash scripts/smoke.sh
set -u; BASE=${BASE:-http://localhost:3000}
: "${A_AGENT1:?}" "${A_VIEWER:?}" "${A_T1:?}" "${A_T_AGENT2:?}" "${B_T1:?}"
MISSING=cl0000000000000000000000   # valid cuid format, so it gets past Zod to 404
J='Content-Type: application/json'; pass=0; fail=0
code(){ curl -s -o /dev/null -w "%{http_code}" "$@"; }
probe(){ if [ "$2" = "$3" ]; then echo "PASS $1 ($3)"; pass=$((pass+1)); else echo "FAIL $1 expected $2 got $3"; fail=$((fail+1)); fi; }

probe "1 unauthenticated GET /api/tickets"         401 "$(code "$BASE/api/tickets")"
probe "2 malformed create body"                    400 "$(code -X POST -H "Cookie: $A_AGENT1" -H "$J" -d '{"subject":""}' "$BASE/api/tickets")"
probe "3 cross-tenant GET"                         404 "$(code -H "Cookie: $A_AGENT1" "$BASE/api/tickets/$B_T1")"
probe "4 IDOR PATCH other agent same-org"          404 "$(code -X PATCH -H "Cookie: $A_AGENT1" -H "$J" -d '{"subject":"x"}' "$BASE/api/tickets/$A_T_AGENT2")"
probe "5 missing id"                               404 "$(code -H "Cookie: $A_AGENT1" "$BASE/api/tickets/$MISSING")"
probe "6 viewer POST draft"                        403 "$(code -X POST -H "Cookie: $A_VIEWER" -H "$J" -d '{"tone":"friendly"}' "$BASE/api/tickets/$A_T1/draft")"

if diff <(curl -s -H "Cookie: $A_AGENT1" "$BASE/api/tickets/$B_T1") <(curl -s -H "Cookie: $A_AGENT1" "$BASE/api/tickets/$MISSING") >/dev/null
then echo "PASS 7 404 bodies identical (no enumeration leak)"; pass=$((pass+1)); else echo "FAIL 7 404 bodies differ"; fail=$((fail+1)); fi
echo "== $pass passed, $fail failed"; [ "$fail" -eq 0 ]

#!/usr/bin/env bash
# DeskLine auto-fail and convention sweep. Every check must print nothing.
# Any output = fix before submitting.
#
# Exceptions are explicit and themselves asserted, so they can't silently
# cover new code. Each is documented where it's applied:
#   E1  Public routes without withAuth: NextAuth's own handler and the public
#       register endpoint (rate-limited). Asserted below.
#   E2  Pages without a direct PageHeader: the public marketing page, the
#       redirect-only /dashboard page, and settings pages whose PageHeader is
#       rendered once by settings/layout.tsx (DS 08 "Settings Page" pattern).
#       Asserted below.
#   E3  createAIClient count: string-literal code samples in the marketing
#       page are not calls; count real calls outside (marketing).
#   E4  Duplicate aiden-logging: count installed copies, not npm's "deduped"
#       back-references.
fails=0
chk(){ out=$(eval "$2" 2>/dev/null); if [ -n "$out" ]; then echo "FAIL: $1"; echo "$out" | head -20; fails=$((fails+1)); else echo "ok:   $1"; fi; }

# ── Perimeter ────────────────────────────────────────────────────────────────
PUBLIC_ROUTES='src/app/api/auth/\[\.\.\.nextauth\]/route.ts|src/app/api/auth/register/route.ts'
chk "route without withAuth (E1 excluded)" 'grep -rLE "withAuth" src/app/api --include=route.ts | grep -vE "^($PUBLIC_ROUTES)$"'
chk "E1: nextauth route only re-exports handlers" 'grep -vE "^\s*$|^import \{ handlers \} from \"@/lib/auth\";$|^export const \{ GET, POST \} = handlers;$" "src/app/api/auth/[...nextauth]/route.ts"'
chk "E1: register route is rate-limited" 'grep -q "withRateLimit(" src/app/api/auth/register/route.ts || echo "register route lost withRateLimit"'
chk "raw req.json()"                      'grep -rn "req\.json()" src'
chk "inline owner comparison"             'grep -rnE "(userId|ownerId)\s*===" src/app'
chk "findUnique on tenant tables in routes" 'grep -rnE "(ticket|membership)\.findUnique" src/app/api'
# src/generated is the gitignored Prisma client (vendor code), not app code.
chk "no-ship sinks"                       'grep -rnE --exclude-dir=generated "\\\$executeRawUnsafe|\beval\(|new Function\(|dangerouslySetInnerHTML" src'
chk "server-only in client files"         'for f in $(grep -rl "\"use client\"" src); do grep -HnE "server-only|@/lib/(ai|ai-usage|tenancy|triage|audit|prisma|deskline-data|auth|security|abilities|ticket-prompt)\"" "$f"; done'

# ── Logging / AI ─────────────────────────────────────────────────────────────
chk "console.log in API"                  'grep -rn "console\.log" src/app/api src/lib'
chk "logged bodies/prompts"               'grep -rnE "log\.(info|warn|error|debug)\(.*(body|input|prompt|text)" src'
chk "direct LLM fetch / vendor SDK"       'grep -rnE "api\.anthropic|api\.openai|generativelanguage|from \"(@anthropic-ai|openai)" src'
chk "hand-rolled SSE / WebSocket"         'grep -rnE "text/event-stream|new EventSource|WebSocket|getReader\(" src'
chk "JSON.parse/regex on AI output"       'grep -rnE "JSON\.parse|\.match\(" src/lib/triage.ts src/app/api'
chk "createLogger count != 1"             '[ "$(grep -rn "createLogger(" src | wc -l)" -eq 1 ] || echo "count=$(grep -rn "createLogger(" src | wc -l)"'
chk "createAuth count != 1"               '[ "$(grep -rn "createAuth(" src | wc -l)" -eq 1 ] || echo "count=$(grep -rn "createAuth(" src | wc -l)"'
chk "createAIClient count != 1 (E3)"      'n=$(grep -rn "createAIClient(" src | grep -v "^src/app/(marketing)/" | wc -l); [ "$n" -eq 1 ] || echo "count=$n"'
chk "duplicate aiden-logging install (E4)" 'n=$(find node_modules -path "*@upstart13-com/aiden-logging/package.json" | wc -l); [ "$n" -le 1 ] || echo "installed copies=$n"'

# ── UI / design system ───────────────────────────────────────────────────────
chk "hardcoded color classes"             'grep -rnE "(bg|text|border|ring|fill|stroke)-(gray|zinc|slate|neutral|stone|red|blue|green|purple|violet|indigo|emerald|amber)-[0-9]{2,3}" src/app src/components'
chk "raw hex in TSX"                      'grep -rnE "#[0-9a-fA-F]{3,8}\b" src/app src/components --include=*.tsx'
chk "off-scale radius"                    'grep -rnE "rounded-(3xl|\[)" src/app src/components'
chk "non-Lucide icons"                    'grep -rnE "from \"(react-icons|@heroicons)" src'
chk "strokeWidth not 1.5"                 'grep -rn "strokeWidth" src | grep -v "1\.5"'
chk "ThemeProvider missing at root"       'grep -q "ThemeProvider" src/app/layout.tsx || echo missing'
chk "globals.css not imported"            'grep -qE "aiden-ui/styles/globals.css|@/lib/styles.css|styles.css" src/app/layout.tsx || echo missing'
chk "page without PageHeader (E2 excluded)" 'for f in $(find src/app -name page.tsx -not -path "*login*" -not -path "*register*" -not -path "*(marketing)*" -not -path "src/app/dashboard/settings/*"); do grep -q "PageHeader" "$f" || grep -qE "^\s*redirect\(" "$f" || echo "$f"; done'
chk "E2: redirect-only pages render nothing else" 'for f in $(find src/app -name page.tsx -not -path "*(marketing)*" -not -path "src/app/dashboard/settings/*"); do if ! grep -q PageHeader "$f" && grep -qE "^\s*redirect\(" "$f"; then grep -q "<" "$f" && echo "$f renders JSX without PageHeader"; fi; done'
chk "E2: settings layout renders PageHeader" 'grep -q "PageHeader" src/app/dashboard/settings/layout.tsx || echo "settings layout lost PageHeader"'

# ── Repo hygiene ─────────────────────────────────────────────────────────────
chk ".env committed"                      'git log --all --name-only --format= | grep -E "(^|/)\.env" | grep -v "\.example$" | sort -u'
chk "API key pattern in tracked files"    'git grep -nIE "sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{40,}|ghp_[A-Za-z0-9]{30,}" -- . ":!*.md"'
chk "schema.prisma hand-edited"           'git log --format=%s -- prisma/schema.prisma | grep -viE "merge|generate|init|scaffold"'
echo "== $fails failing checks"; [ "$fails" -eq 0 ]

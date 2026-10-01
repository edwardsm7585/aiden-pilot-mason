// Perimeter-order check for every API route handler (used by scripts/verify.sh;
// prints nothing when clean). Canonical order (plan §4, rubric auto-fail 3):
//   withAuth → parse → read → assertOwnership → assertCan → write + auditLog
// Rules, per exported handler:
//   1. input parsing (parseRequest / parseInput) comes before assertCan and
//      before any read of the resource;
//   2. a scoped single-row read (findFirst / findUnique) comes before
//      assertOwnership, which comes before assertCan;
//   3. no write (create / update / upsert / delete) before assertCan.
// Global-role abilities that need no row (e.g. users.manage) may be checked
// before the read: reading first would leak existence (404 vs 403).
// NextAuth and register are public routes (verify.sh E1) and are skipped.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PUBLIC = [/auth[\\/]\[\.\.\.nextauth\]/, /auth[\\/]register/];
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "route.ts") files.push(p);
  }
};
walk("src/app/api");

const first = (src, re) => {
  const m = src.match(re);
  return m ? m.index : -1;
};
const PARSE = /\b(parseRequest|parseInput)\(/;
const READ = /\bprisma\.\w+\.(findFirst|findUnique)\(/;
const OWN = /\bassertOwnership\(/;
const CAN = /\bassertCan\(/;
const WRITE =
  /\bprisma\.\w+\.(create|update|updateMany|upsert|delete|deleteMany)\(/;

const problems = [];
for (const file of files) {
  if (PUBLIC.some((re) => re.test(file))) continue;
  const src = readFileSync(file, "utf8");
  // Split into handlers at each exported HTTP method.
  const starts = [
    ...src.matchAll(/export const (GET|POST|PATCH|PUT|DELETE)\b/g),
  ];
  starts.forEach((m, i) => {
    const body = src.slice(m.index, starts[i + 1]?.index ?? src.length);
    const where = `${file} ${m[1]}`;
    const parse = first(body, PARSE);
    const read = first(body, READ);
    const own = first(body, OWN);
    const can = first(body, CAN);
    const write = first(body, WRITE);
    if (parse >= 0 && can >= 0 && parse > can)
      problems.push(`${where}: assertCan before input parsing`);
    if (parse >= 0 && read >= 0 && parse > read)
      problems.push(`${where}: data read before input parsing`);
    if (own >= 0 && read >= 0 && read > own)
      problems.push(`${where}: assertOwnership before the read`);
    if (own >= 0 && can >= 0 && own > can)
      problems.push(`${where}: assertCan before assertOwnership`);
    if (can >= 0 && write >= 0 && write < can)
      problems.push(`${where}: write before assertCan`);
    if (
      read >= 0 &&
      own < 0 &&
      can >= 0 &&
      read < can &&
      !/users\.manage|getMembership|session\.user\.id/.test(
        body.slice(read, read + 200)
      )
    )
      problems.push(`${where}: single-row read without assertOwnership`);
  });
}
for (const p of problems) console.log(p);

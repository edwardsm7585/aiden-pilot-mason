// Prints every Lucide icon rendered without strokeWidth={1.5} (DS 01: all
// product icons use 1.5). Used by scripts/verify.sh; prints nothing when clean.
// Covers icons imported from lucide-react and rendered directly or through a
// component alias (`icon: Inbox` ... `<Icon />`).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const files = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith(".tsx")) files.push(p);
  }
};
walk("src/app");
walk("src/components");

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const imp = src.match(/import\s*\{([^}]+)\}\s*from\s*"lucide-react"/);
  if (!imp) continue;
  const names = imp[1]
    .split(",")
    .map((n) => n.trim().split(/\s+as\s+/).pop())
    .filter(Boolean);
  // Icons may also be rendered through an alias such as `<Icon` / `<item.icon`.
  const tags = [...names, "Icon"];
  for (const name of tags) {
    const re = new RegExp(`<${name}\\b((?:[^>{}]|\\{[^}]*\\})*)/?>`, "g");
    for (const m of src.matchAll(re)) {
      if (!/strokeWidth=\{1\.5\}/.test(m[1])) {
        const line = src.slice(0, m.index).split("\n").length;
        console.log(`${file}:${line} <${name}> without strokeWidth={1.5}`);
      }
    }
  }
}

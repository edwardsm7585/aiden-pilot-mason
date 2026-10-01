import { z } from "zod";

// Zod 4 probes the Function constructor to decide whether it can
// JIT-compile parsers. The production CSP has no 'unsafe-eval' (security finding F5), so
// the probe fails safely but still fires a script-src `securitypolicyviolation`
// on every page. jitless skips the probe; parsing is unchanged.
z.config({ jitless: true });

/**
 * Selected state for choice controls built from `<Button variant="outline">`
 * (status filters, draft tone, role toggles). DS 06: "Active items use the
 * violet pill (`bg-sidebar-accent`), not inverted surfaces"; the same tokens
 * as the active sidebar item, so selection reads the same everywhere and
 * follows the theme. Applied with `cn()` on the primitive (DS: extend via
 * tokens, don't fork).
 */
export const selectedPill =
  "border-transparent bg-sidebar-accent text-sidebar-accent-foreground font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

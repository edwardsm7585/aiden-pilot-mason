import { RequestValidationError } from "@/lib/security";
import type { z } from "zod";

/**
 * Validate route params or query strings against a named Zod schema.
 *
 * `parseRequest` only reads JSON bodies, and `withAuth` maps only
 * `RequestValidationError` to 400 — a raw `ZodError` from `schema.parse()`
 * would surface as a 500. This throws the same error type, so params and
 * query get the same 400 shape as bodies (plan D5).
 *
 * @example
 *   const { id } = parseInput(TicketId, await params);
 *   const q = parseInput(ListTicketsQuery, Object.fromEntries(new URL(req.url).searchParams));
 */
export function parseInput<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown
): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new RequestValidationError(parsed.error);
  }
  return parsed.data;
}

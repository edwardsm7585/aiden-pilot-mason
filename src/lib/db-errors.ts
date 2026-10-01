/**
 * Postgres serialization failure (40001) from a Serializable transaction.
 * With the pg driver adapter it arrives in two shapes:
 * - during a query: PrismaClientKnownRequestError, code "P2034";
 * - at commit: a bare DriverAdapterError, message "TransactionWriteConflict"
 *   (cause.kind / cause.originalCode carry the same signal).
 */
export function isSerializationConflict(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    code?: unknown;
    message?: unknown;
    cause?: { kind?: unknown; originalCode?: unknown };
  };
  return (
    e.code === "P2034" ||
    e.cause?.kind === "TransactionWriteConflict" ||
    e.cause?.originalCode === "40001" ||
    (typeof e.message === "string" &&
      /TransactionWriteConflict|could not serialize/i.test(e.message))
  );
}

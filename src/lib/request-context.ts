import { withRequestContext } from "@upstart13-com/aiden-logging";

/**
 * Open the request context `withAuth` opens (same `x-request-id`-or-UUID
 * rule), for the public routes that can't use `withAuth`: NextAuth's own
 * handler and registration. Without it, `auth.signin` / `auth.register`
 * audit rows and their log lines have no `requestId` to join on.
 * There is no session yet, so no `userId`; audit rows name the user via
 * `actorId`.
 */
export function withPublicRequestContext<Rest extends unknown[]>(
  handler: (req: Request, ...rest: Rest) => Promise<Response> | Response
) {
  return (req: Request, ...rest: Rest): Promise<Response> =>
    withRequestContext(
      { requestId: req.headers.get("x-request-id") ?? crypto.randomUUID() },
      async () => handler(req, ...rest)
    );
}

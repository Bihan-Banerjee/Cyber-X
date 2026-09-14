/**
 * safeError.ts — client-safe error messages for scanner routes.
 *
 * The scanner handlers catch their own errors and return them to the client.
 * Returning `error.message` verbatim leaks internals on an exposed instance:
 * absolute file paths, spawned-command output, upstream API errors, stack
 * fragments, and library internals — a free recon signal for an attacker and a
 * source of confusing noise for a normal user.
 *
 * `clientErrorMessage` returns the real message ONLY in development (where it
 * aids debugging); in production it returns a generic string. Handlers still
 * log the full error server-side (console.error / logToolActivity), so nothing
 * is lost operationally — it just stops crossing the network boundary.
 *
 * Production is anything with NODE_ENV === 'production'. Set that on any
 * publicly reachable deployment.
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export function isProduction(): boolean {
  return IS_PRODUCTION;
}

/**
 * A message safe to send to the client for a caught error.
 * @param error    the caught value (unknown — TS catch is `unknown`/`any`)
 * @param fallback generic text used in production (defaults to a neutral line)
 */
export function clientErrorMessage(
  error: unknown,
  fallback = 'An internal error occurred while processing the request.',
): string {
  if (IS_PRODUCTION) return fallback;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

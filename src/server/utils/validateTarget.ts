/**
 * validateTarget.ts — hostname/IP validation for scanner targets.
 *
 * A scan target must be a bare hostname or IPv4 literal. Rejecting anything
 * with shell metacharacters, spaces, or schemes is a defence-in-depth layer:
 * even though the scanners use execFile (no shell), a target that can't contain
 * `;`, `|`, `$`, backticks, `&`, or whitespace can never become an injection
 * payload if a future code path ever does interpolate it.
 */
export function isValidTarget(target: string): boolean {
  const hostnameRegex = /^[a-zA-Z0-9.-]+$/;
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  return hostnameRegex.test(target) || ipRegex.test(target);
}

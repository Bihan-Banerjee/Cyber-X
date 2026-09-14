/**
 * security.test.ts — automated "are the doors locked?" checks.
 *
 * Turns the manual hardening verification into a test the CI runs on every push:
 *   • SSRF guard blocks loopback / private / link-local / cloud-metadata targets
 *   • traceroute passes the target as a single argv element (no shell → no
 *     command injection)
 *   • scanner target validation rejects shell metacharacters
 *   • client error messages don't leak internals in production
 *
 * No server, no network — pure unit tests over the guard functions. Run with:
 *   npx tsx --test src/server/security.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkUrl, assertUrlAllowed } from './utils/ssrfGuard.js';
import { clientErrorMessage, isProduction } from './utils/safeError.js';
import { isValidTarget } from './utils/validateTarget.js';
import { tracerouteCommand } from './scanners/traceroute.js';

test('SSRF guard blocks loopback / private / link-local / metadata', () => {
  const blocked = [
    'http://169.254.169.254/latest/meta-data/',   // AWS/GCP metadata
    'http://127.0.0.1/admin',
    'http://localhost:8080/',
    'http://10.0.0.5/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'http://[::1]/',
    'https://[fe80::1]/',
    'ftp://example.com/',                          // non-http scheme
    'file:///etc/passwd',
    'not a url',
  ];
  for (const url of blocked) {
    assert.equal(checkUrl(url).allowed, false, `should block ${url}`);
  }
});

test('SSRF guard allows ordinary public URLs', () => {
  for (const url of ['http://example.com/', 'https://api.example.com/v1/x']) {
    assert.equal(checkUrl(url).allowed, true, `should allow ${url}`);
  }
});

test('assertUrlAllowed throws on the cloud-metadata address', () => {
  assert.throws(() => assertUrlAllowed('http://169.254.169.254/'));
  assert.doesNotThrow(() => assertUrlAllowed('https://example.com/'));
});

test('traceroute passes the target as a single argv element (no shell)', () => {
  const evil = '8.8.8.8; rm -rf / #';
  for (const isWindows of [true, false]) {
    const { bin, args } = tracerouteCommand(evil, 30, isWindows);
    assert.ok(bin === 'tracert' || bin === 'traceroute', 'bin is a fixed binary');
    // The whole malicious string must survive as ONE argv element — never split
    // or interpolated — so execFile (no shell) can't be tricked into running it.
    assert.ok(args.includes(evil), 'target is one argv element');
    assert.equal(args[args.length - 1], evil, 'target is the final argv element');
  }
});

test('traceroute clamps the hop count to a sane bounded integer', () => {
  assert.equal(tracerouteCommand('x', 9999, false).args[1], '64');   // capped
  assert.equal(tracerouteCommand('x', -5, false).args[1], '1');      // floored
  assert.equal(tracerouteCommand('x', NaN, false).args[1], '30');    // default
});

test('isValidTarget rejects shell metacharacters and whitespace', () => {
  for (const ok of ['example.com', '192.168.1.1', 'sub.domain-name.co', 'a-b.example']) {
    assert.equal(isValidTarget(ok), true, `should accept ${ok}`);
  }
  for (const bad of [
    'example.com; rm -rf /', '$(whoami)', 'a|b', 'a b', 'a&b', 'a`b`',
    'http://x', 'a>b', 'a<b', '', 'a\nb',
  ]) {
    assert.equal(isValidTarget(bad), false, `should reject ${JSON.stringify(bad)}`);
  }
});

test('client error messages never leak internals in production', () => {
  const secret = 'ENOENT /home/user/secret/config.json spawn traceroute';
  const msg = clientErrorMessage(new Error(secret), 'generic failure');
  if (isProduction()) {
    assert.equal(msg, 'generic failure');
    assert.ok(!msg.includes('secret'), 'no internal path in production');
  } else {
    assert.equal(msg, secret, 'real message surfaced in development');
  }
  // Non-Error inputs fall back to the generic string, never [object Object].
  assert.equal(clientErrorMessage({ weird: true }, 'fallback'), 'fallback');
});

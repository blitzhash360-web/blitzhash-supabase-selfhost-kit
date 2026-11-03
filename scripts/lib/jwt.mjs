#!/usr/bin/env node
/**
 * HS256 JWT helpers for self-hosted Supabase legacy keys.
 * Used by gen-secrets and tests. Matches the shape of upstream generate-keys.sh.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

export function signHs256(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const data = `${h}.${p}`;
  const sig = createHmac('sha256', secret).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

export function verifyHs256(token, secret) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return { ok: false, error: 'malformed token' };
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = b64url(createHmac('sha256', secret).update(data).digest());
  const a = Buffer.from(expected);
  const b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: 'bad signature' };
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return { ok: false, error: 'bad payload' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) {
    return { ok: false, error: 'expired', payload };
  }
  return { ok: true, payload };
}

export function genJwtSecret(bytes = 30) {
  return randomBytes(bytes).toString('base64');
}

export function genHex(bytes) {
  return randomBytes(bytes).toString('hex');
}

export function genBase64(bytes) {
  return randomBytes(bytes).toString('base64');
}

export function makeLegacyKeys(secret, iat = Math.floor(Date.now() / 1000)) {
  const exp = iat + 5 * 3600 * 24 * 365; // 5 years
  const anon = signHs256({ role: 'anon', iss: 'supabase', iat, exp }, secret);
  const service = signHs256({ role: 'service_role', iss: 'supabase', iat, exp }, secret);
  return { anon, service, iat, exp };
}

function usage() {
  console.log(`Usage:
  node scripts/lib/jwt.mjs gen
  node scripts/lib/jwt.mjs verify <token> <secret>
  node scripts/lib/jwt.mjs sign-anon <secret>
  node scripts/lib/jwt.mjs sign-service <secret>`);
}

const [,, cmd, ...args] = process.argv;
if (cmd === 'gen') {
  const secret = genJwtSecret();
  const keys = makeLegacyKeys(secret);
  console.log(JSON.stringify({ JWT_SECRET: secret, ANON_KEY: keys.anon, SERVICE_ROLE_KEY: keys.service }, null, 2));
} else if (cmd === 'verify') {
  const [token, secret] = args;
  if (!token || !secret) { usage(); process.exit(2); }
  const r = verifyHs256(token, secret);
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
} else if (cmd === 'sign-anon' || cmd === 'sign-service') {
  const [secret] = args;
  if (!secret) { usage(); process.exit(2); }
  const role = cmd === 'sign-anon' ? 'anon' : 'service_role';
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 5 * 3600 * 24 * 365;
  console.log(signHs256({ role, iss: 'supabase', iat, exp }, secret));
} else if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('jwt.mjs')) {
  if (!cmd) usage();
}

import fs from 'node:fs/promises';
import path from 'node:path';

/** Parse KEY=VALUE env file. Values never logged by callers. */
export function parseEnv(text) {
  const map = new Map();
  for (const raw of String(text).split(/\n/)) {
    const line = raw.replace(/\r$/, '');
    if (!line || line.trimStart().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) map.set(key, val);
  }
  return map;
}

export function serializeEnv(map) {
  const lines = ['# Edge Function secrets — managed by BlitzHash Functions Admin', '# Never commit this file.'];
  for (const [k, v] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue;
    const needsQuote = /[\s#"']/.test(v);
    lines.push(needsQuote ? `${k}="${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : `${k}=${v}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function maskValue(v) {
  const s = String(v ?? '');
  if (s.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(12, s.length - 4))}${s.slice(-4)}`;
}

export async function listSecrets(filePath) {
  let text = '';
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const map = parseEnv(text);
  return [...map.entries()].map(([key, value]) => ({
    key,
    masked: maskValue(value),
    length: value.length,
  }));
}

export async function upsertSecret(filePath, key, value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    const err = new Error('Invalid secret key');
    err.status = 400;
    throw err;
  }
  if (typeof value !== 'string' || value.length === 0) {
    const err = new Error('Secret value required');
    err.status = 400;
    throw err;
  }
  let text = '';
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const map = parseEnv(text);
  map.set(key, value);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, serializeEnv(map), { mode: 0o600 });
  return { key, masked: maskValue(value), length: value.length };
}

export async function deleteSecret(filePath, key) {
  let text = '';
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('Secret not found');
      err.status = 404;
      throw err;
    }
    throw e;
  }
  const map = parseEnv(text);
  if (!map.has(key)) {
    const err = new Error('Secret not found');
    err.status = 404;
    throw err;
  }
  map.delete(key);
  await fs.writeFile(filePath, serializeEnv(map), { mode: 0o600 });
  return { deleted: key };
}

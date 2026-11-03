import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { listSecrets, upsertSecret, deleteSecret, maskValue, parseEnv } from '../lib/secrets.mjs';

let file;
before(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bh-sec-'));
  file = path.join(dir, '.env.functions');
});
after(async () => {
  await fs.rm(path.dirname(file), { recursive: true, force: true });
});

describe('secrets', () => {
  it('masks values', () => {
    assert.equal(maskValue('ab'), '••••');
    assert.match(maskValue('supersecretvalue'), /alue$/);
  });

  it('upserts and lists masked', async () => {
    await upsertSecret(file, 'API_TOKEN', 'abcdefghijklmnopqrstuvwxyz');
    const list = await listSecrets(file);
    assert.equal(list.length, 1);
    assert.equal(list[0].key, 'API_TOKEN');
    assert.doesNotMatch(list[0].masked, /abcdef/);
    const raw = await fs.readFile(file, 'utf8');
    assert.match(raw, /API_TOKEN=abcdefghijklmnopqrstuvwxyz/);
    // parse roundtrip
    assert.equal(parseEnv(raw).get('API_TOKEN'), 'abcdefghijklmnopqrstuvwxyz');
    await deleteSecret(file, 'API_TOKEN');
    assert.equal((await listSecrets(file)).length, 0);
  });
});

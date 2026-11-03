import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  listFunctions,
  createFunction,
  readFunction,
  writeFunction,
  deleteFunction,
} from '../lib/functions-fs.mjs';

let root;
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'bh-fn-'));
  await fs.mkdir(path.join(root, 'main'));
  await fs.writeFile(path.join(root, 'main', 'index.ts'), '// runtime\n');
});
after(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('functions-fs', () => {
  it('lists directories', async () => {
    const list = await listFunctions(root);
    assert.equal(list.find((f) => f.name === 'main')?.reserved, true);
  });

  it('creates, reads, updates, deletes', async () => {
    const created = await createFunction(root, 'greet');
    assert.match(created.code, /greet/);
    const read = await readFunction(root, 'greet');
    assert.equal(read.name, 'greet');
    await writeFunction(root, 'greet', 'export default 1\n');
    assert.equal((await readFunction(root, 'greet')).code, 'export default 1\n');
    await deleteFunction(root, 'greet');
    await assert.rejects(() => readFunction(root, 'greet'), /not found/);
  });

  it('rejects reserved and bad names', async () => {
    await assert.rejects(() => createFunction(root, 'main'), /reserved/);
    await assert.rejects(() => createFunction(root, 'Bad Name'), /Invalid/);
  });
});

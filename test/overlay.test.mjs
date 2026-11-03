import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('kit overlay', () => {
  it('includes functions-admin, glances, dozzle and localhost binds', () => {
    const yml = fs.readFileSync(path.join(root, 'overlays/docker-compose.kit.yml'), 'utf8');
    assert.match(yml, /functions-admin:/);
    assert.match(yml, /glances:/);
    assert.match(yml, /dozzle:/);
    assert.match(yml, /127\.0\.0\.1/);
    assert.match(yml, /docker\.sock/);
  });

  it('functions-admin never logs secret values (source scan)', () => {
    const src = fs.readFileSync(path.join(root, 'services/functions-admin/server.mjs'), 'utf8');
    assert.match(src, /Never log secret/);
    assert.doesNotMatch(src, /console\.log\([^)]*body\.value/);
  });
});

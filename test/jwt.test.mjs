import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { genJwtSecret, makeLegacyKeys, verifyHs256 } from '../scripts/lib/jwt.mjs';

describe('jwt helpers', () => {
  it('signs anon and service_role verifiably', () => {
    const secret = genJwtSecret();
    const { anon, service } = makeLegacyKeys(secret);
    const a = verifyHs256(anon, secret);
    const s = verifyHs256(service, secret);
    assert.equal(a.ok, true);
    assert.equal(a.payload.role, 'anon');
    assert.equal(s.ok, true);
    assert.equal(s.payload.role, 'service_role');
    assert.equal(verifyHs256(anon, 'wrong-secret').ok, false);
  });
});

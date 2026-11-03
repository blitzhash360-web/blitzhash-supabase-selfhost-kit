import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { basicAuth } from '../lib/auth.mjs';

function mockRes() {
  return {
    status: 0,
    headers: null,
    body: '',
    writeHead(s, h) { this.status = s; this.headers = h; },
    end(b) { this.body = b || ''; },
  };
}

describe('basicAuth', () => {
  it('accepts matching credentials', () => {
    const token = Buffer.from('supabase:s3cret').toString('base64');
    const req = { headers: { authorization: `Basic ${token}` } };
    const res = mockRes();
    assert.equal(basicAuth(req, res, { user: 'supabase', pass: 's3cret' }), true);
  });

  it('rejects bad credentials', () => {
    const token = Buffer.from('supabase:wrong').toString('base64');
    const req = { headers: { authorization: `Basic ${token}` } };
    const res = mockRes();
    assert.equal(basicAuth(req, res, { user: 'supabase', pass: 's3cret' }), false);
    assert.equal(res.status, 401);
  });
});

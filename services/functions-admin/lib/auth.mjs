import { timingSafeEqual } from 'node:crypto';

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** HTTP Basic Auth using dashboard credentials (or FUNCTIONS_ADMIN_* overrides). */
export function basicAuth(req, res, { user, pass }) {
  const hdr = req.headers.authorization || '';
  if (!hdr.startsWith('Basic ')) {
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="BlitzHash Functions Admin"',
      'Content-Type': 'text/plain',
    });
    res.end('Authentication required');
    return false;
  }
  let decoded;
  try {
    decoded = Buffer.from(hdr.slice(6), 'base64').toString('utf8');
  } catch {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="BlitzHash Functions Admin"' });
    res.end('Invalid auth');
    return false;
  }
  const i = decoded.indexOf(':');
  const u = i >= 0 ? decoded.slice(0, i) : decoded;
  const p = i >= 0 ? decoded.slice(i + 1) : '';
  if (!safeEqual(u, user) || !safeEqual(p, pass)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="BlitzHash Functions Admin"' });
    res.end('Invalid credentials');
    return false;
  }
  return true;
}

import http from 'node:http';

/**
 * Minimal Docker Engine API client over a unix socket.
 * Used only to restart/recreate the edge-runtime container after deploy.
 */
export function dockerRequest(socketPath, method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body != null ? JSON.stringify(body) : null;
    const req = http.request(
      {
        socketPath,
        path: apiPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = raw;
          }
          resolve({ status: res.statusCode || 0, body: json, raw });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export async function restartContainer(socketPath, nameOrId) {
  const encoded = encodeURIComponent(nameOrId);
  const res = await dockerRequest(socketPath, 'POST', `/containers/${encoded}/restart?t=10`);
  if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status };
  const msg = typeof res.body === 'object' && res.body?.message ? res.body.message : res.raw;
  const err = new Error(`Docker restart failed (${res.status}): ${msg}`);
  err.status = 502;
  throw err;
}

export async function pingDocker(socketPath) {
  try {
    const res = await dockerRequest(socketPath, 'GET', '/_ping');
    return res.status === 200;
  } catch {
    return false;
  }
}

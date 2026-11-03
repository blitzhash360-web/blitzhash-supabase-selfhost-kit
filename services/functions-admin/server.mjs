#!/usr/bin/env node
/**
 * BlitzHash Edge Functions Admin — companion UI for self-hosted Supabase.
 * Not affiliated with Supabase. Studio cannot create/edit/deploy Edge Functions
 * on self-hosted; this service fills that gap.
 *
 * Security:
 * - HTTP Basic Auth (DASHBOARD_* or FUNCTIONS_ADMIN_* credentials)
 * - Function secrets values are masked in API responses and never logged
 * - Docker socket used only to restart the edge-runtime container on Deploy
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { basicAuth } from './lib/auth.mjs';
import {
  listFunctions,
  readFunction,
  createFunction,
  writeFunction,
  deleteFunction,
} from './lib/functions-fs.mjs';
import { listSecrets, upsertSecret, deleteSecret } from './lib/secrets.mjs';
import { restartContainer, pingDocker } from './lib/docker.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.FUNCTIONS_ADMIN_PORT || 9100);
const HOST = process.env.FUNCTIONS_ADMIN_HOST || '0.0.0.0';
const FUNCTIONS_DIR = process.env.FUNCTIONS_DIR || '/home/deno/functions';
const SECRETS_FILE =
  process.env.FUNCTIONS_SECRETS_FILE || '/home/deno/functions/.env.functions';
const DOCKER_SOCK = process.env.DOCKER_SOCK || '/var/run/docker.sock';
const EDGE_CONTAINER =
  process.env.EDGE_FUNCTIONS_CONTAINER || 'supabase-edge-functions';
function pick(...vals) {
  for (const v of vals) {
    if (v != null && String(v).length > 0) return String(v);
  }
  return '';
}
const USER = pick(process.env.FUNCTIONS_ADMIN_USERNAME, process.env.DASHBOARD_USERNAME) || 'supabase';
const PASS = pick(process.env.FUNCTIONS_ADMIN_PASSWORD, process.env.DASHBOARD_PASSWORD);

const PUBLIC = path.join(__dirname, 'public');

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function log(line) {
  // Never log secret values
  console.log(`[functions-admin] ${line}`);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error('Invalid JSON body');
    err.status = 400;
    throw err;
  }
}

async function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  rel = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const data = await fs.readFile(file);
    const ext = path.extname(file);
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/health') {
    const docker = await pingDocker(DOCKER_SOCK);
    return json(res, 200, {
      ok: true,
      functionsDir: FUNCTIONS_DIR,
      docker,
      edgeContainer: EDGE_CONTAINER,
    });
  }

  if (pathname === '/api/functions' && req.method === 'GET') {
    return json(res, 200, { functions: await listFunctions(FUNCTIONS_DIR) });
  }

  if (pathname === '/api/functions' && req.method === 'POST') {
    const body = await readBody(req);
    const created = await createFunction(FUNCTIONS_DIR, body?.name, body?.code);
    log(`created function ${created.name}`);
    return json(res, 201, created);
  }

  const fnMatch = pathname.match(/^\/api\/functions\/([^/]+)$/);
  if (fnMatch) {
    const name = decodeURIComponent(fnMatch[1]);
    if (req.method === 'GET') return json(res, 200, await readFunction(FUNCTIONS_DIR, name));
    if (req.method === 'PUT') {
      const body = await readBody(req);
      const updated = await writeFunction(FUNCTIONS_DIR, name, body?.code ?? '');
      log(`updated function ${name}`);
      return json(res, 200, updated);
    }
    if (req.method === 'DELETE') {
      const deleted = await deleteFunction(FUNCTIONS_DIR, name);
      log(`deleted function ${name}`);
      return json(res, 200, deleted);
    }
  }

  if (pathname === '/api/deploy' && req.method === 'POST') {
    await restartContainer(DOCKER_SOCK, EDGE_CONTAINER);
    log(`restarted ${EDGE_CONTAINER}`);
    return json(res, 200, {
      ok: true,
      message: `Restarted ${EDGE_CONTAINER}. New/changed functions are picked up after restart.`,
    });
  }

  if (pathname === '/api/secrets' && req.method === 'GET') {
    return json(res, 200, { secrets: await listSecrets(SECRETS_FILE) });
  }

  if (pathname === '/api/secrets' && req.method === 'POST') {
    const body = await readBody(req);
    const row = await upsertSecret(SECRETS_FILE, body?.key, body?.value);
    log(`upserted secret key=${row.key}`);
    return json(res, 200, row);
  }

  const secMatch = pathname.match(/^\/api\/secrets\/([^/]+)$/);
  if (secMatch && req.method === 'DELETE') {
    const key = decodeURIComponent(secMatch[1]);
    const deleted = await deleteSecret(SECRETS_FILE, key);
    log(`deleted secret key=${key}`);
    return json(res, 200, deleted);
  }

  json(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    if (!PASS) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('FUNCTIONS_ADMIN_PASSWORD / DASHBOARD_PASSWORD is not set');
      return;
    }
    if (!basicAuth(req, res, { user: USER, pass: PASS })) return;

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url.pathname);
      return;
    }
    await serveStatic(req, res, url.pathname);
  } catch (e) {
    const status = e.status || 500;
    // Never include secret values in error output
    log(`error ${status}: ${e.message}`);
    json(res, status, { error: e.message || 'Internal error' });
  }
});

server.listen(PORT, HOST, () => {
  log(`listening on http://${HOST}:${PORT}`);
  log(`functions dir: ${FUNCTIONS_DIR}`);
});

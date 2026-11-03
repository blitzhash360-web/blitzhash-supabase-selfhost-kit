import fs from 'node:fs/promises';
import path from 'node:path';

const RESERVED = new Set(['main']);
const NAME_RE = /^[a-z][a-z0-9_-]{0,63}$/;

export function assertName(name) {
  if (!NAME_RE.test(name)) {
    const err = new Error('Invalid function name. Use lowercase letters, digits, _ or -, starting with a letter.');
    err.status = 400;
    throw err;
  }
  if (RESERVED.has(name)) {
    const err = new Error(`'${name}' is reserved by the edge runtime.`);
    err.status = 400;
    throw err;
  }
}

export async function listFunctions(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('.')) continue;
    const indexPath = path.join(root, e.name, 'index.ts');
    let hasIndex = false;
    let size = 0;
    let mtime = null;
    try {
      const st = await fs.stat(indexPath);
      hasIndex = st.isFile();
      size = st.size;
      mtime = st.mtime.toISOString();
    } catch {
      /* no index */
    }
    out.push({ name: e.name, reserved: RESERVED.has(e.name), hasIndex, size, mtime });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function readFunction(root, name) {
  assertName(name);
  const indexPath = path.join(root, name, 'index.ts');
  try {
    const code = await fs.readFile(indexPath, 'utf8');
    const st = await fs.stat(indexPath);
    return { name, code, mtime: st.mtime.toISOString(), size: st.size };
  } catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error(`Function '${name}' not found`);
      err.status = 404;
      throw err;
    }
    throw e;
  }
}

const TEMPLATE = `import "@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req) => {
  return Response.json({ message: "Hello from {{NAME}}!" })
})
`;

export async function createFunction(root, name, code) {
  assertName(name);
  const dir = path.join(root, name);
  try {
    await fs.mkdir(dir, { recursive: false });
  } catch (e) {
    if (e.code === 'EEXIST') {
      const err = new Error(`Function '${name}' already exists`);
      err.status = 409;
      throw err;
    }
    throw e;
  }
  const body = code && String(code).trim() ? String(code) : TEMPLATE.replaceAll('{{NAME}}', name);
  await fs.writeFile(path.join(dir, 'index.ts'), body, { encoding: 'utf8', flag: 'wx' });
  return readFunction(root, name);
}

export async function writeFunction(root, name, code) {
  assertName(name);
  if (typeof code !== 'string') {
    const err = new Error('code must be a string');
    err.status = 400;
    throw err;
  }
  const dir = path.join(root, name);
  const indexPath = path.join(dir, 'index.ts');
  try {
    await fs.access(dir);
  } catch {
    const err = new Error(`Function '${name}' not found`);
    err.status = 404;
    throw err;
  }
  await fs.writeFile(indexPath, code, 'utf8');
  return readFunction(root, name);
}

export async function deleteFunction(root, name) {
  assertName(name);
  const dir = path.join(root, name);
  try {
    await fs.rm(dir, { recursive: true, force: false });
  } catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error(`Function '${name}' not found`);
      err.status = 404;
      throw err;
    }
    throw e;
  }
  return { deleted: name };
}

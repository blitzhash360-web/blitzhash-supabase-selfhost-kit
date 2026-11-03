/* global CodeMirror */
const el = (id) => document.getElementById(id);
const status = (msg, kind = '') => {
  const s = el('status');
  s.textContent = msg || '';
  s.className = `status ${kind}`;
};

const editor = CodeMirror.fromTextArea(el('code'), {
  mode: 'javascript',
  theme: 'material-darker',
  lineNumbers: true,
  tabSize: 2,
  indentWithTabs: false,
});

let current = null;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function refreshList() {
  const { functions } = await api('/api/functions');
  const ul = el('fn-list');
  ul.innerHTML = '';
  for (const f of functions) {
    const li = document.createElement('li');
    li.dataset.name = f.name;
    if (f.name === current) li.classList.add('active');
    li.innerHTML = `<span>${f.name}${f.reserved ? ' <em class="meta">(runtime)</em>' : ''}</span><span class="meta">${f.hasIndex ? f.size + ' B' : 'no index'}</span>`;
    li.onclick = () => openFn(f.name, f.reserved);
    ul.appendChild(li);
  }
}

async function refreshSecrets() {
  const { secrets } = await api('/api/secrets');
  const ul = el('secret-list');
  ul.innerHTML = '';
  for (const s of secrets) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${s.key}</span><span class="meta">${s.masked}</span>`;
    li.title = 'Click to delete';
    li.onclick = async () => {
      if (!confirm(`Delete secret ${s.key}?`)) return;
      await api(`/api/secrets/${encodeURIComponent(s.key)}`, { method: 'DELETE' });
      status(`Deleted secret ${s.key}`, 'ok');
      refreshSecrets();
    };
    ul.appendChild(li);
  }
}

async function openFn(name, reserved) {
  current = name;
  [...document.querySelectorAll('#fn-list li')].forEach((li) => {
    li.classList.toggle('active', li.dataset.name === name);
  });
  el('editor-title').textContent = name;
  el('btn-save').disabled = !!reserved;
  el('btn-delete').disabled = !!reserved;
  if (reserved) {
    editor.setValue('// Reserved runtime entrypoint (main). Not editable here.\n');
    editor.setOption('readOnly', true);
    return;
  }
  editor.setOption('readOnly', false);
  const data = await api(`/api/functions/${encodeURIComponent(name)}`);
  editor.setValue(data.code || '');
  status(`Loaded ${name}`, 'ok');
}

el('btn-new').onclick = async () => {
  const name = prompt('New function name (lowercase, a-z0-9_-):');
  if (!name) return;
  try {
    await api('/api/functions', { method: 'POST', body: JSON.stringify({ name }) });
    await refreshList();
    await openFn(name, false);
    status(`Created ${name}. Click Deploy when ready.`, 'ok');
  } catch (e) {
    status(e.message, 'err');
  }
};

el('btn-save').onclick = async () => {
  if (!current) return;
  try {
    await api(`/api/functions/${encodeURIComponent(current)}`, {
      method: 'PUT',
      body: JSON.stringify({ code: editor.getValue() }),
    });
    status(`Saved ${current}. Click Deploy / reload runtime to pick up changes.`, 'ok');
    refreshList();
  } catch (e) {
    status(e.message, 'err');
  }
};

el('btn-delete').onclick = async () => {
  if (!current) return;
  if (!confirm(`Delete function ${current}?`)) return;
  try {
    await api(`/api/functions/${encodeURIComponent(current)}`, { method: 'DELETE' });
    current = null;
    editor.setValue('');
    el('editor-title').textContent = 'Select a function';
    el('btn-save').disabled = true;
    el('btn-delete').disabled = true;
    status('Deleted. Deploy to reload runtime.', 'ok');
    refreshList();
  } catch (e) {
    status(e.message, 'err');
  }
};

el('btn-deploy').onclick = async () => {
  try {
    status('Restarting edge-runtime…');
    const r = await api('/api/deploy', { method: 'POST', body: '{}' });
    status(r.message || 'Deployed', 'ok');
  } catch (e) {
    status(e.message, 'err');
  }
};

el('btn-secret').onclick = async () => {
  const key = prompt('Secret key (ENV name):');
  if (!key) return;
  const value = prompt('Secret value (will be masked in UI, never logged):');
  if (value == null || value === '') return;
  try {
    await api('/api/secrets', { method: 'POST', body: JSON.stringify({ key, value }) });
    status(`Saved secret ${key}. Restart edge-runtime (Deploy) so functions see new env.`, 'ok');
    refreshSecrets();
  } catch (e) {
    status(e.message, 'err');
  }
};

(async () => {
  try {
    await refreshList();
    await refreshSecrets();
    const health = await api('/api/health');
    if (!health.docker) status('Warning: Docker socket not reachable — Deploy will fail.', 'err');
  } catch (e) {
    status(e.message, 'err');
  }
})();

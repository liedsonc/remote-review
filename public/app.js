const params = new URLSearchParams(location.search);
const TOKEN = params.get('t') || '';

const state = {
  label: '',
  files: [],
  comments: new Map(),
  submitted: false,
};

const app = document.getElementById('app');

async function apiFetch(path, opts = {}) {
  const url = new URL(path, location.origin);
  if (!opts.headers) opts.headers = {};
  opts.headers['X-Review-Token'] = TOKEN;
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

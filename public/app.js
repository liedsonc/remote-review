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

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function commentKey(filePath, line, side) {
  return `${filePath}::${side}::${line}`;
}

function countFileComments(filePath) {
  let n = 0;
  for (const c of state.comments.values()) if (c.filePath === filePath && !c.editing) n++;
  return n;
}

function totalComments() {
  let n = 0;
  for (const c of state.comments.values()) if (!c.editing) n++;
  return n;
}

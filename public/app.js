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

function render() {
  app.innerHTML = '';

  if (state.submitted) {
    app.appendChild(renderSubmittedScreen());
    return;
  }

  const totalAdd = state.files.reduce((sum, f) => sum + f.hunks.reduce((s, h) => s + h.lines.filter(l => l.type === 'add').length, 0), 0);
  const totalDel = state.files.reduce((sum, f) => sum + f.hunks.reduce((s, h) => s + h.lines.filter(l => l.type === 'del').length, 0), 0);

  const header = el('div', { class: 'header' }, [
    el('span', { class: 'prompt-glyph' }, '›_'),
    el('span', { class: 'title' }, 'remote-review'),
    el('span', { class: 'label' }, state.label),
    el('span', { class: 'stats' }, [
      el('span', { class: 'add' }, `+${totalAdd}`),
      el('span', { class: 'del' }, `-${totalDel}`),
    ]),
  ]);
  app.appendChild(header);

  const container = el('div', { class: 'container' });

  if (state.files.length === 0) {
    container.appendChild(el('div', { class: 'empty-state' }, [
      el('div', { class: 'glyph' }, '∅'),
      el('div', {}, 'No changes to review.'),
    ]));
  } else {
    for (const file of state.files) {
      container.appendChild(renderFileBlock(file));
    }
  }

  app.appendChild(container);
  app.appendChild(renderSubmitBar());
}

function renderFileBlock(file) {
  const block = el('div', { class: 'file-block open' });
  const nComments = countFileComments(file.path);

  const header = el('div', { class: 'file-header', onclick: () => {
    block.classList.toggle('open');
  } }, [
    el('span', { class: 'chev' }, '▸'),
    el('span', { class: 'path' }, file.status === 'renamed' ? `${file.oldPath} → ${file.path}` : file.path),
    nComments > 0 ? el('span', { class: 'comment-count' }, `${nComments} 💬`) : null,
    el('span', { class: `status-tag ${file.status}` }, file.status),
  ]);
  block.appendChild(header);

  const body = el('div', { class: 'file-body' });

  if (file.isBinary) {
    body.appendChild(el('div', { class: 'binary-note' }, 'Binary file not shown.'));
  } else {
    for (const hunk of file.hunks) {
      body.appendChild(el('div', { class: 'hunk-header' }, hunk.header));
      body.appendChild(renderHunkTable(file.path, hunk));
    }
  }

  block.appendChild(body);
  return block;
}

function renderHunkTable(filePath, hunk) {
  const table = el('table', { class: 'diff-table' });
  const tbody = el('tbody');

  for (const line of hunk.lines) {
    const side = line.type === 'del' ? 'old' : 'new';
    const displayLine = line.type === 'del' ? line.oldLine : line.newLine;
    const key = commentKey(filePath, displayLine, side);
    const marker = line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' ';

    const tr = el('tr', { class: `diff-line ${line.type}` }, [
      el('td', { class: 'ln' }, line.oldLine ? String(line.oldLine) : ''),
      el('td', { class: 'ln' }, line.newLine ? String(line.newLine) : ''),
      el('td', { class: 'marker' }, marker),
      el('td', { class: 'content' }, line.content || ' '),
      el('td', { class: 'gutter-action' }, [
        el('button', {
          class: 'add-comment-btn',
          title: 'Add comment',
          onclick: () => startComment(filePath, displayLine, side, table, tr),
        }, '+'),
      ]),
    ]);
    tbody.appendChild(tr);

    const existing = state.comments.get(key);
    if (existing) {
      tbody.appendChild(renderCommentRow(filePath, displayLine, side, table));
    }
  }

  table.appendChild(tbody);
  return table;
}

function startComment(filePath, line, side, table, afterRow) {
  const key = commentKey(filePath, line, side);
  if (state.comments.has(key)) return;
  state.comments.set(key, { filePath, line, side, body: '', editing: true });
  render();
}

function renderCommentRow(filePath, line, side) {
  const key = commentKey(filePath, line, side);
  const comment = state.comments.get(key);

  const tr = el('tr', { class: 'comment-row' });
  const td = el('td', { colspan: '5' });

  if (comment.editing) {
    const textarea = el('textarea', {
      placeholder: 'Leave a note for Claude…',
      autofocus: 'true',
    });
    textarea.value = comment.body;

    const note = el('div', { class: 'comment-note' }, [
      el('div', { class: 'tag' }, `${filePath}:L${line}`),
      textarea,
      el('div', { class: 'note-actions' }, [
        el('button', { class: 'btn-ghost', onclick: () => {
          state.comments.delete(key);
          render();
        } }, 'Cancel'),
        el('button', { class: 'btn-amber', onclick: () => {
          const val = textarea.value.trim();
          if (!val) {
            state.comments.delete(key);
          } else {
            comment.body = val;
            comment.editing = false;
          }
          render();
        } }, 'Save'),
      ]),
    ]);
    td.appendChild(note);
  } else {
    const note = el('div', { class: 'comment-note' }, [
      el('div', { class: 'tag' }, `${filePath}:L${line}`),
      el('div', { class: 'saved-body' }, comment.body),
      el('div', { class: 'saved-actions' }, [
        el('button', { onclick: () => { comment.editing = true; render(); } }, 'Edit'),
        el('button', { onclick: () => { state.comments.delete(key); render(); } }, 'Remove'),
      ]),
    ]);
    td.appendChild(note);
  }

  tr.appendChild(td);
  return tr;
}

function renderSubmitBar() {
  const n = totalComments();
  const bar = el('div', { class: 'submit-bar' }, [
    el('span', { class: 'count' }, [
      n > 0 ? el('strong', {}, String(n)) : '0',
      ` comment${n === 1 ? '' : 's'}`,
    ]),
    el('button', {
      class: 'send-btn',
      disabled: state.files.length === 0 ? 'true' : null,
      onclick: submitReview,
    }, [
      el('span', { class: 'glyph' }, '›'),
      n > 0 ? 'Send to Claude' : 'Finish (no comments)',
    ]),
  ]);
  return bar;
}

function renderSubmittedScreen() {
  return el('div', { class: 'submitted-screen' }, [
    el('div', { class: 'glyph' }, '✓'),
    el('h1', {}, 'Review sent'),
    el('p', {}, 'Claude Code has received your comments and this tab can be closed. The tunnel will shut down shortly.'),
  ]);
}

async function submitReview() {
  const comments = [...state.comments.values()]
    .filter((c) => !c.editing && c.body)
    .map((c) => ({ filePath: c.filePath, line: c.line, side: c.side, body: c.body }));

  try {
    await apiFetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments }),
    });
    state.submitted = true;
    render();
  } catch (err) {
    alert(`Failed to submit: ${err.message}`);
  }
}

async function init() {
  try {
    const data = await apiFetch('/api/diff');
    state.label = data.label;
    state.files = data.files;
    render();
  } catch (err) {
    app.innerHTML = '';
    app.appendChild(el('div', { class: 'empty-state' }, [
      el('div', { class: 'glyph' }, '⚠'),
      el('div', {}, `Failed to load diff: ${err.message}`),
    ]));
  }
}

init();

import { simpleGit } from 'simple-git';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const FULL_SHA = /^[0-9a-f]{40}$/;
const WORKING_TREE_TARGETS = new Set(['.', 'staged', 'staging', 'working']);
const HUNK_HEADER = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/;

const FILE_STATUS_PREFIXES = [
  ['new file mode', 'added'],
  ['deleted file mode', 'deleted'],
  ['rename from', 'renamed'],
];

async function assertRevision(git, ref) {
  const resolved = await git
    .raw(['rev-parse', '--verify', '--quiet', '--end-of-options', ref])
    .catch(() => '');

  if (!FULL_SHA.test(resolved.trim())) {
    throw new Error(`${ref} is not a valid git revision.`);
  }
}

function diffArgs(contextArgs, ...revisions) {
  return ['diff', ...contextArgs, '--end-of-options', ...revisions];
}

function diffAgainstParent(git, contextArgs, revision) {
  return git
    .raw(diffArgs(contextArgs, `${revision}~1`, revision))
    .catch(() => git.raw(diffArgs(contextArgs, EMPTY_TREE, revision)));
}

async function resolveRaw(git, { target, compareWith, contextArgs }) {
  if (!target || target === 'HEAD') {
    return { raw: await diffAgainstParent(git, contextArgs, 'HEAD'), label: 'HEAD (latest commit)' };
  }

  if (target === '.') {
    return { raw: await git.raw(diffArgs(contextArgs, 'HEAD')), label: 'All uncommitted changes' };
  }

  if (target === 'staged' || target === 'staging') {
    return { raw: await git.raw(['diff', ...contextArgs, '--cached']), label: 'Staged changes' };
  }

  if (target === 'working') {
    return { raw: await git.raw(['diff', ...contextArgs]), label: 'Unstaged changes' };
  }

  if (compareWith) {
    return {
      raw: await git.raw(diffArgs(contextArgs, target, compareWith)),
      label: `${target}..${compareWith}`,
    };
  }

  return { raw: await diffAgainstParent(git, contextArgs, target), label: target };
}

export async function resolveDiff({ cwd, target, compareWith, contextLines }) {
  const git = simpleGit({ baseDir: cwd });

  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error(`Not a git repository: ${cwd}`);
  }

  if (target && !WORKING_TREE_TARGETS.has(target)) {
    await assertRevision(git, target);
  }

  if (compareWith) {
    await assertRevision(git, compareWith);
  }

  const contextArgs = contextLines != null ? [`--unified=${contextLines}`] : [];
  const { raw, label } = await resolveRaw(git, { target, compareWith, contextArgs });

  return { label, raw: raw || '', files: parseUnifiedDiff(raw || '') };
}

function fileStatusFor(line) {
  for (const [prefix, status] of FILE_STATUS_PREFIXES) {
    if (line.startsWith(prefix)) {
      return status;
    }
  }

  return null;
}

function hunkLineType(line) {
  if (line.startsWith('+')) {
    return 'add';
  }

  if (line.startsWith('-')) {
    return 'del';
  }

  if (line.startsWith(' ') || line === '') {
    return 'ctx';
  }

  return null;
}

function parseFileHeader(lines) {
  const match = lines[0].match(/a\/(.+?) b\/(.+)$/);
  const header = {
    oldPath: match ? match[1] : 'unknown',
    newPath: match ? match[2] : 'unknown',
    status: 'modified',
    isBinary: false,
    bodyStartIdx: 1,
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('@@')) {
      header.bodyStartIdx = i;
      break;
    }

    if (line.startsWith('Binary files')) {
      header.isBinary = true;
      continue;
    }

    const status = fileStatusFor(line);
    if (status) {
      header.status = status;
    }
  }

  return header;
}

function parseHunks(lines, bodyStartIdx) {
  const hunks = [];
  let currentHunk = null;
  let oldLine = 0;
  let newLine = 0;

  for (let i = bodyStartIdx; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('@@')) {
      const match = line.match(HUNK_HEADER);
      if (!match) {
        continue;
      }

      oldLine = parseInt(match[1], 10);
      newLine = parseInt(match[2], 10);
      currentHunk = { header: line, context: match[3]?.trim() || '', lines: [] };
      hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    const type = hunkLineType(line);
    const content = line.slice(1);

    if (type === 'add') {
      currentHunk.lines.push({ type, oldLine: null, newLine, content });
      newLine++;
      continue;
    }

    if (type === 'del') {
      currentHunk.lines.push({ type, oldLine, newLine: null, content });
      oldLine++;
      continue;
    }

    if (type === 'ctx') {
      currentHunk.lines.push({ type, oldLine, newLine, content });
      oldLine++;
      newLine++;
    }
  }

  return hunks;
}

export function parseUnifiedDiff(raw) {
  const files = [];
  if (!raw || !raw.trim()) {
    return files;
  }

  for (const chunk of raw.split(/^diff --git /m).slice(1)) {
    const lines = chunk.split('\n');
    const { oldPath, newPath, status, isBinary, bodyStartIdx } = parseFileHeader(lines);

    files.push({
      path: status === 'deleted' ? oldPath : newPath,
      oldPath,
      status,
      isBinary,
      hunks: isBinary ? [] : parseHunks(lines, bodyStartIdx),
    });
  }

  return files;
}

export async function getRepoRoot(cwd) {
  const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd });
  return stdout.trim();
}

import { simpleGit } from 'simple-git';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function resolveDiff({ cwd, target, compareWith, contextLines }) {
  const git = simpleGit({ baseDir: cwd });

  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error(`Not a git repository: ${cwd}`);
  }

  const contextArgs = contextLines != null ? [`--unified=${contextLines}`] : [];
  let raw;
  let label;

  if (!target || target === 'HEAD') {
    raw = await git.raw(['diff', ...contextArgs, 'HEAD~1', 'HEAD']).catch(async () => {
      return git.raw(['diff', ...contextArgs, '4b825dc642cb6eb9a060e54bf8d69288fbee4904', 'HEAD']);
    });
    label = 'HEAD (latest commit)';
  } else if (target === '.') {
    raw = await git.raw(['diff', ...contextArgs, 'HEAD']);
    label = 'All uncommitted changes';
  } else if (target === 'staged' || target === 'staging') {
    raw = await git.raw(['diff', ...contextArgs, '--cached']);
    label = 'Staged changes';
  } else if (target === 'working') {
    raw = await git.raw(['diff', ...contextArgs]);
    label = 'Unstaged changes';
  } else if (compareWith) {
    raw = await git.raw(['diff', ...contextArgs, target, compareWith]);
    label = `${target}..${compareWith}`;
  } else {
    raw = await git.raw(['diff', ...contextArgs, `${target}~1`, target]).catch(async () => {
      return git.raw(['diff', ...contextArgs, '4b825dc642cb6eb9a060e54bf8d69288fbee4904', target]);
    });
    label = `${target}`;
  }

  const files = parseUnifiedDiff(raw || '');
  return { label, raw: raw || '', files };
}

export function parseUnifiedDiff(raw) {
  const files = [];
  if (!raw || !raw.trim()) return files;

  const fileChunks = raw.split(/^diff --git /m).slice(1);

  for (const chunk of fileChunks) {
    const lines = chunk.split('\n');
    const headerLine = lines[0];
    const match = headerLine.match(/a\/(.+?) b\/(.+)$/);
    let oldPath = match ? match[1] : 'unknown';
    let newPath = match ? match[2] : 'unknown';

    let status = 'modified';
    let isBinary = false;
    let bodyStartIdx = 1;

    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.startsWith('new file mode')) status = 'added';
      else if (l.startsWith('deleted file mode')) status = 'deleted';
      else if (l.startsWith('rename from')) status = 'renamed';
      else if (l.startsWith('Binary files')) isBinary = true;
      else if (l.startsWith('--- ') || l.startsWith('+++ ')) {
        continue;
      } else if (l.startsWith('@@')) {
        bodyStartIdx = i;
        break;
      }
    }

    const path = status === 'deleted' ? oldPath : newPath;
    files.push({ path, oldPath, status, isBinary, hunks: [] });
  }

  return files;
}

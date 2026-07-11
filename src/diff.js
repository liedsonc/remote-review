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
  }

  const files = parseUnifiedDiff(raw || '');
  return { label, raw: raw || '', files };
}

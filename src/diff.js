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

  return { label, raw: raw || '', files: [] };
}

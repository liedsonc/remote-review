import { describe, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveDiff } from '../src/diff.js';

const SPY_PATH = path.join(os.tmpdir(), 'remote-review-arg-injection-spy.txt');
const SPY_CONTENT = 'must survive\n';

let repoDir;

function git(...args) {
  execFileSync('git', ['-C', repoDir, ...args], { stdio: 'pipe' });
}

function write(name, contents) {
  fs.writeFileSync(path.join(repoDir, name), contents);
}

describe('resolveDiff ref validation', () => {
  before(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-review-fixture-'));
    execFileSync('git', ['init', '-q', repoDir], { stdio: 'pipe' });
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'remote-review tests');
    git('config', 'commit.gpgsign', 'false');

    write('a.txt', 'one\n');
    git('add', 'a.txt');
    git('commit', '-q', '-m', 'first');

    write('a.txt', 'one\ntwo\n');
    git('add', 'a.txt');
    git('commit', '-q', '-m', 'second');

    write('b.txt', 'staged\n');
    git('add', 'b.txt');
    write('a.txt', 'one\ntwo\nthree\n');
  });

  after(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    fs.writeFileSync(SPY_PATH, SPY_CONTENT);
  });

  afterEach(() => {
    fs.rmSync(SPY_PATH, { force: true });
    fs.rmSync(`${SPY_PATH}~1`, { force: true });
  });

  test('rejects a target that git would read as an option', async () => {
    await assert.rejects(
      () => resolveDiff({ cwd: repoDir, target: `--output=${SPY_PATH}` }),
      /not a valid git revision/i,
    );
  });

  test('leaves the file named by an --output target untouched', async () => {
    await resolveDiff({ cwd: repoDir, target: `--output=${SPY_PATH}` }).catch(() => {});
    assert.equal(fs.readFileSync(SPY_PATH, 'utf8'), SPY_CONTENT);
  });

  test('rejects a compareWith that git would read as an option', async () => {
    await assert.rejects(
      () => resolveDiff({ cwd: repoDir, target: 'HEAD', compareWith: `--output=${SPY_PATH}` }),
      /not a valid git revision/i,
    );
  });

  test('leaves the file named by an --output compareWith untouched', async () => {
    await resolveDiff({ cwd: repoDir, target: 'HEAD', compareWith: `--output=${SPY_PATH}` }).catch(() => {});
    assert.equal(fs.readFileSync(SPY_PATH, 'utf8'), SPY_CONTENT);
  });

  test('rejects a bare leading dash that names no file', async () => {
    await assert.rejects(
      () => resolveDiff({ cwd: repoDir, target: '--stat' }),
      /not a valid git revision/i,
    );
  });

  test('rejects a revision that does not exist', async () => {
    await assert.rejects(
      () => resolveDiff({ cwd: repoDir, target: 'no-such-ref-anywhere' }),
      /not a valid git revision/i,
    );
  });

  test('names the offending revision in the error', async () => {
    await assert.rejects(
      () => resolveDiff({ cwd: repoDir, target: 'no-such-ref-anywhere' }),
      /no-such-ref-anywhere/,
    );
  });

  test('still resolves all uncommitted changes', async () => {
    const result = await resolveDiff({ cwd: repoDir, target: '.' });
    assert.deepEqual(result.files.map((f) => f.path).sort(), ['a.txt', 'b.txt']);
    assert.equal(result.label, 'All uncommitted changes');
  });

  test('still resolves staged changes only', async () => {
    const result = await resolveDiff({ cwd: repoDir, target: 'staged' });
    assert.deepEqual(result.files.map((f) => f.path), ['b.txt']);
    assert.equal(result.label, 'Staged changes');
  });

  test('still resolves unstaged changes only', async () => {
    const result = await resolveDiff({ cwd: repoDir, target: 'working' });
    assert.deepEqual(result.files.map((f) => f.path), ['a.txt']);
    assert.equal(result.label, 'Unstaged changes');
  });

  test('still resolves a real revision', async () => {
    const result = await resolveDiff({ cwd: repoDir, target: 'HEAD' });
    assert.deepEqual(result.files.map((f) => f.path), ['a.txt']);
    assert.equal(result.label, 'HEAD (latest commit)');
  });

  test('still resolves a real revision pair', async () => {
    const result = await resolveDiff({ cwd: repoDir, target: 'HEAD~1', compareWith: 'HEAD' });
    assert.deepEqual(result.files.map((f) => f.path), ['a.txt']);
    assert.equal(result.label, 'HEAD~1..HEAD');
  });

  test('still resolves the default target', async () => {
    const result = await resolveDiff({ cwd: repoDir });
    assert.deepEqual(result.files.map((f) => f.path), ['a.txt']);
    assert.equal(result.label, 'HEAD (latest commit)');
  });

  test('falls back to the empty tree for a commit with no parent', async () => {
    const result = await resolveDiff({ cwd: repoDir, target: 'HEAD~1' });
    assert.deepEqual(result.files.map((f) => f.path), ['a.txt']);
    assert.equal(result.files[0].status, 'added');
    assert.equal(result.label, 'HEAD~1');
  });

  test('rejects a directory that is not a git repository', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-review-not-a-repo-'));
    try {
      await assert.rejects(
        () => resolveDiff({ cwd: outside, target: 'HEAD' }),
        /not a git repository/i,
      );
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});

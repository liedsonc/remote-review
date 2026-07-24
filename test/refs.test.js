import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDiff } from '../src/diff.js';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPY_PATH = path.join(os.tmpdir(), 'remote-review-arg-injection-spy.txt');
const SPY_CONTENT = 'must survive\n';

describe('resolveDiff ref validation', () => {
  beforeEach(() => {
    fs.writeFileSync(SPY_PATH, SPY_CONTENT);
  });

  afterEach(() => {
    fs.rmSync(SPY_PATH, { force: true });
    fs.rmSync(`${SPY_PATH}~1`, { force: true });
  });

  test('rejects a target that git would read as an option', async () => {
    await assert.rejects(
      () => resolveDiff({ cwd: REPO_ROOT, target: `--output=${SPY_PATH}` }),
      /not a valid git revision/i,
    );
  });

  test('leaves the file named by an --output target untouched', async () => {
    await resolveDiff({ cwd: REPO_ROOT, target: `--output=${SPY_PATH}` }).catch(() => {});
    assert.equal(fs.readFileSync(SPY_PATH, 'utf8'), SPY_CONTENT);
  });

  test('rejects a compareWith that git would read as an option', async () => {
    await assert.rejects(
      () => resolveDiff({ cwd: REPO_ROOT, target: 'HEAD', compareWith: `--output=${SPY_PATH}` }),
      /not a valid git revision/i,
    );
  });

  test('leaves the file named by an --output compareWith untouched', async () => {
    await resolveDiff({ cwd: REPO_ROOT, target: 'HEAD', compareWith: `--output=${SPY_PATH}` }).catch(() => {});
    assert.equal(fs.readFileSync(SPY_PATH, 'utf8'), SPY_CONTENT);
  });

  test('rejects a bare leading dash that names no file', async () => {
    await assert.rejects(
      () => resolveDiff({ cwd: REPO_ROOT, target: '--stat' }),
      /not a valid git revision/i,
    );
  });

  test('rejects a revision that does not exist', async () => {
    await assert.rejects(
      () => resolveDiff({ cwd: REPO_ROOT, target: 'no-such-ref-anywhere' }),
      /not a valid git revision/i,
    );
  });

  test('names the offending revision in the error', async () => {
    await assert.rejects(
      () => resolveDiff({ cwd: REPO_ROOT, target: 'no-such-ref-anywhere' }),
      /no-such-ref-anywhere/,
    );
  });

  test('still resolves the working-tree targets', async () => {
    for (const target of ['.', 'staged', 'working']) {
      const result = await resolveDiff({ cwd: REPO_ROOT, target });
      assert.ok(Array.isArray(result.files), `${target} should return files`);
    }
  });

  test('still resolves a real revision', async () => {
    const result = await resolveDiff({ cwd: REPO_ROOT, target: 'HEAD~1' });
    assert.ok(result.files.length > 0);
    assert.equal(result.label, 'HEAD~1');
  });

  test('still resolves a real revision pair', async () => {
    const result = await resolveDiff({ cwd: REPO_ROOT, target: 'HEAD~1', compareWith: 'HEAD' });
    assert.ok(result.files.length > 0);
    assert.equal(result.label, 'HEAD~1..HEAD');
  });

  test('still resolves the default target', async () => {
    const result = await resolveDiff({ cwd: REPO_ROOT });
    assert.equal(result.label, 'HEAD (latest commit)');
  });
});

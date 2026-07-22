import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiff } from '../src/diff.js';

describe('parseUnifiedDiff', () => {
  test('returns empty array for empty input', () => {
    assert.deepEqual(parseUnifiedDiff(''), []);
    assert.deepEqual(parseUnifiedDiff('   \n  '), []);
  });

  test('parses a modified file with add, delete, and context lines', () => {
    const raw = `diff --git a/src/foo.js b/src/foo.js
index abc123..def456 100644
--- a/src/foo.js
+++ b/src/foo.js
@@ -1,3 +1,3 @@
 line1
-old line
+new line
 line3`;

    const [file] = parseUnifiedDiff(raw);
    assert.equal(file.path, 'src/foo.js');
    assert.equal(file.oldPath, 'src/foo.js');
    assert.equal(file.status, 'modified');
    assert.equal(file.isBinary, false);
    assert.equal(file.hunks.length, 1);

    const lines = file.hunks[0].lines;
    assert.deepEqual(lines.find((l) => l.type === 'ctx'), {
      type: 'ctx',
      oldLine: 1,
      newLine: 1,
      content: 'line1',
    });
    assert.deepEqual(lines.find((l) => l.type === 'del'), {
      type: 'del',
      oldLine: 2,
      newLine: null,
      content: 'old line',
    });
    assert.deepEqual(lines.find((l) => l.type === 'add'), {
      type: 'add',
      oldLine: null,
      newLine: 2,
      content: 'new line',
    });
  });

  test('parses an added file', () => {
    const raw = `diff --git a/README.md b/README.md
new file mode 100644
index 0000000..e69de29
--- /dev/null
+++ b/README.md
@@ -0,0 +1,2 @@
+# hello
+world`;

    const [file] = parseUnifiedDiff(raw);
    assert.equal(file.path, 'README.md');
    assert.equal(file.status, 'added');
    assert.equal(file.isBinary, false);
    assert.equal(file.hunks[0].lines.filter((l) => l.type === 'add').length, 2);
  });

  test('parses a deleted file', () => {
    const raw = `diff --git a/old.txt b/old.txt
deleted file mode 100644
index e69de29..0000000
--- a/old.txt
+++ /dev/null
@@ -1 +0,0 @@
-gone`;

    const [file] = parseUnifiedDiff(raw);
    assert.equal(file.path, 'old.txt');
    assert.equal(file.status, 'deleted');
    assert.equal(file.hunks[0].lines.filter((l) => l.type === 'del').length, 1);
  });

  test('parses a binary file', () => {
    const raw = `diff --git a/image.png b/image.png
index 1111111..2222222 100644
Binary files a/image.png and b/image.png differ`;

    const [file] = parseUnifiedDiff(raw);
    assert.equal(file.path, 'image.png');
    assert.equal(file.status, 'modified');
    assert.equal(file.isBinary, true);
    assert.deepEqual(file.hunks, []);
  });

  test('parses a rename', () => {
    const raw = `diff --git a/old-name.js b/new-name.js
similarity index 100%
rename from old-name.js
rename to new-name.js`;

    const [file] = parseUnifiedDiff(raw);
    assert.equal(file.path, 'new-name.js');
    assert.equal(file.oldPath, 'old-name.js');
    assert.equal(file.status, 'renamed');
  });

  test('parses multiple files in one diff', () => {
    const raw = `diff --git a/a.txt b/a.txt
index 111..222 100644
--- a/a.txt
+++ b/a.txt
@@ -1 +1 @@
-a
+b
diff --git a/c.txt b/c.txt
index 333..444 100644
--- a/c.txt
+++ b/c.txt
@@ -1 +1 @@
-x
+y`;

    const files = parseUnifiedDiff(raw);
    assert.equal(files.length, 2);
    assert.equal(files[0].path, 'a.txt');
    assert.equal(files[1].path, 'c.txt');
  });
});

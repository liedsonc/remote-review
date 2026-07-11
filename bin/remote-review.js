#!/usr/bin/env node
import { Command } from 'commander';
import getPort from 'get-port';
import crypto from 'node:crypto';
import process from 'node:process';

import { resolveDiff } from '../src/diff.js';
import { createServer } from '../server/index.js';
import { isCloudflaredAvailable, startTunnel, stopTunnel } from '../src/tunnel.js';

const program = new Command();

program
  .name('remote-review')
  .description('Spin up a shareable, tunneled diff review page for a git diff, and print submitted comments to stdout on exit.')
  .argument('[target]', 'commit-ish to review, or one of: . | staged | working (default: HEAD)')
  .argument('[compareWith]', 'optional second ref to diff against target')
  .option('-p, --port <port>', 'local port to bind (default: random free port)')
  .option('--no-tunnel', 'skip the cloudflared tunnel and only bind locally')
  .option('--host <host>', 'host to bind the local server to', '127.0.0.1')
  .option('-C, --cwd <path>', 'run as if started in this directory', process.cwd())
  .option('--context <lines>', 'number of context lines around each change', (v) => parseInt(v, 10))
  .option('--timeout <seconds>', 'give up waiting for a review after this many seconds (default: no timeout)', (v) => parseInt(v, 10))
  .option('--no-open', 'do not attempt to open the local URL in a browser')
  .parse(process.argv);

const opts = program.opts();
const [target, compareWith] = program.args;

async function main() {
  let diffData;
  try {
    diffData = await resolveDiff({
      cwd: opts.cwd,
      target,
      compareWith,
      contextLines: opts.context,
    });
  } catch (err) {
    console.error(`[remote-review] Failed to resolve diff: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  if (diffData.files.length === 0) {
    console.log('[remote-review] No changes found for the requested target — nothing to review.');
    return;
  }

  const port = opts.port ? parseInt(opts.port, 10) : await getPort();
  const token = crypto.randomBytes(16).toString('hex');

  let resolveSubmission;
  const submissionPromise = new Promise((resolve) => { resolveSubmission = resolve; });

  const { app } = createServer({
    diffData,
    token,
    onSubmit: (comments) => resolveSubmission({ comments, timedOut: false }),
  });

  const httpServer = app.listen(port, opts.host, () => {});

  const localUrl = `http://${opts.host === '0.0.0.0' ? 'localhost' : opts.host}:${port}/?t=${token}`;
  let tunnelUrl = null;
  let tunnelProc = null;

  if (opts.tunnel) {
    const available = await isCloudflaredAvailable();
    if (!available) {
      console.error(
        '[remote-review] cloudflared is not installed or not on PATH — skipping the tunnel.\n' +
        '  Install it from https://github.com/cloudflare/cloudflared/releases and re-run,\n' +
        '  or pass --no-tunnel to only bind locally.'
      );
    } else {
      try {
        const tunnel = await startTunnel(port);
        tunnelUrl = tunnel.url;
        tunnelProc = tunnel.proc;
      } catch (err) {
        console.error(`[remote-review] Failed to start tunnel: ${err.message}`);
      }
    }
  }

  const publicUrl = tunnelUrl ? `${tunnelUrl}/?t=${token}` : localUrl;

  console.error(`[remote-review] Reviewing: ${diffData.label}`);
  console.error(`[remote-review] Files changed: ${diffData.files.length}`);
  console.error(`[remote-review] Local:  ${localUrl}`);
  if (tunnelUrl) {
    console.error(`[remote-review] Remote: ${publicUrl}`);
  }
  console.error('[remote-review] Waiting for review to be submitted…');

  let timeoutHandle = null;
  if (opts.timeout) {
    timeoutHandle = setTimeout(() => {
      resolveSubmission({ comments: [], timedOut: true });
    }, opts.timeout * 1000);
  }

  const cleanup = () => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (tunnelProc) stopTunnel(tunnelProc);
    httpServer.close();
  };

  // Allow Ctrl+C to exit gracefully and still print whatever was gathered (nothing, in that case).
  process.on('SIGINT', () => {
    console.error('\n[remote-review] Interrupted — no review submitted.');
    cleanup();
    process.exit(130);
  });

  const { comments, timedOut } = await submissionPromise;
  cleanup();

  if (timedOut) {
    console.error('[remote-review] Timed out waiting for a review.');
    return;
  }

  if (comments.length === 0) {
    console.log('[remote-review] Review finished with no comments.');
    return;
  }

  // difit-compatible prompt format: one block per comment.
  console.log(formatCommentsAsPrompt(comments));
}

function formatCommentsAsPrompt(comments) {
  const lines = [];
  for (const c of comments) {
    lines.push(`${c.filePath}:L${c.line}`);
    lines.push(c.body.trim());
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

main().catch((err) => {
  console.error(`[remote-review] Unexpected error: ${err.stack || err.message}`);
  process.exitCode = 1;
});

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

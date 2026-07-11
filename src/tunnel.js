import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const TRYCLOUDFLARE_RE = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;

export async function isCloudflaredAvailable() {
  try {
    await execFileAsync('cloudflared', ['--version']);
    return true;
  } catch {
    return false;
  }
}

export function startTunnel(port, { timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill();
        reject(new Error('Timed out waiting for cloudflared to produce a tunnel URL.'));
      }
    }, timeoutMs);

    return { proc, timer, settled, resolve, reject };
  });
}

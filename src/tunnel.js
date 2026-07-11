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

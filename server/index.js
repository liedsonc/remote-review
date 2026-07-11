import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

export function createServer({ diffData, token, onSubmit }) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  return { app };
}

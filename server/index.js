import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

export function createServer({ diffData, token, onSubmit }) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  function checkToken(req, res, next) {
    const provided = req.query.t || req.headers['x-review-token'];
    if (provided !== token) {
      return res.status(403).json({ error: 'Invalid or missing review token.' });
    }
    next();
  }


  app.get('/api/diff', checkToken, (req, res) => {
    res.json(diffData);
  });

  return { app };
}

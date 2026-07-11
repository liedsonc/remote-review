import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/**
 * Creates the review server.
 *
 * @param {object} opts
 * @param {object} opts.diffData - { label, files } to serve at GET /api/diff
 * @param {string} opts.token - random token required as ?t= query param or X-Review-Token header, to keep the tunnel URL from being enough on its own for someone who merely sees it in a log
 * @param {(comments: object[]) => void} opts.onSubmit - called once when the user submits a review
 * @returns {{ app: import('express').Express }}
 */
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

  let submitted = false;
  app.post('/api/submit', checkToken, (req, res) => {
    if (submitted) {
      return res.status(409).json({ error: 'Review already submitted.' });
    }
    submitted = true;
    const comments = Array.isArray(req.body?.comments) ? req.body.comments : [];
    res.json({ ok: true });
    onSubmit(comments);
  });

  // Static frontend; index.html gets the token injected client-side via URL fragment/query,
  // so we don't need to template it server-side.
  app.use(express.static(PUBLIC_DIR));

  app.get('*', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  return { app };
}

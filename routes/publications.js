const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Helper — parse JSON columns safely
function parsePub(row) {
  return {
    ...row,
    tags: tryParse(row.tags, []),
    coauthors: tryParse(row.coauthors, []),
  };
}
function tryParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ─── GET /api/publications ──────────────────────────────────────────────────
// Public. Returns all publications ordered by sort_order.
router.get('/', (req, res) => {
  const rows = getDB()
    .prepare(`SELECT * FROM publications ORDER BY sort_order ASC, created_at DESC`)
    .all();
  res.json(rows.map(parsePub));
});

// ─── GET /api/publications/:id ──────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const row = getDB()
    .prepare(`SELECT * FROM publications WHERE id = ?`)
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(parsePub(row));
});

// ─── POST /api/publications (admin) ────────────────────────────────────────
router.post('/', requireAuth, (req, res) => {
  const { title, venue, status = 'ONGOING', arxiv_url, doi_url,
    tags = [], coauthors = [], abstract, submitted_at, accepted_at, sort_order = 0 } = req.body;

  if (!title) return res.status(400).json({ error: 'title is required' });

  const result = getDB()
    .prepare(`
      INSERT INTO publications
        (title, venue, status, arxiv_url, doi_url, tags, coauthors, abstract, submitted_at, accepted_at, sort_order)
      VALUES
        (@title, @venue, @status, @arxiv_url, @doi_url, @tags, @coauthors, @abstract, @submitted_at, @accepted_at, @sort_order)
    `)
    .run({
      title, venue, status, arxiv_url: arxiv_url || null, doi_url: doi_url || null,
      tags: JSON.stringify(tags), coauthors: JSON.stringify(coauthors),
      abstract: abstract || null, submitted_at: submitted_at || null,
      accepted_at: accepted_at || null, sort_order,
    });

  res.status(201).json({ id: result.lastInsertRowid });
});

// ─── PATCH /api/publications/:id (admin) ───────────────────────────────────
const ALLOWED_FIELDS = ['title', 'venue', 'status', 'arxiv_url', 'doi_url',
  'tags', 'coauthors', 'abstract', 'submitted_at', 'accepted_at', 'sort_order'];

router.patch('/:id', requireAuth, (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM publications WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const updates = {};
  for (const field of ALLOWED_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = Array.isArray(req.body[field])
        ? JSON.stringify(req.body[field])
        : req.body[field];
    }
  }

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'No valid fields to update' });

  const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE publications SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`)
    .run({ ...updates, id: req.params.id });

  res.json({ ok: true });
});

// ─── DELETE /api/publications/:id (admin) ──────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => {
  const result = getDB()
    .prepare('DELETE FROM publications WHERE id = ?')
    .run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;

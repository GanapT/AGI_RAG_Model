const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { requireAuth } = require('../middleware/auth');

// ─── GET /api/deadlines ──────────────────────────────────────────────────────
// Public. Returns all deadlines ordered by deadline date ascending.
// Adds a computed `days_left` field (null if deadline has passed).
router.get('/', (req, res) => {
  const rows = getDB()
    .prepare('SELECT * FROM deadlines ORDER BY sort_order ASC, deadline ASC')
    .all();

  const now = new Date();
  const enriched = rows.map(row => {
    const deadline = new Date(row.deadline);
    const ms = deadline - now;
    return {
      ...row,
      days_left: ms > 0 ? Math.ceil(ms / 86_400_000) : null,
      is_past:   ms <= 0,
    };
  });

  res.json(enriched);
});

// ─── POST /api/deadlines (admin) ─────────────────────────────────────────────
// Body: { conf, deadline, notification_date?, camera_ready_date?, status?, url?, notes?, sort_order? }
router.post('/', requireAuth, (req, res) => {
  const {
    conf, deadline, notification_date, camera_ready_date,
    status = 'targeting', url, notes, sort_order = 0,
  } = req.body;

  if (!conf || !deadline) {
    return res.status(400).json({ error: 'conf and deadline are required' });
  }

  const result = getDB()
    .prepare(`
      INSERT INTO deadlines
        (conf, deadline, notification_date, camera_ready_date, status, url, notes, sort_order)
      VALUES
        (@conf, @deadline, @notification_date, @camera_ready_date, @status, @url, @notes, @sort_order)
    `)
    .run({
      conf, deadline,
      notification_date: notification_date || null,
      camera_ready_date: camera_ready_date || null,
      status, url: url || null, notes: notes || null, sort_order,
    });

  res.status(201).json({ id: result.lastInsertRowid });
});

// ─── PATCH /api/deadlines/:id (admin) ────────────────────────────────────────
const ALLOWED = ['conf', 'deadline', 'notification_date', 'camera_ready_date',
  'status', 'url', 'notes', 'sort_order'];

router.patch('/:id', requireAuth, (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT id FROM deadlines WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const updates = {};
  for (const field of ALLOWED) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'No valid fields to update' });

  const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE deadlines SET ${setClauses} WHERE id = @id`)
    .run({ ...updates, id: req.params.id });

  res.json({ ok: true });
});

// ─── DELETE /api/deadlines/:id (admin) ───────────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => {
  const result = getDB()
    .prepare('DELETE FROM deadlines WHERE id = ?')
    .run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;

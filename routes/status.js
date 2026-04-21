const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Helper — turn rows into a plain object
function statusMap(rows) {
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// ─── GET /api/status ────────────────────────────────────────────────────────
// Public. Returns all site status values as a flat object.
// Frontend uses this to drive: open_to_work badge, thesis bar, current focus, etc.
router.get('/', (req, res) => {
  const rows = getDB().prepare('SELECT key, value FROM site_status').all();
  const raw = statusMap(rows);

  // Cast booleans and numbers for the frontend
  res.json({
    open_to_work:   raw.open_to_work   === 'true',
    open_to_collab: raw.open_to_collab === 'true',
    thesis_chapter: parseInt(raw.thesis_chapter, 10),
    thesis_total:   parseInt(raw.thesis_total,   10),
    thesis_current: raw.thesis_current,
    defense_date:   raw.defense_date,
    current_focus:  raw.current_focus,
    available_from: raw.available_from,
  });
});

// ─── GET /api/status/opportunities ──────────────────────────────────────────
// Public. Returns the Seeking Opportunities section content.
router.get('/opportunities', (req, res) => {
  const rows = getDB().prepare('SELECT key, value FROM opportunities').all();
  const raw = statusMap(rows);
  res.json({
    headline:    raw.headline,
    focus_areas: tryParse(raw.focus_areas, []),
    note:        raw.note,
  });
});

// ─── PATCH /api/status (admin) ──────────────────────────────────────────────
// Body: any subset of the status keys
// e.g. { open_to_work: true, thesis_chapter: 3 }
const VALID_STATUS_KEYS = [
  'open_to_work', 'open_to_collab', 'thesis_chapter', 'thesis_total',
  'thesis_current', 'defense_date', 'current_focus', 'available_from',
];

router.patch('/', requireAuth, (req, res) => {
  const db = getDB();
  const upsert = db.prepare(`
    INSERT INTO site_status (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  let updated = 0;
  for (const key of VALID_STATUS_KEYS) {
    if (req.body[key] !== undefined) {
      upsert.run(key, String(req.body[key]));
      updated++;
    }
  }

  if (updated === 0) return res.status(400).json({ error: 'No valid keys provided' });
  res.json({ ok: true, updated });
});

// ─── PATCH /api/status/opportunities (admin) ────────────────────────────────
router.patch('/opportunities', requireAuth, (req, res) => {
  const db = getDB();
  const upsert = db.prepare(`
    INSERT INTO opportunities (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  const allowed = { headline: true, focus_areas: true, note: true };
  let updated = 0;

  for (const key of Object.keys(allowed)) {
    if (req.body[key] !== undefined) {
      const value = Array.isArray(req.body[key])
        ? JSON.stringify(req.body[key])
        : String(req.body[key]);
      upsert.run(key, value);
      updated++;
    }
  }

  if (updated === 0) return res.status(400).json({ error: 'No valid fields provided' });
  res.json({ ok: true, updated });
});

function tryParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

module.exports = router;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db');
const { requireAuth } = require('../middleware/auth');

// ─── POST /admin/login ────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password required' });

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    return res.status(500).json({
      error: 'Admin password not configured. Run: node scripts/hash-password.js',
    });
  }

  const match = await bcrypt.compare(password, hash);
  if (!match) return res.status(401).json({ error: 'Invalid password' });

  const token = jwt.sign(
    { role: 'admin', iat: Date.now() },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    expires_in: 86400,
    message: 'Logged in. Store token in localStorage["gt_admin_token"].',
  });
});

// ─── GET /admin/analytics (admin only) ───────────────────────────────────────
// Full analytics — breakdown by page, device, country, referrer, events
router.get('/analytics', requireAuth, (req, res) => {
  const db = getDB();
  const days = parseInt(req.query.days, 10) || 30;

  const since = `datetime('now', '-${days} days')`;

  const totalViews = db.prepare(
    `SELECT COUNT(*) as n FROM analytics WHERE event='pageview' AND created_at >= ${since}`
  ).get().n;

  const totalResume = db.prepare(
    `SELECT COUNT(*) as n FROM analytics WHERE event='resume_download' AND created_at >= ${since}`
  ).get().n;

  const byDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as visits
    FROM analytics
    WHERE event='pageview' AND created_at >= ${since}
    GROUP BY day ORDER BY day ASC
  `).all();

  const byPage = db.prepare(`
    SELECT page, COUNT(*) as visits
    FROM analytics
    WHERE event='pageview' AND created_at >= ${since}
    GROUP BY page ORDER BY visits DESC
    LIMIT 10
  `).all();

  const byDevice = db.prepare(`
    SELECT device, COUNT(*) as n
    FROM analytics
    WHERE event='pageview' AND created_at >= ${since}
    GROUP BY device
  `).all();

  const byCountry = db.prepare(`
    SELECT country, COUNT(*) as n
    FROM analytics
    WHERE event='pageview' AND created_at >= ${since} AND country IS NOT NULL
    GROUP BY country ORDER BY n DESC
    LIMIT 10
  `).all();

  const byReferrer = db.prepare(`
    SELECT referrer, COUNT(*) as n
    FROM analytics
    WHERE event='pageview' AND created_at >= ${since} AND referrer IS NOT NULL AND referrer != ''
    GROUP BY referrer ORDER BY n DESC
    LIMIT 10
  `).all();

  const bySectionView = db.prepare(`
    SELECT section, COUNT(*) as n
    FROM analytics
    WHERE event='section_view' AND created_at >= ${since} AND section IS NOT NULL
    GROUP BY section ORDER BY n DESC
  `).all();

  const allCollabs = db.prepare(
    `SELECT COUNT(*) as n FROM collab_requests`
  ).get().n;

  const pendingCollabs = db.prepare(
    `SELECT COUNT(*) as n FROM collab_requests WHERE status='pending'`
  ).get().n;

  res.json({
    period_days: days,
    totals: {
      page_views:       totalViews,
      resume_downloads: totalResume,
      collab_requests:  allCollabs,
      pending_collabs:  pendingCollabs,
    },
    by_day:        byDay,
    by_page:       byPage,
    by_device:     byDevice,
    by_country:    byCountry,
    by_referrer:   byReferrer,
    by_section:    bySectionView,
  });
});

// ─── GET /admin/me (token check) ─────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, role: req.admin.role });
});

module.exports = router;

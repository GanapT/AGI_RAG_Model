const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// ─── POST /api/analytics/track ─────────────────────────────────────────────
// Called by the frontend on every page load, section view, or resume download
// Body: { event, page, referrer?, section? }
// Events: "pageview" | "resume_download" | "section_view" | "collab_click"
router.post('/track', (req, res) => {
  const { event = 'pageview', page = '/', referrer, section } = req.body;

  // Rough device detection from User-Agent
  const ua = req.headers['user-agent'] || '';
  const device = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';

  // Country from CF header (works on most shared hosts) or skip
  const country = req.headers['cf-ipcountry'] || req.headers['x-country-code'] || null;

  try {
    getDB()
      .prepare(`
        INSERT INTO analytics (event, page, referrer, country, device, section)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(event, page, referrer || null, country, device, section || null);

    res.json({ ok: true });
  } catch (err) {
    console.error('Analytics insert error:', err);
    res.status(500).json({ error: 'Failed to record event' });
  }
});

// ─── GET /api/analytics/summary ────────────────────────────────────────────
// Public lightweight summary (no sensitive data)
// Returns: total views, resume downloads, top referrers
router.get('/summary', (req, res) => {
  const db = getDB();

  const totalViews = db
    .prepare(`SELECT COUNT(*) as n FROM analytics WHERE event = 'pageview'`)
    .get().n;

  const resumeDownloads = db
    .prepare(`SELECT COUNT(*) as n FROM analytics WHERE event = 'resume_download'`)
    .get().n;

  const last7Days = db
    .prepare(`
      SELECT date(created_at) as day, COUNT(*) as visits
      FROM analytics
      WHERE event = 'pageview'
        AND created_at >= datetime('now', '-7 days')
      GROUP BY day
      ORDER BY day ASC
    `)
    .all();

  res.json({ totalViews, resumeDownloads, last7Days });
});

module.exports = router;

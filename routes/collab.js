const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { getDB } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Lazy mailer — only created if env vars are set
function getMailer() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

// ─── POST /api/collab ────────────────────────────────────────────────────────
// Public. Submits a collaboration request.
// Body: { name, email, institution?, type?, area?, message }
// type: "joint_paper" | "internship" | "consult" | "general"
router.post('/', async (req, res) => {
  const { name, email, institution, type = 'general', area, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'name, email, and message are required' });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const result = getDB()
      .prepare(`
        INSERT INTO collab_requests (name, email, institution, type, area, message)
        VALUES (@name, @email, @institution, @type, @area, @message)
      `)
      .run({ name, email, institution: institution || null, type, area: area || null, message });

    // Send notification email to Ganap
    const mailer = getMailer();
    if (mailer) {
      const typeLabel = {
        joint_paper: 'Joint Paper',
        internship:  'Internship',
        consult:     'Consultation',
        general:     'General',
      }[type] || type;

      await mailer.sendMail({
        from: `"GT Portfolio" <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER,
        subject: `[Collab Request] ${typeLabel} from ${name} — ${institution || 'Unknown Institution'}`,
        html: `
          <h2 style="color:#00a6ff">New Collaboration Request</h2>
          <table style="border-collapse:collapse;width:100%;font-family:monospace">
            <tr><td style="padding:6px 12px;color:#666">Name</td><td style="padding:6px 12px"><strong>${name}</strong></td></tr>
            <tr><td style="padding:6px 12px;color:#666">Email</td><td style="padding:6px 12px"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:6px 12px;color:#666">Institution</td><td style="padding:6px 12px">${institution || '—'}</td></tr>
            <tr><td style="padding:6px 12px;color:#666">Type</td><td style="padding:6px 12px">${typeLabel}</td></tr>
            <tr><td style="padding:6px 12px;color:#666">Research Area</td><td style="padding:6px 12px">${area || '—'}</td></tr>
          </table>
          <h3 style="color:#00a6ff">Message</h3>
          <blockquote style="border-left:3px solid #00a6ff;padding-left:12px;color:#333">${message}</blockquote>
          <p style="color:#666;font-size:12px">Reply ID: #${result.lastInsertRowid} | Manage at ganaptewary.com/admin</p>
        `,
      }).catch(err => console.error('Email send failed (non-fatal):', err));
    }

    res.status(201).json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Collab insert error:', err);
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

// ─── GET /api/collab (admin) ─────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM collab_requests ORDER BY created_at DESC';
  let args = [];
  if (status) {
    query = 'SELECT * FROM collab_requests WHERE status = ? ORDER BY created_at DESC';
    args = [status];
  }
  const rows = getDB().prepare(query).all(...args);
  res.json(rows);
});

// ─── PATCH /api/collab/:id (admin) ───────────────────────────────────────────
// Body: { status: "pending" | "replied" | "declined" }
router.patch('/:id', requireAuth, (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'replied', 'declined'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }

  const result = getDB()
    .prepare('UPDATE collab_requests SET status = ? WHERE id = ?')
    .run(status, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ─── DELETE /api/collab/:id (admin) ──────────────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => {
  const result = getDB()
    .prepare('DELETE FROM collab_requests WHERE id = ?')
    .run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;

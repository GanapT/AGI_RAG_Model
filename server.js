require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');

// ─── Guards ───────────────────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set in .env. Aborting.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = require('path').join(__dirname, 'public');

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.ALLOWED_ORIGIN || '*').split(',').map(s => s.trim());
    // Allow no-origin (curl, server-to-server) and matching origins
    if (!origin || allowed.includes('*') || allowed.includes(origin)) {
      return cb(null, true);
    }
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '50kb' }));
app.use(express.static(PUBLIC_DIR));

// ─── Request logger (dev) ─────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()}  ${req.method}  ${req.path}`);
    next();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/analytics',   require('./routes/analytics'));
app.use('/api/publications', require('./routes/publications'));
app.use('/api/status',       require('./routes/status'));
app.use('/api/collab',       require('./routes/collab'));
app.use('/api/deadlines',    require('./routes/deadlines'));
app.use('/admin',            require('./routes/admin'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), env: process.env.NODE_ENV || 'development' });
});

app.get('/', (_req, res) => {
  res.sendFile(require('path').join(PUBLIC_DIR, 'index.html'));
});

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 GT Backend running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health\n`);
    });
  })
  .catch(err => {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
  });

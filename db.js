const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = process.env.DB_PATH || './gt_data.sqlite';
let db;
let SQL;

class SQLJsDatabase {
  constructor(database, dbPath) {
    this.database = database;
    this.dbPath = dbPath;
  }

  exec(sql) {
    this.database.exec(sql);
    this.persist();
  }

  prepare(sql) {
    return new SQLJsStatement(this, sql);
  }

  persist() {
    if (this.dbPath === ':memory:') return;
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    fs.writeFileSync(this.dbPath, Buffer.from(this.database.export()));
  }
}

class SQLJsStatement {
  constructor(store, sql) {
    this.store = store;
    this.sql = sql;
  }

  get(...params) {
    const stmt = this.store.database.prepare(this.sql);
    try {
      this.bind(stmt, params);
      return stmt.step() ? stmt.getAsObject() : undefined;
    } finally {
      stmt.free();
    }
  }

  all(...params) {
    const stmt = this.store.database.prepare(this.sql);
    const rows = [];
    try {
      this.bind(stmt, params);
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  run(...params) {
    const stmt = this.store.database.prepare(this.sql);
    try {
      this.bind(stmt, params);
      while (stmt.step()) {}
      const changes = this.store.database.getRowsModified();
      const idRows = this.store.database.exec('SELECT last_insert_rowid() as id');
      const lastInsertRowid = idRows[0]?.values?.[0]?.[0] || 0;
      this.store.persist();
      return { changes, lastInsertRowid };
    } finally {
      stmt.free();
    }
  }

  bind(stmt, params) {
    if (params.length === 0) return;
    if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0])) {
      stmt.bind(this.namedParams(params[0]));
      return;
    }
    stmt.bind(params);
  }

  namedParams(params) {
    const normalized = {};
    for (const [key, value] of Object.entries(params)) {
      normalized[key] = value;
      normalized[`@${key}`] = value;
      normalized[`:${key}`] = value;
      normalized[`$${key}`] = value;
    }
    return normalized;
  }
}

async function getSQL() {
  if (!SQL) {
    const wasmDir = path.dirname(require.resolve('sql.js/dist/sql-wasm.wasm'));
    SQL = await initSqlJs({
      locateFile: file => path.join(wasmDir, file),
    });
  }
  return SQL;
}

function getDB() {
  if (!db) {
    throw new Error('Database has not been initialized. Call initDB() before handling requests.');
  }
  return db;
}

async function initDB() {
  const SQL = await getSQL();
  const resolvedPath = DB_PATH === ':memory:' ? DB_PATH : path.resolve(DB_PATH);
  const data = resolvedPath !== ':memory:' && fs.existsSync(resolvedPath)
    ? fs.readFileSync(resolvedPath)
    : undefined;

  db = new SQLJsDatabase(new SQL.Database(data), resolvedPath);
  const store = getDB();

  store.exec('PRAGMA foreign_keys = ON');
  store.exec(`
    -- ─── Analytics ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS analytics (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      event       TEXT    NOT NULL DEFAULT 'pageview',
      page        TEXT    NOT NULL,
      referrer    TEXT,
      country     TEXT,
      device      TEXT,
      section     TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ─── Publications ──────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS publications (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      title         TEXT    NOT NULL,
      venue         TEXT,
      status        TEXT    NOT NULL DEFAULT 'ONGOING',
      arxiv_url     TEXT,
      doi_url       TEXT,
      tags          TEXT    DEFAULT '[]',
      coauthors     TEXT    DEFAULT '[]',
      abstract      TEXT,
      submitted_at  TEXT,
      accepted_at   TEXT,
      sort_order    INTEGER DEFAULT 0,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ─── Site Status (key-value store) ─────────────────────────
    -- Keys: open_to_work, thesis_chapter, thesis_total,
    --       thesis_current, defense_date, current_focus,
    --       open_to_collab, available_from
    CREATE TABLE IF NOT EXISTS site_status (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ─── Opportunities section ──────────────────────────────────
    CREATE TABLE IF NOT EXISTS opportunities (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ─── Collaboration Requests ─────────────────────────────────
    CREATE TABLE IF NOT EXISTS collab_requests (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL,
      institution TEXT,
      type        TEXT,
      area        TEXT,
      message     TEXT,
      status      TEXT    NOT NULL DEFAULT 'pending',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ─── Conference Deadlines ───────────────────────────────────
    CREATE TABLE IF NOT EXISTS deadlines (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      conf              TEXT    NOT NULL,
      deadline          TEXT    NOT NULL,
      notification_date TEXT,
      camera_ready_date TEXT,
      status            TEXT    NOT NULL DEFAULT 'targeting',
      url               TEXT,
      notes             TEXT,
      sort_order        INTEGER DEFAULT 0,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default status values if they don't exist yet
  const defaults = [
    ['open_to_work',   'true'],
    ['open_to_collab', 'true'],
    ['thesis_chapter', '2'],
    ['thesis_total',   '5'],
    ['thesis_current', 'FPGA Datapath Design'],
    ['defense_date',   '2026-04-30'],
    ['current_focus',  'FPGA-Accelerated HNSW for sub-μs vector search'],
    ['available_from', 'Summer 2026'],
  ];

  const upsert = store.prepare(`
    INSERT INTO site_status (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO NOTHING
  `);
  defaults.forEach(([k, v]) => upsert.run(k, v));

  // Seed default opportunities if empty
  const oppDefaults = [
    ['headline',    'Summer 2026 ML Engineering Internship'],
    ['focus_areas', JSON.stringify([
      'HNSW and vector database optimizations',
      'Large-scale recommendation systems',
      'LLMs and RAG systems',
      'Model architecture optimization',
      'Hardware-accelerated ML',
    ])],
    ['note', 'Open to research collaborations in approximate nearest neighbor search and efficient ML systems.'],
  ];
  const upsertOpp = store.prepare(`
    INSERT INTO opportunities (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO NOTHING
  `);
  oppDefaults.forEach(([k, v]) => upsertOpp.run(k, v));

  // Seed publications if table is empty
  const pubCount = store.prepare('SELECT COUNT(*) as n FROM publications').get();
  if (pubCount.n === 0) {
    const insertPub = store.prepare(`
      INSERT INTO publications (title, venue, status, tags, sort_order)
      VALUES (@title, @venue, @status, @tags, @sort_order)
    `);
    [
      {
        title: 'AQR-HNSW: Accelerating Approximate Nearest Neighbor Search via Density-aware Quantization and Multi-stage Re-ranking',
        venue: 'Design and Automation Conference (DAC) 2026',
        status: 'SUBMITTED',
        tags: JSON.stringify(['HNSW', 'Vector Quantization', 'SIMD', 'C++']),
        sort_order: 0,
      },
      {
        title: 'FPGA-Accelerated HNSW: Hardware Implementation for Ultra-Low Latency Vector Search',
        venue: "Master's Thesis | Target: IEEE FCCM RCC 2026",
        status: 'ONGOING',
        tags: JSON.stringify(['FPGA', 'Verilog', 'HLS', 'Xilinx']),
        sort_order: 1,
      },
      {
        title: 'NEXUS-NAS: Multi-Fidelity Bayesian Optimization for Hardware-Aware Neural Architecture Search',
        venue: 'Target: NeurIPS 2026',
        status: 'ONGOING',
        tags: JSON.stringify(['AutoML', 'Bayesian Opt', 'GNN', 'PyTorch']),
        sort_order: 2,
      },
      {
        title: 'METIS-Graph: Adaptive Multi-Source RAG with Graph-Aware Autoscaling',
        venue: 'Target: International Conference on Supercomputing (ICS) 2026',
        status: 'ONGOING',
        tags: JSON.stringify(['RAG', 'Knowledge Graph', 'Autoscaling', 'LLMs']),
        sort_order: 3,
      },
    ].forEach(p => insertPub.run(p));
  }

  console.log('✅ Database initialized');
  return store;
}

module.exports = { getDB, initDB };

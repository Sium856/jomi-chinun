import express, { Request, Response } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

import { db, initDb } from './src/db.js';
import { SqliteSessionStore } from './src/session-store.js';
import { requireAuth, requireAdmin, AuthenticatedRequest, generateToken, revokeToken } from './src/auth.js';
import {
  toEnDigits,
  norm,
  findLand,
  findPlot,
  evaluateLandCheck,
  evaluateSetbackGuidance,
  PlotRecord,
  SetbackRuleRecord,
  LandRecord
} from './src/rules.js';

// Initialize SQLite database and seed initial demo data
initDb();

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const DEMO_MODE = process.env.DEMO_MODE !== 'false';

// Trust reverse proxy for Cloud Run and iframe environments
app.set('trust proxy', 1);

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows inline scripts/styles needed for vanilla client
    crossOriginEmbedderPolicy: false
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration
app.use(
  session({
    store: new SqliteSessionStore(),
    secret: process.env.SESSION_SECRET || 'jomi-chinun-secret-key-358912',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: IS_PROD ? 'none' : 'lax',
      secure: IS_PROD,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  })
);

// Rate Limiting for Auth Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { ok: false, error: 'Too many requests. Please try again later.' }
});

// Helper for formatted report date
function getReportDate(d?: Date): string {
  const dateObj = d || new Date();
  try {
    return dateObj.toLocaleString('bn-BD');
  } catch {
    return dateObj.toISOString();
  }
}

// ============================================================================
// AUTHENTICATION ROUTES (/api/auth/*)
// ============================================================================

// POST /api/auth/register
app.post('/api/auth/register', authLimiter, (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  const trimmedName = String(name || '').trim();
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const rawPassword = String(password || '');

  if (!trimmedName || !trimmedEmail || rawPassword.length < 6) {
    return res.status(400).json({
      ok: false,
      error: 'Enter name, email and a password of 6+ characters'
    });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(trimmedEmail);
  if (existing) {
    return res.status(400).json({
      ok: false,
      error: 'This email is already used'
    });
  }

  const passwordHash = bcrypt.hashSync(rawPassword, 10);
  const insertResult = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(trimmedName, trimmedEmail, passwordHash, 'user');

  const newUserId = Number(insertResult.lastInsertRowid);
  req.session.userId = newUserId;
  const token = generateToken(newUserId);

  return res.json({
    ok: true,
    token,
    user: {
      id: newUserId,
      name: trimmedName,
      email: trimmedEmail,
      role: 'user'
    }
  });
});

// POST /api/auth/login
app.post('/api/auth/login', authLimiter, (req: Request, res: Response) => {
  const { email, password } = req.body;
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const rawPassword = String(password || '');

  if (!trimmedEmail || !rawPassword) {
    return res.status(401).json({
      ok: false,
      error: 'Wrong email or password'
    });
  }

  const user = db.prepare('SELECT id, name, email, password_hash, role FROM users WHERE email = ?').get(
    trimmedEmail
  ) as { id: number; name: string; email: string; password_hash: string; role: 'user' | 'admin' } | undefined;

  if (!user || !bcrypt.compareSync(rawPassword, user.password_hash)) {
    return res.status(401).json({
      ok: false,
      error: 'Wrong email or password'
    });
  }

  req.session.userId = user.id;
  const token = generateToken(user.id);

  return res.json({
    ok: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    revokeToken(authHeader.slice(7).trim());
  }
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// GET /api/auth/me
app.get('/api/auth/me', (req: AuthenticatedRequest, res: Response) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }

  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.session.userId) as
    | { id: number; name: string; email: string; role: 'user' | 'admin' }
    | undefined;

  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }

  return res.json({ ok: true, user });
});

// POST /api/auth/forgot
app.post('/api/auth/forgot', authLimiter, (req: Request, res: Response) => {
  const { email } = req.body;
  const trimmedEmail = String(email || '').trim().toLowerCase();

  if (!trimmedEmail) {
    return res.status(400).json({ ok: false, error: 'Enter your email' });
  }

  const user = db.prepare('SELECT id, role FROM users WHERE email = ?').get(trimmedEmail) as
    | { id: number; role: string }
    | undefined;

  if (user && user.role === 'admin') {
    return res.status(400).json({
      ok: false,
      error: 'Admin password cannot be reset here.'
    });
  }

  // Generate 6-digit verification code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = bcrypt.hashSync(code, 10);
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Delete previous reset requests for this email
  db.prepare('DELETE FROM password_resets WHERE email = ?').run(trimmedEmail);
  db.prepare('INSERT INTO password_resets (email, code_hash, attempts, expires_at) VALUES (?, ?, 0, ?)').run(
    trimmedEmail,
    codeHash,
    expiresAt
  );

  if (DEMO_MODE) {
    return res.json({
      ok: true,
      code,
      message: 'Demo reset code generated.'
    });
  }

  // In production with DEMO_MODE=false:
  // TODO: Send code via email service (e.g. Nodemailer, SendGrid, SES)
  return res.json({
    ok: true,
    message: 'If this email is registered, a reset code has been sent.'
  });
});

// POST /api/auth/reset
app.post('/api/auth/reset', authLimiter, (req: Request, res: Response) => {
  const { email, code, password } = req.body;
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const trimmedCode = String(code || '').trim();
  const rawPassword = String(password || '');

  if (!trimmedEmail || !trimmedCode || rawPassword.length < 6) {
    return res.status(400).json({
      ok: false,
      error: 'Password must be at least 6 characters.'
    });
  }

  const resetReq = db.prepare(
    'SELECT id, code_hash, attempts, expires_at FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1'
  ).get(trimmedEmail) as
    | { id: number; code_hash: string; attempts: number; expires_at: number }
    | undefined;

  if (!resetReq) {
    return res.status(400).json({
      ok: false,
      error: 'Wrong code or email not registered.'
    });
  }

  if (Date.now() > resetReq.expires_at || resetReq.attempts >= 5) {
    db.prepare('DELETE FROM password_resets WHERE id = ?').run(resetReq.id);
    return res.status(400).json({
      ok: false,
      error: 'Code has expired or too many failed attempts. Request a new code.'
    });
  }

  const isValidCode = bcrypt.compareSync(trimmedCode, resetReq.code_hash);
  if (!isValidCode) {
    db.prepare('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?').run(resetReq.id);
    return res.status(400).json({
      ok: false,
      error: 'Wrong code or email not registered.'
    });
  }

  // Code is valid - update user's password
  const newHash = bcrypt.hashSync(rawPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(newHash, trimmedEmail);
  db.prepare('DELETE FROM password_resets WHERE email = ?').run(trimmedEmail);

  return res.json({
    ok: true,
    message: 'Password changed. Please login.'
  });
});

// ============================================================================
// CHECK LAND 5-RULE ENGINE (/api/check)
// ============================================================================

app.post('/api/check', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { k, d, s } = req.body;
  const khatian = toEnDigits(k);
  const dag = toEnDigits(d);
  const seller = String(s || '').trim();

  if (!khatian || !dag || !seller) {
    return res.status(400).json({ ok: false, error: 'Fill all three fields' });
  }

  if (!/^\d+$/.test(khatian) || !/^\d+$/.test(dag)) {
    return res.status(400).json({ ok: false, error: 'Khatian and Dag must be numbers only' });
  }

  const land = findLand(khatian, dag);
  const evalResult = evaluateLandCheck(land, khatian, dag, seller);
  const dateStr = getReportDate();

  const insertReport = db.prepare(`
    INSERT INTO reports (user_id, user_name, k, d, seller, score, status, items_json, land_snapshot_json, plot_snapshot_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    req.user!.id,
    req.user!.name,
    khatian,
    dag,
    seller,
    evalResult.score,
    evalResult.status,
    JSON.stringify(evalResult.items),
    JSON.stringify(evalResult.f),
    JSON.stringify(evalResult.px)
  );

  const reportId = Number(insertReport.lastInsertRowid);

  const reportResponse = {
    id: reportId,
    uid: req.user!.id,
    un: req.user!.name,
    k: khatian,
    d: dag,
    s: seller,
    date: dateStr,
    f: evalResult.f,
    items: evalResult.items,
    score: evalResult.score,
    status: evalResult.status,
    px: evalResult.px
  };

  return res.json({ ok: true, report: reportResponse });
});

// ============================================================================
// REPORTS HISTORY (/api/reports)
// ============================================================================

// Helper to format DB report row
function formatReportRow(r: any) {
  let f = null;
  let items: [number, number][] = [];
  let px = null;
  try {
    f = r.land_snapshot_json ? JSON.parse(r.land_snapshot_json) : null;
  } catch {}
  try {
    items = r.items_json ? JSON.parse(r.items_json) : [];
  } catch {}
  try {
    px = r.plot_snapshot_json ? JSON.parse(r.plot_snapshot_json) : null;
  } catch {}

  return {
    id: r.id,
    uid: r.user_id,
    un: r.user_name,
    k: r.k,
    d: r.d,
    s: r.seller,
    date: getReportDate(new Date(r.created_at || Date.now())),
    score: r.score,
    status: r.status,
    items,
    f,
    px
  };
}

// GET /api/reports (User's own reports)
app.get('/api/reports', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM reports WHERE user_id = ? ORDER BY id DESC').all(req.user!.id) as any[];
  const reports = rows.map(formatReportRow);
  return res.json({ ok: true, reports });
});

// GET /api/reports/:id (User can view their own; admin can view any)
app.get('/api/reports/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any;

  if (!row) {
    return res.status(404).json({ ok: false, error: 'Report not found' });
  }

  if (row.user_id !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Forbidden: You cannot access another user’s report' });
  }

  return res.json({ ok: true, report: formatReportRow(row) });
});

// ============================================================================
// PLOT SEARCH & SETBACK GUIDANCE (/api/plots/* and /api/setback)
// ============================================================================

// GET /api/plots/options (division/district/upazila names for dropdowns)
app.get('/api/plots/options', requireAuth, (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT dv, ds, up FROM plots').all() as { dv: string; ds: string; up: string }[];
  const U = (arr: string[]) => [...new Set(arr)];
  return res.json({
    ok: true,
    divisions: U(rows.map((r) => r.dv)),
    districts: U(rows.map((r) => r.ds)),
    upazilas: U(rows.map((r) => r.up))
  });
});

// GET /api/plots/search (returns only matching plots, never the full list without query)
app.get('/api/plots/search', requireAuth, (req: Request, res: Response) => {
  const { dv, ds, up, mz, sv, k, d } = req.query;

  // Validation: must supply mouza name OR both khatian and dag
  if (!mz && !(k && d)) {
    return res.status(400).json({
      ok: false,
      error: 'Enter a mouza name, or both Khatian and Dag number.'
    });
  }

  const kEn = k ? toEnDigits(String(k)) : '';
  const dEn = d ? toEnDigits(String(d)) : '';

  if (k && !/^\d+$/.test(kEn)) {
    return res.status(400).json({ ok: false, error: 'Khatian must be numbers only.' });
  }
  if (d && !/^\d+$/.test(dEn)) {
    return res.status(400).json({ ok: false, error: 'Dag must be numbers only.' });
  }

  // Build parameterized query
  let sql = 'SELECT * FROM plots WHERE 1=1';
  const params: any[] = [];

  if (dv) {
    sql += ' AND dv = ?';
    params.push(String(dv));
  }
  if (ds) {
    sql += ' AND ds = ?';
    params.push(String(ds));
  }
  if (up) {
    sql += ' AND up = ?';
    params.push(String(up));
  }
  if (sv) {
    sql += ' AND sv = ?';
    params.push(String(sv));
  }
  if (kEn) {
    sql += ' AND k = ?';
    params.push(kEn);
  }
  if (dEn) {
    sql += ' AND d = ?';
    params.push(dEn);
  }

  const rows = db.prepare(sql).all(...params) as unknown as PlotRecord[];

  // Filter mouza substring client/server side if requested
  const mzSearch = mz ? norm(String(mz)) : '';
  const filtered = rows.filter((p) => {
    if (!mzSearch) return true;
    return norm(p.mz).includes(mzSearch);
  });

  // Map to format client expects
  const list = filtered.map((p) => ({
    id: p.id,
    dv: p.dv,
    ds: p.ds,
    up: p.up,
    mz: p.mz,
    sv: p.sv,
    k: p.k,
    d: p.d,
    area: p.area,
    unit: p.unit,
    map: p.map,
    src: p.data_status,
    road: p.road_type
      ? {
          type: p.road_type,
          width: p.road_width,
          auth: p.road_auth,
          st: p.road_st
        }
      : null,
    guidance: evaluateSetbackGuidance(p)
  }));

  return res.json({ ok: true, list });
});

// GET /api/setback (plot + road + guidance or Verification Required)
app.get('/api/setback', requireAuth, (req: Request, res: Response) => {
  const { k, d } = req.query;
  const kEn = toEnDigits(String(k || ''));
  const dEn = toEnDigits(String(d || ''));

  if (!kEn || !dEn) {
    return res.status(400).json({ ok: false, error: 'Khatian and Dag are required' });
  }

  const plot = findPlot(kEn, dEn);
  if (!plot) {
    return res.status(404).json({ ok: false, error: 'Plot not found in records' });
  }

  const guidance = evaluateSetbackGuidance(plot);

  return res.json({
    ok: true,
    plot: {
      id: plot.id,
      dv: plot.dv,
      ds: plot.ds,
      up: plot.up,
      mz: plot.mz,
      sv: plot.sv,
      k: plot.k,
      d: plot.d,
      area: plot.area,
      unit: plot.unit,
      map: plot.map,
      road: plot.road_type
        ? {
            type: plot.road_type,
            width: plot.road_width,
            auth: plot.road_auth,
            st: plot.road_st
          }
        : null
    },
    guidance
  });
});

// ============================================================================
// ADMIN API ROUTES (/api/admin/*)
// Protected by requireAdmin middleware
// ============================================================================

// GET /api/admin/stats
app.get('/api/admin/stats', requireAdmin, (_req: Request, res: Response) => {
  const usersCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'").get() as any).count;
  const landsCount = (db.prepare('SELECT COUNT(*) as count FROM lands').get() as any).count;
  const reportsCount = (db.prepare('SELECT COUNT(*) as count FROM reports').get() as any).count;
  const riskCount = (db.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'Risk Found'").get() as any)
    .count;
  const plotsCount = (db.prepare('SELECT COUNT(*) as count FROM plots').get() as any).count;
  const rulesCount = (db.prepare('SELECT COUNT(*) as count FROM setback_rules').get() as any).count;

  const statusRows = db.prepare('SELECT status, COUNT(*) as cnt FROM reports GROUP BY status').all() as {
    status: string;
    cnt: number;
  }[];
  const statusCounts: Record<string, number> = {
    Pass: 0,
    Warning: 0,
    'Risk Found': 0,
    'Not Verified': 0
  };
  for (const sr of statusRows) {
    statusCounts[sr.status] = sr.cnt;
  }

  return res.json({
    ok: true,
    stats: {
      usersCount,
      landsCount,
      reportsCount,
      riskCount,
      plotsCount,
      rulesCount,
      statusCounts
    }
  });
});

// GET /api/admin/reports (All users' reports)
app.get('/api/admin/reports', requireAdmin, (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM reports ORDER BY id DESC').all() as any[];
  const reports = rows.map(formatReportRow);
  return res.json({ ok: true, reports });
});

// --- Land Records CRUD ---
app.get('/api/admin/lands', requireAdmin, (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM lands ORDER BY id ASC').all();
  return res.json({ ok: true, lands: rows });
});

app.post('/api/admin/lands', requireAdmin, (req: Request, res: Response) => {
  const { k, d, m, me, o, oe, n, x, c, a } = req.body;
  const kEn = toEnDigits(k);
  const dEn = toEnDigits(d);

  if (!kEn || !dEn || !o || !oe) {
    return res.status(400).json({
      ok: false,
      error: 'Khatian, dag and owner name (both languages) are required'
    });
  }

  const mouzaBn = m || me;
  const mouzaEn = me || m;

  const result = db.prepare(`
    INSERT INTO lands (k, d, m, me, o, oe, n, x, c, a, data_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo')
  `).run(kEn, dEn, mouzaBn, mouzaEn, o, oe, n ? 1 : 0, x ? 1 : 0, c ? 1 : 0, a ? 1 : 0);

  return res.json({ ok: true, id: Number(result.lastInsertRowid) });
});

app.put('/api/admin/lands/:id', requireAdmin, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { k, d, m, me, o, oe, n, x, c, a } = req.body;
  const kEn = toEnDigits(k);
  const dEn = toEnDigits(d);

  if (!kEn || !dEn || !o || !oe) {
    return res.status(400).json({
      ok: false,
      error: 'Khatian, dag and owner name (both languages) are required'
    });
  }

  db.prepare(`
    UPDATE lands
    SET k = ?, d = ?, m = ?, me = ?, o = ?, oe = ?, n = ?, x = ?, c = ?, a = ?
    WHERE id = ?
  `).run(kEn, dEn, m || me, me || m, o, oe, n ? 1 : 0, x ? 1 : 0, c ? 1 : 0, a ? 1 : 0, id);

  return res.json({ ok: true });
});

app.delete('/api/admin/lands/:id', requireAdmin, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM lands WHERE id = ?').run(id);
  return res.json({ ok: true });
});

// --- Plots CRUD ---
app.get('/api/admin/plots', requireAdmin, (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM plots ORDER BY id ASC').all() as unknown as PlotRecord[];
  const plots = rows.map((p) => ({
    id: p.id,
    dv: p.dv,
    ds: p.ds,
    up: p.up,
    mz: p.mz,
    sv: p.sv,
    k: p.k,
    d: p.d,
    area: p.area,
    unit: p.unit,
    map: p.map,
    src: p.data_status,
    road: p.road_type
      ? {
          type: p.road_type,
          width: p.road_width,
          auth: p.road_auth,
          st: p.road_st
        }
      : null
  }));
  return res.json({ ok: true, plots });
});

app.post('/api/admin/plots', requireAdmin, (req: Request, res: Response) => {
  const { dv, ds, up, mz, sv, k, d, area, unit, map, road } = req.body;
  const kEn = toEnDigits(k);
  const dEn = toEnDigits(d);
  const parsedArea = parseFloat(area);

  if (!dv || !ds || !up || !mz || !/^\d+$/.test(kEn) || !/^\d+$/.test(dEn) || !(parsedArea > 0)) {
    return res.status(400).json({
      ok: false,
      error: 'Fill location, numeric khatian and dag, a valid area, and a valid road width if given.'
    });
  }

  const rType = road && road.type ? String(road.type).trim() : null;
  const rWidth = road && road.width !== null && road.width !== undefined && road.width !== ''
    ? parseFloat(road.width)
    : null;
  const rAuth = road && road.auth ? String(road.auth).trim() : null;
  const rSt = road && road.st ? String(road.st) : 'demo';

  if (rWidth !== null && !(rWidth >= 0)) {
    return res.status(400).json({ ok: false, error: 'Road width must be a valid positive number.' });
  }

  const result = db.prepare(`
    INSERT INTO plots (dv, ds, up, mz, sv, k, d, area, unit, map, road_type, road_width, road_auth, road_st, data_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo')
  `).run(dv, ds, up, mz, sv || 'RS', kEn, dEn, parsedArea, unit || 'dec', map || null, rType, rWidth, rAuth, rSt);

  return res.json({ ok: true, id: Number(result.lastInsertRowid) });
});

app.put('/api/admin/plots/:id', requireAdmin, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { dv, ds, up, mz, sv, k, d, area, unit, map, road } = req.body;
  const kEn = toEnDigits(k);
  const dEn = toEnDigits(d);
  const parsedArea = parseFloat(area);

  if (!dv || !ds || !up || !mz || !/^\d+$/.test(kEn) || !/^\d+$/.test(dEn) || !(parsedArea > 0)) {
    return res.status(400).json({
      ok: false,
      error: 'Fill location, numeric khatian and dag, a valid area, and a valid road width if given.'
    });
  }

  const rType = road && road.type ? String(road.type).trim() : null;
  const rWidth = road && road.width !== null && road.width !== undefined && road.width !== ''
    ? parseFloat(road.width)
    : null;
  const rAuth = road && road.auth ? String(road.auth).trim() : null;
  const rSt = road && road.st ? String(road.st) : 'demo';

  if (rWidth !== null && !(rWidth >= 0)) {
    return res.status(400).json({ ok: false, error: 'Road width must be a valid positive number.' });
  }

  db.prepare(`
    UPDATE plots
    SET dv = ?, ds = ?, up = ?, mz = ?, sv = ?, k = ?, d = ?, area = ?, unit = ?, map = ?,
        road_type = ?, road_width = ?, road_auth = ?, road_st = ?
    WHERE id = ?
  `).run(dv, ds, up, mz, sv || 'RS', kEn, dEn, parsedArea, unit || 'dec', map || null, rType, rWidth, rAuth, rSt, id);

  return res.json({ ok: true });
});

app.delete('/api/admin/plots/:id', requireAdmin, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM plots WHERE id = ?').run(id);
  return res.json({ ok: true });
});

app.get('/api/admin/rules', requireAdmin, (_req: Request, res: Response) => {
  const rawRules = db.prepare('SELECT * FROM setback_rules ORDER BY id ASC').all() as any[];
  const rules = rawRules.map((r) => ({
    id: r.id,
    auth: r.auth || (r.authority_en ? `${r.authority_en}|${r.authority_bn}` : ''),
    authority_en: r.authority_en,
    authority_bn: r.authority_bn,
    min: r.min_width != null ? r.min_width : r.min_width_ft,
    min_width: r.min_width != null ? r.min_width : r.min_width_ft,
    max: r.max_width != null ? r.max_width : r.max_width_ft,
    max_width: r.max_width != null ? r.max_width : r.max_width_ft,
    f: r.front_ft,
    front_ft: r.front_ft,
    s: r.side_ft,
    side_ft: r.side_ft,
    b: r.rear_ft,
    rear_ft: r.rear_ft,
    st: r.data_status || 'demo',
    data_status: r.data_status || 'demo'
  }));
  return res.json({ ok: true, rules });
});

app.post('/api/admin/rules', requireAdmin, (req: Request, res: Response) => {
  const { auth, min, max, f, s, b } = req.body;
  const minW = parseFloat(min);
  const maxW = parseFloat(max);
  const front = parseFloat(f);
  const side = parseFloat(s);
  const rear = parseFloat(b);

  if ([minW, maxW, front, side, rear].some((v) => isNaN(v) || v < 0) || maxW <= minW || !auth) {
    return res.status(400).json({
      ok: false,
      error: 'Enter valid numbers; max must be greater than min.'
    });
  }

  const result = db.prepare(`
    INSERT INTO setback_rules (auth, min_width, max_width, front_ft, side_ft, rear_ft, data_status)
    VALUES (?, ?, ?, ?, ?, ?, 'demo')
  `).run(String(auth).trim(), minW, maxW, front, side, rear);

  return res.json({ ok: true, id: Number(result.lastInsertRowid) });
});

app.put('/api/admin/rules/:id', requireAdmin, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { auth, min, max, f, s, b } = req.body;
  const minW = parseFloat(min);
  const maxW = parseFloat(max);
  const front = parseFloat(f);
  const side = parseFloat(s);
  const rear = parseFloat(b);

  if ([minW, maxW, front, side, rear].some((v) => isNaN(v) || v < 0) || maxW <= minW || !auth) {
    return res.status(400).json({
      ok: false,
      error: 'Enter valid numbers; max must be greater than min.'
    });
  }

  db.prepare(`
    UPDATE setback_rules
    SET auth = ?, min_width = ?, max_width = ?, front_ft = ?, side_ft = ?, rear_ft = ?
    WHERE id = ?
  `).run(String(auth).trim(), minW, maxW, front, side, rear, id);

  return res.json({ ok: true });
});

app.delete('/api/admin/rules/:id', requireAdmin, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM setback_rules WHERE id = ?').run(id);
  return res.json({ ok: true });
});

// ============================================================================
// STATIC ASSETS AND CLIENT SERVING (/public)
// ============================================================================

const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));

// Fallback to public/index.html for SPA page routes
app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'API route not found' });
  }
  return res.sendFile(path.join(publicDir, 'index.html'));
});

// Start Express server
app.listen(PORT, () => {
  console.log(`🏡 জমি চিনুন server running at http://localhost:${PORT}`);
});

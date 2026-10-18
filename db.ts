import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const dbPath = process.env.DATABASE_PATH || './data/jomi_chinun.db';
const resolvedPath = path.resolve(dbPath);
const dir = path.dirname(resolvedPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new DatabaseSync(resolvedPath);

// Initialize schema and seed data
export function initDb() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      k TEXT NOT NULL,
      d TEXT NOT NULL,
      m TEXT NOT NULL,
      me TEXT NOT NULL,
      o TEXT NOT NULL,
      oe TEXT NOT NULL,
      n INTEGER NOT NULL DEFAULT 0,
      x INTEGER NOT NULL DEFAULT 0,
      c INTEGER NOT NULL DEFAULT 0,
      a INTEGER NOT NULL DEFAULT 0,
      data_status TEXT NOT NULL DEFAULT 'demo'
    );

    CREATE TABLE IF NOT EXISTS plots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dv TEXT NOT NULL,
      ds TEXT NOT NULL,
      up TEXT NOT NULL,
      mz TEXT NOT NULL,
      sv TEXT NOT NULL,
      k TEXT NOT NULL,
      d TEXT NOT NULL,
      area REAL NOT NULL,
      unit TEXT NOT NULL,
      map TEXT,
      road_type TEXT,
      road_width REAL,
      road_auth TEXT,
      road_st TEXT,
      data_status TEXT NOT NULL DEFAULT 'demo'
    );

    CREATE TABLE IF NOT EXISTS setback_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auth TEXT,
      authority_en TEXT,
      authority_bn TEXT,
      min_width REAL,
      max_width REAL,
      min_width_ft REAL,
      max_width_ft REAL,
      front_ft REAL NOT NULL,
      side_ft REAL NOT NULL,
      rear_ft REAL NOT NULL,
      data_status TEXT NOT NULL DEFAULT 'demo'
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      k TEXT NOT NULL,
      d TEXT NOT NULL,
      seller TEXT NOT NULL,
      score INTEGER,
      status TEXT NOT NULL,
      items_json TEXT NOT NULL,
      land_snapshot_json TEXT,
      plot_snapshot_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired_at INTEGER NOT NULL
    );
  `);

  // Execute database/land_features_seed.sql if it exists
  const seedSqlFile = path.resolve('./land_features_seed.sql');
  if (fs.existsSync(seedSqlFile)) {
    try {
      const sqlContent = fs.readFileSync(seedSqlFile, 'utf-8');
      db.exec(sqlContent);
      console.log('✅ Executed database/land_features_seed.sql successfully');
    } catch (err) {
      console.error('Error executing land_features_seed.sql:', err);
    }
  }

  // Synchronize land_plots into plots table
  try {
    const hasLandPlots = db.prepare(`SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name='land_plots'`).get() as { c: number };
    if (hasLandPlots && hasLandPlots.c > 0) {
      db.exec(`
        DELETE FROM plots;
        INSERT INTO plots (id, dv, ds, up, mz, sv, k, d, area, unit, map, road_type, road_width, road_auth, road_st, data_status)
        SELECT
          id,
          (division_en || '|' || division_bn) AS dv,
          (district_en || '|' || district_bn) AS ds,
          (upazila_en || '|' || upazila_bn) AS up,
          (mouza_en || '|' || mouza_bn) AS mz,
          survey_type AS sv,
          khatian_no AS k,
          dag_no AS d,
          area,
          area_unit AS unit,
          map_ref AS map,
          CASE WHEN road_type_en IS NOT NULL THEN (road_type_en || '|' || road_type_bn) ELSE NULL END AS road_type,
          road_width_ft AS road_width,
          CASE WHEN road_authority_en IS NOT NULL THEN (road_authority_en || '|' || road_authority_bn) ELSE NULL END AS road_auth,
          road_info_status AS road_st,
          data_status
        FROM land_plots;
      `);
      console.log('✅ Synchronized 20 plots from land_plots');
    }
  } catch (err) {
    console.error('Error synchronizing land_plots to plots:', err);
  }

  // Ensure setback_rules has auth, min_width, max_width populated
  try {
    db.exec(`
      UPDATE setback_rules
      SET
        auth = CASE WHEN auth IS NULL AND authority_en IS NOT NULL THEN (authority_en || '|' || authority_bn) ELSE auth END,
        min_width = CASE WHEN min_width IS NULL AND min_width_ft IS NOT NULL THEN min_width_ft ELSE min_width END,
        max_width = CASE WHEN max_width IS NULL AND max_width_ft IS NOT NULL THEN max_width_ft ELSE max_width END;
    `);
  } catch (err) {
    console.error('Error normalizing setback_rules columns:', err);
  }

  // Seed Users idempotently
  const adminRow = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@demo.com');
  if (!adminRow) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
      'Admin',
      'admin@demo.com',
      adminHash,
      'admin'
    );
  }

  const demoUserRow = db.prepare('SELECT id FROM users WHERE email = ?').get('252-15-856@diu.edu.bd');
  if (!demoUserRow) {
    const userHash = bcrypt.hashSync('land123', 10);
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
      'Demo User',
      '252-15-856@diu.edu.bd',
      userHash,
      'user'
    );
  }

  // Seed 13 Land Records idempotently
  const landCountRow = db.prepare('SELECT COUNT(*) as cnt FROM lands').get() as { cnt: number };
  if (!landCountRow || landCountRow.cnt === 0) {
    const SEED_LANDS = [
      ["101", "12", "সাভার", "Savar", "রহিম উদ্দিন", "Rahim Uddin", 1, 0, 0, 0],
      ["102", "15", "সাভার", "Savar", "করিম মিয়া", "Karim Mia", 0, 0, 0, 0],
      ["103", "20", "আশুলিয়া", "Ashulia", "বাংলাদেশ সরকার", "Government of Bangladesh", 1, 1, 0, 0],
      ["104", "8", "আশুলিয়া", "Ashulia", "সালমা বেগম", "Salma Begum", 1, 0, 1, 0],
      ["105", "30", "ধামরাই", "Dhamrai", "আব্দুল হালিম", "Abdul Halim", 1, 0, 0, 1],
      ["106", "5", "ধামরাই", "Dhamrai", "জাহাঙ্গীর আলম", "Jahangir Alam", 1, 0, 0, 0],
      ["107", "41", "গাজীপুর সদর", "Gazipur Sadar", "নূর জাহান", "Nur Jahan", 1, 0, 0, 0],
      ["108", "22", "গাজীপুর সদর", "Gazipur Sadar", "শফিকুল ইসলাম", "Shafiqul Islam", 0, 0, 1, 0],
      ["109", "9", "কেরানীগঞ্জ", "Keraniganj", "মোহাম্মদ আলী", "Mohammad Ali", 1, 0, 0, 1],
      ["110", "17", "কেরানীগঞ্জ", "Keraniganj", "রফিকুল হক", "Rafiqul Haque", 1, 0, 0, 0],
      ["111", "33", "নারায়ণগঞ্জ সদর", "Narayanganj Sadar", "ফরিদা খাতুন", "Farida Khatun", 1, 0, 0, 0],
      ["112", "27", "নারায়ণগঞ্জ সদর", "Narayanganj Sadar", "ইব্রাহিম খলিল", "Ibrahim Khalil", 0, 0, 1, 1],
      ["113", "4", "ভবানীপুর", "Bhabanipur", "নাসরিন আক্তার", "Nasrin Akter", 0, 0, 0, 0]
    ];
    const insertLand = db.prepare(`
      INSERT INTO lands (k, d, m, me, o, oe, n, x, c, a, data_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo')
    `);
    for (const r of SEED_LANDS) {
      insertLand.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9]);
    }
  }
}

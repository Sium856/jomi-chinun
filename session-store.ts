import session from 'express-session';
import { db } from './db.js';

export class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    // Periodically clean up expired sessions every 15 minutes
    const timer = setInterval(() => {
      try {
        const now = Date.now();
        db.prepare('DELETE FROM sessions WHERE expired_at <= ?').run(now);
      } catch (err) {
        console.error('Session cleanup error:', err);
      }
    }, 15 * 60 * 1000);
    timer.unref();
  }

  get = (sid: string, callback: (err?: any, session?: session.SessionData | null) => void) => {
    try {
      const now = Date.now();
      const row = db.prepare('SELECT sess, expired_at FROM sessions WHERE sid = ?').get(sid) as
        | { sess: string; expired_at: number }
        | undefined;
      if (!row) {
        return callback(null, null);
      }
      if (row.expired_at <= now) {
        this.destroy(sid, () => {});
        return callback(null, null);
      }
      const data = JSON.parse(row.sess);
      callback(null, data);
    } catch (err) {
      callback(err);
    }
  };

  set = (sid: string, sessionData: session.SessionData, callback?: (err?: any) => void) => {
    try {
      const maxAge = sessionData.cookie?.maxAge || 24 * 60 * 60 * 1000;
      const expired_at = Date.now() + maxAge;
      const sess = JSON.stringify(sessionData);
      db.prepare(`
        INSERT INTO sessions (sid, sess, expired_at)
        VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired_at = excluded.expired_at
      `).run(sid, sess, expired_at);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  };

  destroy = (sid: string, callback?: (err?: any) => void) => {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  };

  touch = (sid: string, sessionData: session.SessionData, callback?: (err?: any) => void) => {
    try {
      const maxAge = sessionData.cookie?.maxAge || 24 * 60 * 60 * 1000;
      const expired_at = Date.now() + maxAge;
      db.prepare('UPDATE sessions SET expired_at = ? WHERE sid = ?').run(expired_at, sid);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  };
}

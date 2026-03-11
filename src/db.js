/**
 * db.js n0003 관리자 대시보드용 DB 초기화
 * n0005/src/db.js 기반 (관리자+블로그 테이블만)
 */

import { hashPw } from './auth.js';

let _init = false;
export async function autoInit(DB) {
  if (_init) return;
  _init = true;

  try {
    /* ── 1. admins ── */
    await DB.prepare(`CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      totp_secret   TEXT, totp_enabled INTEGER DEFAULT 0,
      role          TEXT DEFAULT 'admin',
      is_active     INTEGER DEFAULT 1,
      last_login    TEXT,
      reset_token   TEXT, reset_token_expires TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    )`).run();

    /* ── 2. sessions ── */
    await DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL,
      user_type  TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`).run();

    /* ── 3. settings ── */
    await DB.prepare(`CREATE TABLE IF NOT EXISTS settings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      key_name   TEXT UNIQUE NOT NULL,
      key_value  TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    )`).run();

    /* ── 4. blog_posts (n0005 프로덕션과 동일) ── */
    await DB.prepare(`CREATE TABLE IF NOT EXISTS blog_posts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      title           TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
      excerpt         TEXT, content TEXT,
      featured_image  TEXT, body_image TEXT,
      category        TEXT, tags TEXT,
      seo_title       TEXT, seo_description TEXT,
      seo_score       INTEGER DEFAULT 0, ai_review TEXT,
      status          TEXT DEFAULT 'draft',
      scheduled_at    TEXT,
      author_id       INTEGER, published_at TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    )`).run();

    /* ── 5. blog_sources (n0005 프로덕션과 동일 소스 관리) ── */
    await DB.prepare(`CREATE TABLE IF NOT EXISTS blog_sources (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type       TEXT    NOT NULL,
      url        TEXT,
      title      TEXT,
      content    TEXT,
      word_count INTEGER DEFAULT 0,
      category   TEXT,
      r2_key     TEXT,
      status     TEXT    DEFAULT 'active',
      error_msg  TEXT,
      meta       TEXT,
      priority   TEXT    DEFAULT 'normal',
      tags       TEXT    DEFAULT '',
      notes      TEXT    DEFAULT '',
      created_at TEXT    DEFAULT (datetime('now')),
      updated_at TEXT    DEFAULT (datetime('now'))
    )`).run();

    /* ── 6. blog_gen_log (n0005 프로덕션과 동일 생성 이력) ── */
    await DB.prepare(`CREATE TABLE IF NOT EXISTS blog_gen_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id     INTEGER,
      source_ids  TEXT,
      category    TEXT,
      focus_kw    TEXT,
      status      TEXT    DEFAULT 'running',
      seo_score   INTEGER,
      error_msg   TEXT,
      duration_ms INTEGER,
      created_at  TEXT    DEFAULT (datetime('now'))
    )`).run();

    /* ── 7. blog_post_translations ── */
    await DB.prepare(`CREATE TABLE IF NOT EXISTS blog_post_translations (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id         INTEGER NOT NULL,
      lang            TEXT NOT NULL,
      title           TEXT, slug TEXT, excerpt TEXT, content TEXT,
      seo_title       TEXT, seo_description TEXT,
      status          TEXT DEFAULT 'published',
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(post_id, lang)
    )`).run();

    /* ── 기본 설정 ── */
    const defaultSettings = [
      ['header_logo_url',   ''],
      ['footer_logo_url',   ''],
      ['admin_logo_url',    ''],
      ['site_name',         'Noteracker'],
      ['openai_api_key',    ''],
      ['gemini_api_key',    ''],
      ['r2_public_url',     'https://pub-c549a01ee99b46c388128ba4507e19fc.r2.dev'],
      ['unsplash_access_key', ''],
      ['youtube_api_key',   ''],
      ['blog_gen_rules',    ''],
      ['blog_writing_style', ''],
      ['blog_writing_tone',  ''],
    ];
    for (const [k, v] of defaultSettings) {
      await DB.prepare('INSERT OR IGNORE INTO settings(key_name,key_value) VALUES(?,?)').bind(k, v).run();
    }

    /* ── 관리자 계정 (없을 때만) ── */
    const adminExists = await DB.prepare(
      "SELECT id FROM admins WHERE username='webilogan'"
    ).first();
    if (!adminExists) {
      const hash = await hashPw('@Herosws413105o5');
      await DB.prepare(
        "INSERT INTO admins(username,email,password_hash,role,is_active) VALUES('webilogan','webilogan@noteracker.com',?,'superadmin',1)"
      ).bind(hash).run();
    }

  } catch (e) {
    console.error('autoInit error:', e.message);
  }
}

/* ── 세션 정리 ── */
let _cleanupCounter = 0;
export async function maybeCleanupSessions(DB) {
  _cleanupCounter++;
  if (_cleanupCounter % 100 !== 0) return;
  try {
    await DB.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  } catch (e) {
    console.error('session cleanup error:', e.message);
  }
}

/* ── 설정 조회 ── */
export async function getSetting(DB, key) {
  try {
    const row = await DB.prepare('SELECT key_value FROM settings WHERE key_name=?').bind(key).first();
    return row?.key_value || '';
  } catch { return ''; }
}

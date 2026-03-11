/**
 * admin.js — n0003 관리자 API
 * n0005/src/admin.js 기반 (blogRouter + settings + admins + logo만)
 */

import { getSetting } from './db.js';
import { hashPw } from './auth.js';

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};
const ok  = (d, s=200)  => new Response(JSON.stringify(d), { status:s, headers:{'Content-Type':'application/json',...CORS} });
const bad = (msg, s=400) => ok({ error: msg }, s);

/* =========================================================
   ADMIN ROUTES
   ========================================================= */
export async function adminRoute(request, url, env, admin) {
  const p = url.pathname;
  const m = request.method;

  /* Overview — 블로그 통계만 */
  if (p === '/api/admin/overview' && m === 'GET') {
    const [tb, tp, td, ta, rp] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) c FROM blog_posts').first().catch(() => ({c:0})),
      env.DB.prepare("SELECT COUNT(*) c FROM blog_posts WHERE status='published'").first().catch(() => ({c:0})),
      env.DB.prepare("SELECT COUNT(*) c FROM blog_posts WHERE status='draft'").first().catch(() => ({c:0})),
      env.DB.prepare('SELECT COUNT(*) c FROM admins').first().catch(() => ({c:0})),
      env.DB.prepare('SELECT id,title,slug,status,created_at FROM blog_posts ORDER BY created_at DESC LIMIT 5').all().catch(() => ({results:[]})),
    ]);
    return ok({
      blog_total: tb?.c ?? 0,
      blog_published: tp?.c ?? 0,
      blog_drafts: td?.c ?? 0,
      admin_count: ta?.c ?? 0,
      recent_posts: rp?.results ?? [],
    });
  }

  /* Settings GET */
  if (p === '/api/admin/settings' && m === 'GET') {
    const rows = await env.DB.prepare('SELECT key_name,key_value FROM settings').all();
    return ok({ settings: rows.results ?? [] });
  }

  /* Settings POST (배열) */
  if (p === '/api/admin/settings' && m === 'POST') {
    const body = await request.json().catch(() => ({}));
    /* 단일 키-값 저장 (blog_writing_style 등) */
    if (body.key && typeof body.key === 'string') {
      await env.DB.prepare(
        'INSERT INTO settings(key_name,key_value,updated_at) VALUES(?,?,datetime("now")) ON CONFLICT(key_name) DO UPDATE SET key_value=excluded.key_value,updated_at=excluded.updated_at'
      ).bind(body.key, body.value ?? '').run();
      return ok({ success: true });
    }
    /* 배열 저장 */
    const { settings } = body;
    if (!Array.isArray(settings)) return bad('settings array required');
    for (const s of settings) {
      await env.DB.prepare(
        'INSERT INTO settings(key_name,key_value,updated_at) VALUES(?,?,datetime("now")) ON CONFLICT(key_name) DO UPDATE SET key_value=excluded.key_value,updated_at=excluded.updated_at'
      ).bind(s.key, s.value ?? '').run();
    }
    return ok({ success: true });
  }

  /* Settings GET (단일 키 조회) */
  const settingMatch = p.match(/^\/api\/admin\/settings\/(.+)$/);
  if (settingMatch && m === 'GET') {
    const row = await env.DB.prepare('SELECT key_value FROM settings WHERE key_name=?').bind(decodeURIComponent(settingMatch[1])).first();
    return ok({ value: row?.key_value || '' });
  }

  /* Logo upload */
  if (p === '/api/admin/logo' && m === 'POST') {
    const fd   = await request.formData();
    const file = fd.get('file');
    const type = fd.get('type');
    if (!file || !type) return bad('file and type required');

    const ext  = (file.name || 'logo.png').split('.').pop().toLowerCase();
    const mimeMap = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', svg:'image/svg+xml', webp:'image/webp', gif:'image/gif' };
    const contentType = mimeMap[ext] || file.type || 'image/png';
    const key  = `logos/${type}-${Date.now()}.${ext}`;
    await env.R2.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType }
    });

    const r2pub = await getSetting(env.DB, 'r2_public_url');
    const logoUrl = `${r2pub}/${key}`;
    await env.DB.prepare(
      'INSERT INTO settings(key_name,key_value,updated_at) VALUES(?,?,datetime("now")) ON CONFLICT(key_name) DO UPDATE SET key_value=excluded.key_value,updated_at=excluded.updated_at'
    ).bind(`${type}_logo_url`, logoUrl).run();

    return ok({ success: true, url: logoUrl });
  }

  /* Admins list */
  if (p === '/api/admin/admins' && m === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT id,username,email,role,totp_enabled,is_active,last_login,created_at FROM admins ORDER BY created_at'
    ).all();
    return ok({ admins: rows.results ?? [] });
  }

  /* Admins add */
  if (p === '/api/admin/admins' && m === 'POST') {
    const { username, email, password, role } = await request.json().catch(() => ({}));
    if (!username || !email || !password) return bad('All fields required');
    const hash = await hashPw(password);
    await env.DB.prepare(
      'INSERT INTO admins(username,email,password_hash,role) VALUES(?,?,?,?)'
    ).bind(username, email.toLowerCase(), hash, role || 'admin').run();
    return ok({ success: true });
  }

  /* Admins toggle active */
  const admPatch = p.match(/^\/api\/admin\/admins\/(\d+)$/);
  if (admPatch && m === 'PATCH') {
    const { is_active } = await request.json().catch(() => ({}));
    await env.DB.prepare('UPDATE admins SET is_active=? WHERE id=?')
      .bind(is_active ? 1 : 0, admPatch[1]).run();
    return ok({ success: true });
  }

  /* Admins update info */
  const admEdit = p.match(/^\/api\/admin\/admins\/(\d+)\/edit$/);
  if (admEdit && m === 'POST') {
    const { username, email, password, role } = await request.json().catch(() => ({}));
    const id = admEdit[1];
    if (username) {
      const dup = await env.DB.prepare('SELECT id FROM admins WHERE username=? AND id!=?').bind(username, id).first();
      if (dup) return bad('이미 사용 중인 아이디입니다', 409);
    }
    if (email) {
      const dup = await env.DB.prepare('SELECT id FROM admins WHERE email=? AND id!=?').bind(email.toLowerCase(), id).first();
      if (dup) return bad('이미 사용 중인 이메일입니다', 409);
    }
    const fields = [];
    const vals   = [];
    if (username) { fields.push('username=?'); vals.push(username); }
    if (email)    { fields.push('email=?');    vals.push(email.toLowerCase()); }
    if (role)     { fields.push('role=?');     vals.push(role); }
    if (password) {
      if (password.length < 8) return bad('비밀번호는 8자 이상이어야 합니다');
      const hash = await hashPw(password);
      fields.push('password_hash=?'); vals.push(hash);
    }
    if (!fields.length) return bad('수정할 내용이 없습니다');
    fields.push("updated_at=datetime('now')");
    vals.push(id);
    await env.DB.prepare('UPDATE admins SET ' + fields.join(',') + ' WHERE id=?').bind(...vals).run();
    return ok({ success: true });
  }

  /* Blog routes → delegate to blogRouter() */
  if (p.startsWith('/api/admin/blog')) {
    const blogRes = await blogRouter(p, m, request, env);
    if (blogRes !== null) return blogRes;
  }

  /* 공개 로고 URL */
  if (p === '/api/public/logo' && m === 'GET') {
    const [header_url, footer_url, admin_url] = await Promise.all([
      getSetting(env.DB, 'header_logo_url'),
      getSetting(env.DB, 'footer_logo_url'),
      getSetting(env.DB, 'admin_logo_url'),
    ]);
    return ok({
      header_logo_url: header_url || null,
      footer_logo_url: footer_url || null,
      admin_logo_url:  admin_url  || null,
    });
  }

  return bad('Not found', 404);
}

/* =========================================================
   BLOG EXTENDED API (n0005와 100% 동일)
   ========================================================= */
export async function blogRouter(p, m, request, env) {
  const DB = env.DB;

  /* ── autoMigrate translations table ── */
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS blog_post_translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      lang TEXT NOT NULL,
      title TEXT, slug TEXT, excerpt TEXT, content TEXT,
      seo_title TEXT, seo_description TEXT,
      status TEXT DEFAULT 'published',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(post_id, lang)
    )`).run();
    try { await DB.prepare("ALTER TABLE blog_posts ADD COLUMN featured_image TEXT").run(); } catch {}
  } catch {}

  /* ── LIST ── */
  if (p === '/api/admin/blog' && m === 'GET') {
    const rows = await DB.prepare(
      `SELECT b.id, b.title, b.slug, b.category, b.status, b.seo_score,
              b.featured_image, b.published_at, b.created_at, b.updated_at,
              (SELECT COUNT(*) FROM blog_post_translations WHERE post_id=b.id) AS lang_count
       FROM blog_posts b ORDER BY b.created_at DESC`
    ).all();
    return ok({ posts: rows.results ?? [] });
  }

  /* ── CREATE ── */
  if (p === '/api/admin/blog' && m === 'POST') {
    const b = await request.json().catch(() => ({}));
    if (!b.title?.trim()) return bad('title required');
    const slug = b.slug || slugifyServer(b.title);
    const ex = await DB.prepare('SELECT id FROM blog_posts WHERE slug=?').bind(slug).first();
    if (ex) return bad('Slug already exists — try a different slug', 409);
    const now = new Date().toISOString();
    const res = await DB.prepare(
      `INSERT INTO blog_posts
       (title,slug,excerpt,content,category,tags,seo_title,seo_description,featured_image,seo_score,ai_review,status,published_at,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      b.title.trim(), slug,
      b.excerpt||'', b.content||'',
      b.category||'', b.tags||'',
      b.seo_title||b.title.trim(), b.seo_description||'',
      b.featured_image||'',
      b.seo_score||0, b.ai_review||null,
      b.status||'draft',
      b.status==='published' ? now : null,
      now, now
    ).run();
    return ok({ id: res.meta?.last_row_id, slug });
  }

  /* ── SINGLE GET ── */
  const singleMatch = p.match(/^\/api\/admin\/blog\/(\d+)$/);
  if (singleMatch && m === 'GET') {
    const post = await DB.prepare('SELECT * FROM blog_posts WHERE id=?').bind(singleMatch[1]).first();
    if (!post) return bad('Post not found', 404);
    return ok({ post });
  }

  /* ── UPDATE ── */
  if (singleMatch && m === 'PUT') {
    const b = await request.json().catch(() => ({}));
    const id = singleMatch[1];
    const cur = await DB.prepare('SELECT id,status,slug FROM blog_posts WHERE id=?').bind(id).first();
    if (!cur) return bad('Post not found', 404);

    const newSlug = b.slug || cur.slug;
    if (newSlug !== cur.slug) {
      const ex = await DB.prepare('SELECT id FROM blog_posts WHERE slug=? AND id!=?').bind(newSlug, id).first();
      if (ex) return bad('Slug already exists', 409);
    }
    const now = new Date().toISOString();
    const wasDraft = cur.status !== 'published';
    const nowPublished = b.status === 'published';
    const publishedAt = (wasDraft && nowPublished) ? now : null;

    const fields = [
      'title=?','slug=?','excerpt=?','content=?','category=?','tags=?',
      'seo_title=?','seo_description=?','featured_image=?',
      'seo_score=?','ai_review=?','status=?','updated_at=?'
    ];
    const vals = [
      b.title?.trim()||'', newSlug,
      b.excerpt||'', b.content||'',
      b.category||'', b.tags||'',
      b.seo_title||b.title||'', b.seo_description||'',
      b.featured_image||'',
      b.seo_score||0, b.ai_review||null,
      b.status||'draft', now,
    ];
    if (publishedAt) { fields.push('published_at=?'); vals.push(publishedAt); }
    vals.push(id);
    await DB.prepare(`UPDATE blog_posts SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
    return ok({ success: true, slug: newSlug });
  }

  /* ── DELETE ── */
  if (singleMatch && m === 'DELETE') {
    const id = singleMatch[1];
    await DB.prepare('DELETE FROM blog_posts WHERE id=?').bind(id).run();
    await DB.prepare('DELETE FROM blog_post_translations WHERE post_id=?').bind(id).run();
    return ok({ success: true });
  }

  /* ── AUTO-GENERATE BLOG POST (GPT-4o-mini) ── */
  if (p === '/api/admin/blog/auto-generate' && m === 'POST') {
    const { topic, category, word_count, lang } = await request.json().catch(() => ({}));
    if (!topic?.trim()) return bad('topic required');

    const openaiKey = await getSetting(DB, 'openai_api_key');
    if (!openaiKey) return bad('OpenAI API key not set in API Settings', 400);

    const targetWords = word_count || 800;
    const langMap = { en:'English', ko:'Korean', ja:'Japanese', zh:'Chinese (Simplified)', es:'Spanish' };
    const langName = langMap[lang] || 'English';
    const genPrompt = `You are a professional blog writer. Write a complete blog post about: "${topic}"

Requirements:
- Write in ${langName}
- Write approximately ${targetWords} words
- Use proper HTML formatting: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags
- Include an engaging introduction and conclusion
- Write in a professional yet accessible tone
- Do NOT use <h1> tag (the title is displayed separately)

Respond ONLY with valid JSON (no markdown, no explanation outside JSON):
{
  "title": "engaging blog post title in ${langName}",
  "slug": "url-safe-slug-in-english",
  "excerpt": "compelling 1-2 sentence summary (max 200 chars) in ${langName}",
  "content": "full HTML content of the blog post",
  "category": "${category || 'General'}",
  "tags": "tag1, tag2, tag3, tag4, tag5",
  "seo_title": "SEO optimized title (max 60 chars) in ${langName}",
  "seo_description": "meta description (max 160 chars) in ${langName}"
}`;

    try {
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: genPrompt }],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });
      if (!aiRes.ok) {
        const err = await aiRes.text();
        return bad('OpenAI error: ' + err.slice(0, 200), 502);
      }
      const aiData = await aiRes.json();
      const raw = aiData.choices?.[0]?.message?.content || '{}';
      let post;
      try { post = JSON.parse(raw.replace(/```json|```/g,'').trim()); }
      catch { return bad('AI returned invalid JSON', 502); }

      const slug = post.slug || slugifyServer(post.title);
      const ex = await DB.prepare('SELECT id FROM blog_posts WHERE slug=?').bind(slug).first();
      const finalSlug = ex ? slug + '-' + Date.now() : slug;
      const now = new Date().toISOString();

      const res = await DB.prepare(
        `INSERT INTO blog_posts
         (title,slug,excerpt,content,category,tags,seo_title,seo_description,featured_image,seo_score,ai_review,status,published_at,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        post.title?.trim()||topic, finalSlug,
        post.excerpt||'', post.content||'',
        post.category||category||'', post.tags||'',
        post.seo_title||post.title||'', post.seo_description||'',
        '', 0, null, 'draft', null, now, now
      ).run();

      return ok({ success: true, id: res.meta?.last_row_id, slug: finalSlug, post });
    } catch (e) {
      return bad('Auto-generate failed: ' + e.message, 502);
    }
  }

  /* ── AI REVIEW (GPT-4o-mini) ── */
  if (p === '/api/admin/blog/ai-review' && m === 'POST') {
    const { title, content } = await request.json().catch(() => ({}));
    if (!content || content.length < 100) return bad('Content too short (min 100 chars)');

    const openaiKey = await getSetting(DB, 'openai_api_key');
    if (!openaiKey) return bad('OpenAI API key not set in API Settings', 400);

    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const prompt = `You are a professional content editor and SEO expert. Analyze this blog post and respond ONLY with valid JSON (no markdown, no explanation outside JSON).

Title: "${title}"
Content (${wordCount} words):
---
${content.slice(0, 3000)}
---

Respond with this exact JSON structure:
{
  "feedback": "2-3 paragraph detailed editorial feedback covering: content quality, structure, SEO suggestions, tone, and specific improvements needed",
  "scores": {
    "readability": <integer 0-100>,
    "seo": <integer 0-100>,
    "tone": <integer 0-100>
  },
  "suggested_tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "improvements": ["specific improvement 1", "specific improvement 2", "specific improvement 3"]
}`;

    try {
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 800,
        }),
      });
      if (!aiRes.ok) {
        const err = await aiRes.text();
        return bad('OpenAI error: ' + err.slice(0, 200), 502);
      }
      const aiData = await aiRes.json();
      const raw = aiData.choices?.[0]?.message?.content || '{}';
      let review;
      try { review = JSON.parse(raw.replace(/```json|```/g,'').trim()); }
      catch { review = { feedback: raw, scores: {}, suggested_tags: [], improvements: [] }; }
      return ok({ review });
    } catch (e) {
      return bad('AI review failed: ' + e.message, 502);
    }
  }

  /* ── TRANSLATION LIST ── */
  const transListMatch = p.match(/^\/api\/admin\/blog\/(\d+)\/translations$/);
  if (transListMatch && m === 'GET') {
    const rows = await DB.prepare(
      'SELECT * FROM blog_post_translations WHERE post_id=? ORDER BY lang'
    ).bind(transListMatch[1]).all();
    return ok({ translations: rows.results ?? [] });
  }

  /* ── TRANSLATE ONE LANG (Gemini) ── */
  const transMatch = p.match(/^\/api\/admin\/blog\/(\d+)\/translate$/);
  if (transMatch && m === 'POST') {
    const postId = transMatch[1];
    const { lang } = await request.json().catch(() => ({}));
    const SUPPORTED = ['ko','ja','zh','es'];
    if (!SUPPORTED.includes(lang)) return bad('Unsupported language. Supported: ' + SUPPORTED.join(','));

    const post = await DB.prepare('SELECT * FROM blog_posts WHERE id=?').bind(postId).first();
    if (!post) return bad('Post not found', 404);

    const geminiKey = await getSetting(DB, 'gemini_api_key');
    if (!geminiKey) return bad('Gemini API key not set in API Settings', 400);

    const langNames = { ko:'Korean', ja:'Japanese', zh:'Chinese (Simplified)', es:'Spanish' };
    const langName  = langNames[lang];

    const prompt = `Translate the following blog post to ${langName}. Respond ONLY with valid JSON, no markdown.

Source title: "${post.title}"
Source excerpt: "${post.excerpt || ''}"
Source content:
---
${(post.content || '').slice(0, 4000)}
---

Rules:
- Translate naturally for native ${langName} readers
- Keep all Markdown formatting (##, **, *, \`code\`, etc.)
- Keep URLs, code blocks, and technical terms in English
- Create an SEO-friendly translated title
- Create a URL-safe slug in English based on the translated title (lowercase, hyphens)

JSON format:
{
  "title": "translated title",
  "slug": "url-safe-english-slug-${lang}",
  "excerpt": "translated excerpt",
  "content": "full translated markdown content",
  "seo_title": "translated SEO title",
  "seo_description": "translated meta description max 160 chars"
}`;

    try {
      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
          }),
        }
      );
      if (!gemRes.ok) {
        const err = await gemRes.text();
        return bad('Gemini error: ' + err.slice(0, 200), 502);
      }
      const gemData = await gemRes.json();
      const raw = gemData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      let trans;
      try { trans = JSON.parse(raw.replace(/```json|```/g,'').trim()); }
      catch { return bad('Gemini returned invalid JSON', 502); }

      const baseSlug = (trans.slug || slugifyServer(trans.title || post.title) + '-' + lang);
      const finalSlug = baseSlug.endsWith('-'+lang) ? baseSlug : baseSlug + '-' + lang;

      const now = new Date().toISOString();
      await DB.prepare(
        `INSERT INTO blog_post_translations (post_id,lang,title,slug,excerpt,content,seo_title,seo_description,status,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(post_id,lang) DO UPDATE SET
           title=excluded.title, slug=excluded.slug, excerpt=excluded.excerpt,
           content=excluded.content, seo_title=excluded.seo_title,
           seo_description=excluded.seo_description, updated_at=excluded.updated_at`
      ).bind(
        postId, lang,
        trans.title||'', finalSlug,
        trans.excerpt||'', trans.content||'',
        trans.seo_title||trans.title||'',
        trans.seo_description||'',
        'published', now, now
      ).run();

      const saved = await DB.prepare(
        'SELECT * FROM blog_post_translations WHERE post_id=? AND lang=?'
      ).bind(postId, lang).first();
      return ok({ translation: saved });

    } catch (e) {
      return bad('Translation failed: ' + e.message, 502);
    }
  }

  /* ── SEO 상세 분석 (seo-check) ── */
  const seoCheckMatch = p.match(/^\/api\/admin\/blog\/(\d+)\/seo-check$/);
  if (seoCheckMatch && m === 'GET') {
    const id = seoCheckMatch[1];
    const post = await DB.prepare('SELECT * FROM blog_posts WHERE id=?').bind(id).first();
    if (!post) return bad('Post not found', 404);
    const focusKw = post.focus_keyword || post.title || '';
    const slug = post.slug || '';
    const breakdown = computeSeoScoreDetailed(post, focusKw, slug);
    // sources: blog_gen_log → blog_sources 로 실제 참고 출처 조회
    let sources = [];
    let sourceContentForAI = '';
    try {
      const genLog = await DB.prepare('SELECT source_ids FROM blog_gen_log WHERE post_id=? ORDER BY id DESC LIMIT 1').bind(id).first();
      if (genLog?.source_ids) {
        const sids = genLog.source_ids.split(',').map(s => s.trim()).filter(Boolean);
        if (sids.length) {
          const ph = sids.map(() => '?').join(',');
          const srows = await DB.prepare(`SELECT id,title,url,type,content FROM blog_sources WHERE id IN (${ph})`).bind(...sids).all();
          sources = (srows.results || []).map(s => ({ title: s.title, url: s.url, type: s.type }));
          sourceContentForAI = (srows.results || []).map(s =>
            `[${s.title||s.url}]: ${(s.content||'').split(/\s+/).slice(0, 300).join(' ')}`
          ).join('\n\n---\n\n');
        }
      }
    } catch {}
    // fallback: ai_review JSON
    if (!sources.length) {
      try {
        const rev = post.ai_review ? JSON.parse(post.ai_review) : null;
        if (rev && Array.isArray(rev.sources)) sources = rev.sources;
      } catch {}
    }
    // AI 유사도 분석 (참고 소스 포함)
    let similarity = {};
    const openaiKey = (env.OPENAI_API_KEY || '').trim() || ((await getSetting(DB, 'openai_api_key')) || '').trim();
    if (openaiKey) {
      try {
        const textSnippet = (post.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 2500);
        const simPrompt = `당신은 콘텐츠 유사도 및 저작권 전문가입니다. 아래 블로그 글을 참고 소스와 비교하여 유사도, 저작권 위험도, 독창성을 분석하세요. 반드시 유효한 JSON만 응답하세요. 모든 텍스트 필드는 반드시 한국어로 작성하세요.

제목: "${post.title}"
콘텐츠: "${textSnippet}"

이 글 작성에 사용된 참고 소스:
${sourceContentForAI || '(참고 소스 없음)'}

아래 JSON 형식으로 정확히 응답하세요 (모든 설명/요약은 한국어로):
{
  "overall_risk": "low"|"mid"|"high",
  "summary": "참고 소스 대비 콘텐츠 유사도와 독창성에 대한 2-3문장 한국어 평가",
  "word_similarity": {"risk":"low"|"mid"|"high","detail": <0-100 숫자>},
  "context_similarity": {"risk":"low"|"mid"|"high","detail": <0-100 숫자>},
  "proper_nouns": {"risk":"low"|"mid"|"high","detail": "발견된 고유명사 목록 (한국어로) 또는 없음"},
  "topic_similarity": {"risk":"low"|"mid"|"high","detail": <0-100 숫자>},
  "title_similarity": {"risk":"low"|"mid"|"high","detail": "-" 또는 한국어 유사도 설명},
  "copyright_risk": {"risk":"low"|"mid"|"high","detail": "낮음"|"보통"|"높음"},
  "by_source": []
}`;
        const simRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + openaiKey },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: simPrompt }], temperature: 0.2, max_tokens: 800 })
        });
        const simJson = await simRes.json();
        const raw = simJson.choices?.[0]?.message?.content || '{}';
        try { similarity = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch {}
      } catch {}
    }
    return ok({ post: { id: post.id, title: post.title, slug: post.slug }, focusKw, seoBreakdown: breakdown, sources, similarity });
  }

  /* ── SEO 재작성 (seo-rewrite) ── */
  const seoRewriteMatch = p.match(/^\/api\/admin\/blog\/(\d+)\/seo-rewrite$/);
  if (seoRewriteMatch && m === 'POST') {
    const id = seoRewriteMatch[1];
    const post = await DB.prepare('SELECT * FROM blog_posts WHERE id=?').bind(id).first();
    if (!post) return bad('Post not found', 404);
    const openaiKey = (env.OPENAI_API_KEY || '').trim() || ((await getSetting(DB, 'openai_api_key')) || '').trim();
    if (!openaiKey) return bad('OpenAI API key not set', 400);
    const focusKw = post.focus_keyword || post.title || '';
    const kw = focusKw.toLowerCase();
    const oldScore = computeSeoScore(post, focusKw, post.slug || '');
    if (oldScore >= 90) return ok({ already_good: true, score: oldScore });
    const breakdown = computeSeoScoreDetailed(post, focusKw, post.slug || '');
    const failedChecks = breakdown.checks.filter(c => !c.pass);
    const failedLabels = failedChecks.map(c => c.label);

    // ── STEP 1: 참고 소스 실제 내용 가져오기 (blog_gen_log → blog_sources)
    let sourceContent = '';
    let sourceUrls = [];
    try {
      const genLog = await DB.prepare('SELECT source_ids FROM blog_gen_log WHERE post_id=? ORDER BY id DESC LIMIT 1').bind(id).first();
      if (genLog?.source_ids) {
        const sids = genLog.source_ids.split(',').map(s => s.trim()).filter(Boolean);
        if (sids.length) {
          const ph = sids.map(() => '?').join(',');
          const srows = await DB.prepare(`SELECT title,url,content FROM blog_sources WHERE id IN (${ph})`).bind(...sids).all();
          for (const s of (srows.results || [])) {
            if (s.url) sourceUrls.push(s.url);
            sourceContent += `\n[참고: ${s.title || s.url}]\n${(s.content || '').split(/\s+/).slice(0, 500).join(' ')}\n\n---\n`;
          }
        }
      }
    } catch {}

    // ── STEP 2: 프로그래매틱 HTML 수정 (AI 불필요)
    let content = post.content || '';

    // H2/H3에 키워드 포함 (없는 경우 첫 번째 H2에 추가)
    if (failedLabels.some(l => l.includes('H2/H3'))) {
      let fixed = false;
      content = content.replace(/<(h2|h3)([^>]*)>([\s\S]*?)<\/(h2|h3)>/gi, (m2, open, attrs, inner, close) => {
        if (!fixed && !inner.toLowerCase().includes(kw)) {
          fixed = true;
          return `<${open}${attrs}>${inner}: ${focusKw}</${close}>`;
        }
        return m2;
      });
    }

    // 내부 링크 없으면 추가
    if (failedLabels.some(l => l.includes('internal')) && !/<a[^>]+href=["']\/[^"']+["']/i.test(content)) {
      content += `\n<p>더 많은 보안 가이드는 <a href="/blog">보안 블로그</a>에서 확인하세요.</p>`;
    }

    // 외부 링크 없으면 추가
    if (failedLabels.some(l => l.includes('outbound') || l.includes('외부')) && !/<a[^>]+href=["']https?:\/\//i.test(content)) {
      content += `\n<p>보안 모범 사례에 대한 자세한 내용은 <a href="https://owasp.org/www-project-top-ten/" target="_blank" rel="noopener">OWASP Top 10</a>을 참조하세요.</p>`;
    }

    // ── STEP 3: AI로 meta/title 생성 + 콘텐츠 확장 (참고 소스 활용)
    const wc = content.split(/\s+/).filter(Boolean).length;
    const needExpand = failedLabels.some(l => l.includes('1500'));
    const needMeta = failedLabels.some(l => l.includes('메타') || l.includes('meta'));
    const needSeoTitle = failedLabels.some(l => l.includes('SEO 제목'));
    const needImgAlt = failedLabels.some(l => l.includes('Alt'));

    const aiPrompt = `You are a professional SEO blog writer. Fix specific SEO issues in this blog post using the reference sources provided.

FOCUS KEYWORD: "${focusKw}"
CURRENT WORD COUNT: ${wc}
FAILED CHECKS: ${failedLabels.join(', ')}

REFERENCE SOURCES (use these facts and information to improve the content):
${sourceContent || '(no reference sources available)'}

CURRENT CONTENT:
${content.slice(0, 5000)}

REQUIRED TASKS:
${needSeoTitle ? `- seo_title: must contain "${focusKw}", under 60 chars` : '- seo_title: keep similar to current'}
${needMeta ? `- seo_description: write exactly 140-160 chars, must contain "${focusKw}", reference the sources above` : '- seo_description: keep current'}
${needExpand ? `- Expand content to 1500+ words: add 2-3 new <h2> sections using facts from the reference sources. Each section 150-200 words.` : '- content: keep current length'}
${needImgAlt ? `- Fix all <img> tags to have alt="...${focusKw}..." attributes` : ''}
- NEVER remove or shorten existing content
- All new content must reference information from the reference sources above
- Respond ONLY with valid JSON, no code blocks

JSON:
{
  "seo_title": "...",
  "seo_description": "...",
  "content": "full HTML — existing content + new sections appended"
}`;

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + openaiKey },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [
          { role: 'system', content: 'You are a professional SEO writer. Respond ONLY with valid JSON. Never shorten or remove existing HTML content. Use reference source facts to expand content.' },
          { role: 'user', content: aiPrompt }
        ], temperature: 0.4, max_tokens: 8000 })
      });
      const j = await res.json();
      const raw = j.choices?.[0]?.message?.content || '{}';
      let aiResult;
      try { aiResult = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch { aiResult = {}; }

      // AI 결과 병합 — content는 AI가 반환한 것이 더 길 경우만 사용
      const aiContent = aiResult.content || '';
      const aiWc = aiContent.split(/\s+/).filter(Boolean).length;
      const finalContent = aiWc > wc ? aiContent : content;

      const rewrittenPost = {
        title: post.title,
        content: finalContent,
        seo_title: aiResult.seo_title || post.seo_title || post.title,
        seo_description: aiResult.seo_description || post.seo_description || '',
        focus_keyword: focusKw
      };
      const newScore = computeSeoScore(rewrittenPost, focusKw, post.slug || '');
      const now = new Date().toISOString();
      await DB.prepare(`UPDATE blog_posts SET title=?,content=?,seo_title=?,seo_description=?,seo_score=?,updated_at=? WHERE id=?`)
        .bind(rewrittenPost.title, rewrittenPost.content, rewrittenPost.seo_title, rewrittenPost.seo_description, newScore, now, id).run();
      return ok({ success: true, old_score: oldScore, new_score: newScore, fixed_count: failedChecks.length });
    } catch (e) { return bad('Rewrite failed: ' + e.message, 502); }
  }

  /* ── SEO 재측정 ── */
  const rescoreMatch = p.match(/^\/api\/admin\/blog\/(\d+)\/rescore$/);
  if (rescoreMatch && m === 'POST') {
    const id = rescoreMatch[1];
    const post = await DB.prepare('SELECT title, slug, content, seo_title, seo_description, focus_keyword FROM blog_posts WHERE id=?').bind(id).first();
    if (!post) return bad('Post not found', 404);
    const score = computeSeoScore(post, post.focus_keyword || '', post.slug || '');
    await DB.prepare('UPDATE blog_posts SET seo_score=?, updated_at=? WHERE id=?')
      .bind(score, new Date().toISOString(), id).run();
    return ok({ seo_score: score });
  }

  /* ── 재작성 (SEO < 90) ── */
  const rewriteMatch = p.match(/^\/api\/admin\/blog\/(\d+)\/rewrite$/);
  if (rewriteMatch && m === 'POST') {
    const id = rewriteMatch[1];
    const post = await DB.prepare('SELECT * FROM blog_posts WHERE id=?').bind(id).first();
    if (!post) return bad('Post not found', 404);

    const openaiKey = await getSetting(DB, 'openai_api_key');
    if (!openaiKey) return bad('OpenAI API key not set', 400);

    const focusKw = post.focus_keyword || post.title || '';
    const currentScore = computeSeoScore(post, focusKw, post.slug || '');
    const category = post.category || 'general';

    const rewritePrompt = `You are a professional SEO blog writer. This blog post scored ${currentScore}/100. Rewrite it to score 90+.

FOCUS KEYWORD: "${focusKw}"
TITLE: "${post.title}"
CATEGORY: ${category}

CURRENT CONTENT:
${(post.content || '').slice(0, 3000)}

REQUIREMENTS (all mandatory):
- Focus keyword in title, first paragraph, at least one H2, meta description
- Keyword density 1-2%
- Minimum 5 H2 headings, 2 H3 headings
- 1500-2000 words
- At least one external link (https://...)
- At least one internal link (/blog-post.html?slug=...)
- Image with alt containing focus keyword
- No H1 tag in content
- Meta description 140-160 chars ending with CTA
- Title 50-60 chars with power word

Return ONLY valid JSON:
{"title":"title","content":"full HTML","excerpt":"120-160 chars","seo_title":"SEO title 50-60 chars","seo_description":"140-160 char meta desc ending with CTA","keywords":["kw1","kw2","kw3","kw4","kw5"]}`;

    try {
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a professional SEO content writer. Respond ONLY with valid JSON.' },
            { role: 'user', content: rewritePrompt }
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });
      if (!aiRes.ok) return bad('OpenAI error: ' + (await aiRes.text()).slice(0, 200), 502);

      const aiData = await aiRes.json();
      const raw = aiData.choices?.[0]?.message?.content || '{}';
      let newPost;
      try { newPost = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
      catch { return bad('AI returned invalid JSON', 502); }

      const rewrittenPost = {
        title: newPost.title || post.title,
        content: newPost.content || post.content,
        excerpt: newPost.excerpt || post.excerpt,
        seo_title: newPost.seo_title || newPost.title || post.seo_title,
        seo_description: newPost.seo_description || post.seo_description,
        focus_keyword: focusKw,
      };
      const newScore = computeSeoScore(rewrittenPost, focusKw, post.slug || '');
      const now = new Date().toISOString();

      await DB.prepare(
        `UPDATE blog_posts SET title=?, content=?, excerpt=?, seo_title=?, seo_description=?, tags=?, seo_score=?, updated_at=? WHERE id=?`
      ).bind(
        rewrittenPost.title, rewrittenPost.content, rewrittenPost.excerpt,
        rewrittenPost.seo_title, rewrittenPost.seo_description,
        (newPost.keywords || []).join(','), newScore, now, id
      ).run();

      return ok({ success: true, seo_score: newScore, prev_score: currentScore });
    } catch (e) {
      return bad('Rewrite failed: ' + e.message, 502);
    }
  }

  /* ── 저작권/라이센스 점검 ── */
  const copyrightMatch = p.match(/^\/api\/admin\/blog\/(\d+)\/copyright-check$/);
  if (copyrightMatch && m === 'POST') {
    const id = copyrightMatch[1];
    const post = await DB.prepare('SELECT title, content, excerpt FROM blog_posts WHERE id=?').bind(id).first();
    if (!post) return bad('Post not found', 404);

    const openaiKey = await getSetting(DB, 'openai_api_key');
    if (!openaiKey) return bad('OpenAI API key not set', 400);

    const textContent = (post.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 4000);

    const copyrightPrompt = `당신은 저작권 및 콘텐츠 라이센스 전문가입니다. 아래 블로그 글에서 저작권, 라이센스, 표절 관련 잠재적 문제를 분석하세요. 반드시 유효한 JSON만 응답하고, 모든 텍스트 필드는 한국어로 작성하세요.

제목: "${post.title}"
콘텐츠:
${textContent}

다음 항목을 점검하세요:
1. 알려진 출처에서 직접 복사하거나 거의 그대로 사용한 내용
2. 출처 표기 없이 인용하거나 발췌한 구절
3. 가사, 시, 문학 작품 발췌
4. 상표명의 부적절한 사용
5. 출처 표기가 필요한 통계 또는 데이터
6. 라이센스 제한 콘텐츠 (CC 위반 등)

다음 JSON 형식으로만 응답하세요 (모든 설명은 한국어):
{
  "status": "clean"|"warning"|"critical",
  "overall": "한 문장으로 된 한국어 종합 평가",
  "issues": [
    {"severity":"low"|"medium"|"high","type":"저작권|상표|출처미표기|표절|기타","description":"한국어 이슈 설명","suggestion":"한국어로 수정 방법 안내"}
  ],
  "safe_to_publish": true|false,
  "summary": "한국어로 작성한 2-3문장 요약"
}`;

    try {
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a copyright expert. Respond ONLY with valid JSON.' },
            { role: 'user', content: copyrightPrompt }
          ],
          temperature: 0.2,
          max_tokens: 1200,
        }),
      });
      if (!aiRes.ok) return bad('OpenAI error: ' + (await aiRes.text()).slice(0, 200), 502);

      const aiData = await aiRes.json();
      const raw = aiData.choices?.[0]?.message?.content || '{}';
      let result;
      try { result = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
      catch { return bad('AI returned invalid JSON', 502); }

      return ok({ copyright: result });
    } catch (e) {
      return bad('Copyright check failed: ' + e.message, 502);
    }
  }

  return null;
}

/* ── SEO 점수 계산 (RankMath 기준, blog-gen.js와 동일 로직) ── */
function computeSeoScore(post, focusKw, slug) {
  let score = 0;
  const kw = (focusKw || '').toLowerCase();
  const title = (post.title || '').toLowerCase();
  const seoT = (post.seo_title || '').toLowerCase();
  const metaD = post.seo_description || '';
  const metaDl = metaD.toLowerCase();
  const raw = post.content || '';
  const words = raw.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean);
  const wc = words.length;

  if (kw && title.includes(kw)) score += 5;
  if (kw && seoT.includes(kw)) score += 5;
  if (kw && metaDl.includes(kw)) score += 5;
  const kwSlug = kw.replace(/\s+/g, '-');
  if (kw && slug.includes(kwSlug)) score += 5;
  if (kw && words.slice(0, 100).join(' ').includes(kw)) score += 5;

  const headingText = (raw.match(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/gi) || []).map(h => h.replace(/<[^>]*>/g, '')).join(' ').toLowerCase();
  if (kw && headingText.includes(kw)) score += 5;

  if (kw && wc) {
    const kwWc = kw.split(/\s+/).length;
    const kwCount = (words.join(' ').match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
    const density = kwCount * kwWc / wc * 100;
    if (density >= 1 && density <= 3) score += 10;
    else if (density >= 0.5 && density < 1) score += 5;
  }

  const alts = (raw.match(/alt="([^"]*)"/gi) || []).join(' ').toLowerCase();
  if (kw && alts.includes(kw)) score += 5;
  if (wc >= 600) score += 5;
  if (wc >= 1500) score += 5;
  if (/href="https?:\/\//.test(raw)) score += 5;
  if (/href="\/blog-post\.html/.test(raw)) score += 5;
  if (/<img\b/.test(raw)) score += 5;
  if ((raw.match(/<h2[^>]*>/gi) || []).length >= 5) score += 5;
  if ((raw.match(/<h3[^>]*>/gi) || []).length >= 2) score += 5;
  if (!/<(strong|em|h[2-6])[^>]*>\s*<\/\1>/i.test(raw)) score += 5;

  const powerWords = ['guide','how','best','complete','ultimate','step','fix','improve','top','easy','tips','checklist','explained'];
  if (powerWords.some(w => title.includes(w))) score += 5;

  const paras = raw.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  if (paras.length) {
    const avg = paras.map(p2 => p2.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length).reduce((a, b) => a + b, 0) / paras.length;
    if (avg >= 40 && avg <= 150) score += 5;
  }

  if (metaD.length >= 140 && metaD.length <= 160) score += 5;
  if (!/<h1[^>]*>/i.test(raw)) score += 5;
  return Math.min(score, 100);
}

/* ── SEO 상세 점수 (checks 배열 포함) ── */
function computeSeoScoreDetailed(post, focusKw, slug) {
  const kw = (focusKw || '').toLowerCase();
  const title = (post.title || '').toLowerCase();
  const seoT = (post.seo_title || '').toLowerCase();
  const metaD = post.seo_description || '';
  const metaDl = metaD.toLowerCase();
  const raw = post.content || '';
  const words = raw.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean);
  const wc = words.length;
  const headingText = (raw.match(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/gi) || []).map(h => h.replace(/<[^>]*>/g, '')).join(' ').toLowerCase();
  const alts = (raw.match(/alt="([^"]*)"/gi) || []).join(' ').toLowerCase();
  const kwSlug = kw.replace(/\s+/g, '-');
  let kwDensity = 0;
  if (kw && wc) {
    const kwWc = kw.split(/\s+/).length;
    const kwCount = (words.join(' ').match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
    kwDensity = kwCount * kwWc / wc * 100;
  }
  const paras = raw.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  const avgParaLen = paras.length ? paras.map(p2 => p2.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length).reduce((a, b) => a + b, 0) / paras.length : 0;
  const powerWords = ['guide','how','best','complete','ultimate','step','fix','improve','top','easy','tips','checklist','explained'];
  const checks = [
    { label: '키워드 → 제목(title) 포함', pass: !!(kw && title.includes(kw)), score: kw && title.includes(kw) ? 5 : 0, max: 5 },
    { label: '키워드 → SEO 제목 포함', pass: !!(kw && seoT.includes(kw)), score: kw && seoT.includes(kw) ? 5 : 0, max: 5 },
    { label: '키워드 → 메타 설명 포함', pass: !!(kw && metaDl.includes(kw)), score: kw && metaDl.includes(kw) ? 5 : 0, max: 5 },
    { label: '키워드 → URL 슬러그 포함', pass: !!(kw && slug.includes(kwSlug)), score: kw && slug.includes(kwSlug) ? 5 : 0, max: 5 },
    { label: '키워드 → 첫 100단어에 포함', pass: !!(kw && words.slice(0, 100).join(' ').includes(kw)), score: kw && words.slice(0, 100).join(' ').includes(kw) ? 5 : 0, max: 5 },
    { label: '키워드 → H2/H3 제목에 포함', pass: !!(kw && headingText.includes(kw)), score: kw && headingText.includes(kw) ? 5 : 0, max: 5 },
    { label: '키워드 밀도 1~3% (최적)', pass: kwDensity >= 1 && kwDensity <= 3, score: kwDensity >= 1 && kwDensity <= 3 ? 10 : kwDensity >= 0.5 ? 5 : 0, max: 10 },
    { label: '이미지 Alt에 키워드 포함', pass: !!(kw && alts.includes(kw)), score: kw && alts.includes(kw) ? 5 : 0, max: 5 },
    { label: '본문 600단어 이상', pass: wc >= 600, score: wc >= 600 ? 5 : 0, max: 5 },
    { label: '본문 1500단어 이상', pass: wc >= 1500, score: wc >= 1500 ? 5 : 0, max: 5 },
    { label: '외부(outbound) 링크 포함', pass: /href="https?:\/\//.test(raw), score: /href="https?:\/\//.test(raw) ? 5 : 0, max: 5 },
    { label: '내부(internal) 링크 포함', pass: /href="\/blog-post\.html/.test(raw), score: /href="\/blog-post\.html/.test(raw) ? 5 : 0, max: 5 },
    { label: '이미지(<img>) 포함', pass: /<img\b/.test(raw), score: /<img\b/.test(raw) ? 5 : 0, max: 5 },
    { label: 'H2 태그 5개 이상', pass: (raw.match(/<h2[^>]*>/gi) || []).length >= 5, score: (raw.match(/<h2[^>]*>/gi) || []).length >= 5 ? 5 : 0, max: 5 },
    { label: 'H3 태그 2개 이상', pass: (raw.match(/<h3[^>]*>/gi) || []).length >= 2, score: (raw.match(/<h3[^>]*>/gi) || []).length >= 2 ? 5 : 0, max: 5 },
    { label: '빈 태그 없음', pass: !/<(strong|em|h[2-6])[^>]*>\s*<\/\1>/i.test(raw), score: !/<(strong|em|h[2-6])[^>]*>\s*<\/\1>/i.test(raw) ? 5 : 0, max: 5 },
    { label: '제목에 파워워드 포함', pass: powerWords.some(w => title.includes(w)), score: powerWords.some(w => title.includes(w)) ? 5 : 0, max: 5 },
    { label: '문단 평균 40~150단어', pass: avgParaLen >= 40 && avgParaLen <= 150, score: avgParaLen >= 40 && avgParaLen <= 150 ? 5 : 0, max: 5 },
    { label: '메타 설명 140~160자', pass: metaD.length >= 140 && metaD.length <= 160, score: metaD.length >= 140 && metaD.length <= 160 ? 5 : 0, max: 5 },
    { label: '본문에 H1 중복 없음', pass: !/<h1[^>]*>/i.test(raw), score: !/<h1[^>]*>/i.test(raw) ? 5 : 0, max: 5 },
  ];
  const total = Math.min(checks.reduce((s, c) => s + c.score, 0), 100);
  return { total, wordCount: wc, checks };
}

function slugifyServer(str) {
  return (str||'').toLowerCase()
    .replace(/[^a-z0-9\s-]/g,'')
    .replace(/\s+/g,'-')
    .replace(/-+/g,'-')
    .slice(0,80)
    .replace(/^-|-$/g,'') || 'post-' + Date.now();
}

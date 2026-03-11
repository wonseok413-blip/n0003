/**
 * blog-gen.js — n0003 블로그 자동생성 엔진
 * n0005 프로덕션 배포 코드에서 복사 (카테고리만 보안 6개로 변경)
 */

import { getSetting } from './db.js';

/* ── 공통 응답 헬퍼 ── */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};
const ok = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
const bad = (msg, s = 400) => ok({ error: msg }, s);

/* ── 보안 6개 카테고리 ── */
const CATEGORIES = [
  'malware-removal',
  'website-security',
  'vulnerability',
  'threat-detection',
  'security-hardening',
  'incident-response',
];

/* ── 카테고리별 외부 권위 링크 ── */
const CAT_EXTERNAL_REFS = {
  'malware-removal': [
    ['https://owasp.org/www-project-top-ten/', 'OWASP Top Ten Security Risks'],
    ['https://www.cisa.gov/topics/cyber-threats-and-advisories', 'CISA Cyber Threats and Advisories'],
  ],
  'website-security': [
    ['https://owasp.org/www-project-web-security-testing-guide/', 'OWASP Web Security Testing Guide'],
    ['https://www.cloudflare.com/learning/security/', 'Cloudflare Security Learning Center'],
  ],
  'vulnerability': [
    ['https://nvd.nist.gov/', 'NIST National Vulnerability Database'],
    ['https://cve.mitre.org/', 'CVE — Common Vulnerabilities and Exposures'],
  ],
  'threat-detection': [
    ['https://attack.mitre.org/', 'MITRE ATT&CK Framework'],
    ['https://www.cisa.gov/topics/cyber-threats-and-advisories', 'CISA Cyber Threats and Advisories'],
  ],
  'security-hardening': [
    ['https://www.cisecurity.org/cis-benchmarks', 'CIS Benchmarks'],
    ['https://owasp.org/www-project-application-security-verification-standard/', 'OWASP ASVS'],
  ],
  'incident-response': [
    ['https://www.nist.gov/cyberframework', 'NIST Cybersecurity Framework'],
    ['https://www.sans.org/white-papers/incident-handlers-handbook/', 'SANS Incident Handler Handbook'],
  ],
};

/* ── 카테고리별 주제 15개 ── */
const CAT_TOPICS = {
  'malware-removal': [
    'how to detect and remove malware from your website',
    'step-by-step guide to cleaning a hacked WordPress site',
    'common types of website malware and how to remove them',
    'automated malware scanning tools for website owners',
    'removing backdoor scripts from compromised web servers',
    'how to clean a website after a phishing attack',
    'malware removal best practices for e-commerce sites',
    'identifying and removing cryptomining malware from websites',
    'how to remove SEO spam injections from your site',
    'cleaning malicious redirects from a hacked website',
    'post-malware cleanup checklist for website administrators',
    'how to remove drive-by download scripts from web pages',
    'WordPress malware removal without losing data',
    'detecting fileless malware on web servers',
    'how to remove defacement attacks and restore your website',
  ],
  'website-security': [
    'essential website security checklist for small businesses',
    'how to secure your website against common cyber threats',
    'website security best practices for non-technical users',
    'SSL and HTTPS setup guide for website security',
    'how to protect your website from DDoS attacks',
    'web application firewall setup guide for beginners',
    'securing WordPress websites against brute force attacks',
    'how to implement content security policy headers',
    'website security monitoring tools and services compared',
    'two-factor authentication setup for website administrators',
    'how to secure file upload functionality on your website',
    'protecting customer data on your e-commerce website',
    'security headers every website should implement',
    'how to secure your website contact forms from spam and abuse',
    'GDPR compliance and website security best practices',
  ],
  'vulnerability': [
    'understanding common web application vulnerabilities',
    'SQL injection prevention techniques for web developers',
    'cross-site scripting XSS prevention guide',
    'how to perform a vulnerability assessment on your website',
    'OWASP Top 10 vulnerabilities explained for beginners',
    'server misconfiguration vulnerabilities and how to fix them',
    'broken authentication vulnerabilities and remediation',
    'insecure deserialization risks in web applications',
    'how to find and fix security misconfigurations in web servers',
    'XML external entity XXE attack prevention guide',
    'cross-site request forgery CSRF protection methods',
    'directory traversal vulnerability detection and prevention',
    'security vulnerability scanning tools for websites',
    'how to patch known vulnerabilities in CMS platforms',
    'zero-day vulnerability response strategies for website owners',
  ],
  'threat-detection': [
    'how to set up real-time threat monitoring for your website',
    'intrusion detection systems for web applications',
    'log analysis techniques for detecting security threats',
    'behavioral analysis for detecting website attacks',
    'how to detect unauthorized access to your web server',
    'monitoring website traffic for suspicious activity patterns',
    'setting up security alerts for your website',
    'threat intelligence feeds for website protection',
    'how to detect bot attacks on your website',
    'network traffic analysis for web security monitoring',
    'detecting data exfiltration attempts on web applications',
    'how to identify phishing attacks targeting your website users',
    'real-time malware detection tools for websites',
    'anomaly detection techniques for web server security',
    'how to detect and block credential stuffing attacks',
  ],
  'security-hardening': [
    'server hardening checklist for web hosting environments',
    'WordPress security hardening guide for administrators',
    'how to harden your web server configuration',
    'database security hardening best practices',
    'hardening PHP configuration for web applications',
    'Linux server hardening for website hosting',
    'how to implement least privilege access on web servers',
    'network security hardening for hosting environments',
    'CMS security hardening tips for website owners',
    'how to harden API endpoints against common attacks',
    'container security hardening for web applications',
    'email server hardening to prevent phishing abuse',
    'DNS security hardening techniques for domains',
    'how to harden your website against supply chain attacks',
    'cloud hosting security hardening best practices',
  ],
  'incident-response': [
    'building an incident response plan for website security',
    'step-by-step guide to handling a website security breach',
    'incident response checklist for website administrators',
    'how to communicate a data breach to affected users',
    'forensic analysis after a website security incident',
    'disaster recovery planning for web applications',
    'how to preserve evidence after a website hack',
    'incident response team roles for small businesses',
    'post-incident review process for website security',
    'how to restore website operations after a cyber attack',
    'legal requirements for reporting website security incidents',
    'business continuity planning for web-based businesses',
    'how to document and report security incidents properly',
    'automated incident response tools for website security',
    'lessons learned from real-world website security breaches',
  ],
};

/* ── DB 초기화 (blog_sources, blog_gen_log) ── */
let _bgReady = false;
async function initBlogGenDB(DB) {
  if (_bgReady) return;
  _bgReady = true;
  const run = async (sql) => {
    try { await DB.prepare(sql).run(); return true; }
    catch { return false; }
  };
  await run(`CREATE TABLE IF NOT EXISTS blog_sources (
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
  )`);
  await run(`ALTER TABLE blog_sources ADD COLUMN priority TEXT DEFAULT 'normal'`);
  await run(`ALTER TABLE blog_sources ADD COLUMN tags TEXT DEFAULT ''`);
  await run(`ALTER TABLE blog_sources ADD COLUMN notes TEXT DEFAULT ''`);
  await run(`CREATE TABLE IF NOT EXISTS blog_gen_log (
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
  )`);
}

/* ══════════════════════════════════════════════
   블로그 자동생성 API 라우터
   ══════════════════════════════════════════════ */
export async function blogGenRoute(request, url, env) {
  await initBlogGenDB(env.DB);
  const p = url.pathname;
  const m = request.method;

  /* ── 소스 목록 조회 ── */
  if (p === '/api/admin/blog-gen/sources' && m === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT id, type, url, title, word_count, category, priority, tags, notes, status, error_msg, created_at
       FROM blog_sources
       ORDER BY CASE coalesce(priority,'normal') WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, created_at DESC
       LIMIT 300`
    ).all();
    return ok({ sources: rows.results ?? [] });
  }

  /* ── 소스 추가 ── */
  if (p === '/api/admin/blog-gen/sources' && m === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { type, url: srcUrl, category, content: manualContent, title: manualTitle, priority, tags, notes } = body;
    if (!type || !['youtube', 'website', 'file'].includes(type)) {
      return bad('type must be youtube, website, or file');
    }
    /* URL 중복 방지 — 동일 URL이 이미 존재하면 거부 */
    if (srcUrl && (type === 'website' || type === 'youtube')) {
      const dup = await env.DB.prepare(
        'SELECT id FROM blog_sources WHERE url = ? LIMIT 1'
      ).bind(srcUrl.trim()).first();
      if (dup) return bad('이미 등록된 URL입니다: ' + srcUrl);
    }
    let title = manualTitle || '';
    let content = '';
    let wordCount = 0;
    let status = 'active';
    let errorMsg = '';
    try {
      if (type === 'website') {
        if (!srcUrl) return bad('url is required for website type');
        title = srcUrl;
        try {
          const r = await fetchWebsiteContent(srcUrl);
          title = r.title || srcUrl;
          content = r.content || '';
        } catch (webErr) {
          console.warn('[blog-gen] Website fetch failed, saving URL only:', webErr.message);
          errorMsg = '웹사이트 수집 실패: ' + webErr.message;
        }
      } else if (type === 'youtube') {
        if (!srcUrl) return bad('url is required for youtube type');
        title = srcUrl;
        const ytKey = await getSetting(env.DB, 'youtube_api_key').catch(() => '');
        if (ytKey) {
          try {
            const r = await fetchYouTubeContent(srcUrl, ytKey);
            title = r.title || srcUrl;
            content = r.content || '';
          } catch (ytErr) {
            console.warn('[blog-gen] YouTube fetch failed, saving URL only:', ytErr.message);
            errorMsg = 'YouTube 스크립트 수집 실패: ' + ytErr.message;
          }
        } else {
          console.warn('[blog-gen] YouTube API Key 미설정 — URL만 저장');
          errorMsg = 'YouTube API Key 미설정 — 스크립트 수집 불가, URL만 저장됨';
        }
      } else if (type === 'file') {
        if (!manualContent) return bad('content is required for file type');
        content = manualContent;
        title = manualTitle || 'Uploaded Document';
      }
      wordCount = content.split(/\s+/).filter(Boolean).length;
    } catch (e) {
      status = 'error';
      errorMsg = e.message;
    }
    const _priority = ['high', 'normal', 'low'].includes(priority) ? priority : 'normal';
    const _tags = (tags || '').trim();
    const _notes = (notes || '').trim();
    const ins = await env.DB.prepare(
      `INSERT INTO blog_sources (type, url, title, content, word_count, category, status, error_msg, priority, tags, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(type, srcUrl || '', title, content, wordCount, category || '', status, errorMsg, _priority, _tags, _notes).run();
    return ok({ success: true, id: ins.meta?.last_row_id, title, word_count: wordCount, status });
  }

  /* ── 소스 삭제 ── */
  const delM = p.match(/^\/api\/admin\/blog-gen\/sources\/(\d+)$/);
  if (delM && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM blog_sources WHERE id=?').bind(+delM[1]).run();
    return ok({ success: true });
  }

  /* ── 생성 이력 조회 ── */
  if (p === '/api/admin/blog-gen/logs' && m === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT gl.id, gl.post_id, gl.category, gl.focus_kw, gl.status,
              gl.seo_score, gl.error_msg, gl.duration_ms, gl.created_at,
              bp.title AS post_title, bp.slug AS post_slug
       FROM blog_gen_log gl
       LEFT JOIN blog_posts bp ON bp.id = gl.post_id
       ORDER BY gl.created_at DESC LIMIT 50`
    ).all();
    return ok({ logs: rows.results ?? [] });
  }

  /* ── OpenAI 토큰 상태 확인 ── */
  if (p === '/api/admin/blog-gen/token-status' && m === 'GET') {
    const result = await checkOpenAIToken(env);
    return ok(result);
  }

  /* ── 통계 ── */
  if (p === '/api/admin/blog-gen/stats' && m === 'GET') {
    const [total, todayRow, successRow, sourcesRow] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS cnt FROM blog_gen_log WHERE status='success'`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS cnt FROM blog_gen_log WHERE status='success' AND date(created_at)=date('now')`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS cnt FROM blog_gen_log`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS cnt FROM blog_sources WHERE status='active'`).first(),
    ]);
    const totalAll = successRow?.cnt || 0;
    const successCount = total?.cnt || 0;
    return ok({
      total_published: successCount,
      today: todayRow?.cnt || 0,
      success_rate: totalAll > 0 ? Math.round(successCount / totalAll * 100) : 0,
      active_sources: sourcesRow?.cnt || 0,
    });
  }

  /* ── 생성 규칙 AI 개선 ── */
  if (p === '/api/admin/blog-gen/improve-rules' && m === 'POST') {
    const { currentRules } = await request.json().catch(() => ({}));
    const key = await getSetting(env.DB, 'openai_api_key').catch(() => '');
    if (!key) return bad('OpenAI API key not configured in API Settings');
    const metaPrompt = `You are an expert SEO content strategist. Review and improve the blog generation rules below for achieving RankMath 90+ SEO scores on a cybersecurity blog.

Current custom rules:
${currentRules || '(none set)'}

The system already enforces these core requirements automatically — do NOT repeat them:
- Focus keyword in title, meta description, URL, first paragraph, at least one H2
- Keyword density 1.0–1.5% (max 2%)
- Content 1,500–2,000 words
- H2 + H3 heading structure (250+ words per H2, 60+ words per H3)
- External links to authoritative sources (auto-injected)
- Internal links to related posts (auto-injected)
- Image alt text includes focus keyword
- No personal names, brand promotion, or individually identifiable information
- No AI badges, icons, or decorative emojis in content body
- No empty HTML tags (<strong></strong> etc.)

Suggest 6–10 additional custom rules that will make the AI writer produce content that:
1. Feels natural and human-written (not robotic or formulaic)
2. Engages readers and reduces bounce rate
3. Avoids common AI writing patterns and filler phrases
4. Follows current Google Helpful Content guidelines
5. Stays relevant and practical for the site's cybersecurity audience

Return ONLY a bulleted list in English. Start each rule with "- ". No headers, no explanation, just the rules.`;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: metaPrompt }],
        max_tokens: 700,
        temperature: 0.75,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return bad(err?.error?.message || `OpenAI HTTP ${res.status}`);
    }
    const data = await res.json();
    const suggested = (data.choices?.[0]?.message?.content || '').trim();
    return ok({ success: true, suggested });
  }

  /* ── 블로그 생성 실행 ── */
  if (p === '/api/admin/blog-gen/run' && m === 'POST') {
    const body = await request.json().catch(() => ({}));
    const count = Math.min(Math.max(parseInt(body.count) || 1, 1), 5);
    const category = body.category || null;
    try {
      const generated = await runBlogGeneration(env, count, category);
      return ok({ success: true, generated, message: `${generated}개 블로그 포스트 생성 완료` });
    } catch (e) {
      return ok({ success: false, generated: 0, message: '생성 실패: ' + e.message });
    }
  }

  return null;
}

/* ══════════════════════════════════════════════
   블로그 생성 메인 파이프라인
   ══════════════════════════════════════════════ */
async function runBlogGeneration(env, count = 2, forcedCategory = null) {
  console.log(`[blog-gen] Start: count=${count}, category=${forcedCategory || 'auto'}`);

  /* OpenAI 토큰 확인 */
  const tokenStatus = await checkOpenAIToken(env);
  let useOpenAI = tokenStatus.valid;
  if (!tokenStatus.valid) {
    console.warn('[blog-gen] OpenAI token issue:', tokenStatus.error);
    await env.DB.prepare(
      `INSERT INTO blog_gen_log (category, status, error_msg) VALUES ('all', 'token_error', ?)`
    ).bind((tokenStatus.error || '').slice(0, 500)).run().catch(() => {});
    console.log('[blog-gen] Fallback: Workers AI only, SEO validation skipped');
  }

  /* 카테고리별 마지막 사용일 조회 */
  const lastUseRes = await env.DB.prepare(
    `SELECT category, MAX(created_at) as last_used
     FROM blog_gen_log WHERE status='success'
     GROUP BY category`
  ).all().catch(() => ({ results: [] }));
  const lastUsed = {};
  (lastUseRes.results ?? []).forEach((r) => {
    lastUsed[r.category] = r.last_used;
  });

  /* 활성 소스 목록 */
  const srcRes = await env.DB.prepare(
    `SELECT id, type, title, content, category, priority
     FROM blog_sources WHERE status='active' AND length(coalesce(content,'')) > 100
     ORDER BY CASE coalesce(priority,'normal') WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, RANDOM()`
  ).all().catch(() => ({ results: [] }));
  const allSources = srcRes.results ?? [];

  /* 카테고리 자동 선택 (중복 없는 카테고리 우선) */
  function pickNextCategory(usedThisBatch) {
    const candidates = CATEGORIES.filter((c) => !usedThisBatch.includes(c));
    const pool = candidates.length ? candidates : CATEGORIES;
    return pool.sort((a, b) => {
      const ta = lastUsed[a] || '1970-01-01';
      const tb = lastUsed[b] || '1970-01-01';
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    })[0];
  }

  let generated = 0;
  const usedCategories = [];
  for (let i = 0; i < count; i++) {
    let cat = forcedCategory;
    if (!cat) {
      cat = pickNextCategory(usedCategories);
    }
    usedCategories.push(cat);
    let catSources = allSources.filter((s) => !s.category || s.category === cat || s.category === '');
    if (!catSources.length) catSources = allSources;
    const logRes = await env.DB.prepare(
      `INSERT INTO blog_gen_log (category, status) VALUES (?, 'running')`
    ).bind(cat).run().catch(() => ({ meta: { last_row_id: 0 } }));
    const logId = logRes.meta?.last_row_id || 0;
    try {
      await generateSinglePost(env, cat, catSources, logId, useOpenAI);
      generated++;
    } catch (e) {
      console.error(`[blog-gen] Failed (category=${cat}):`, e.message);
      await env.DB.prepare(
        `UPDATE blog_gen_log SET status='failed', error_msg=? WHERE id=?`
      ).bind(e.message.slice(0, 500), logId).run().catch(() => {});
    }
  }
  console.log(`[blog-gen] Done. Generated ${generated}/${count}`);
  return generated;
}

/* ══════════════════════════════════════════════
   단일 포스트 생성
   ══════════════════════════════════════════════ */
async function generateSinglePost(env, category, sources, logId, useOpenAI) {
  const t0 = Date.now();

  /* 주제 + 포커스 키워드 */
  const topicSeeds = CAT_TOPICS[category] || CAT_TOPICS['malware-removal'];
  const topic = topicSeeds[Math.floor(Math.random() * topicSeeds.length)];
  const focusKw = topic.toLowerCase().replace(/\s+/g, ' ').trim();

  /* 소스 콘텐츠 준비 — 최소 3개 이상 소스 활용, 유튜브 스크립트 원문 명시 */
  let sourceContent = '';
  const sourceIds = [];
  if (sources.length) {
    const shuffled = [...sources].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.max(3, Math.min(sources.length, 5)));
    for (const s of picked) {
      sourceIds.push(s.id);
      const isYT = s.type === 'youtube';
      const label = isYT
        ? `[YouTube Transcript: ${s.title || 'Video'}] — 아래는 유튜브 영상의 원본 스크립트입니다. 이 스크립트를 다른 자료와 비교·대조하여 재구성하세요.`
        : `[Source: ${s.title || s.type}]`;
      const words = (s.content || '').split(/\s+/).slice(0, 600).join(' ');
      sourceContent += `${label}\n${words}\n\n---\n\n`;
    }
  }

  /* DB 설정 로드 */
  const customRules = await getSetting(env.DB, 'blog_gen_rules').catch(() => '');
  const writingStyle = await getSetting(env.DB, 'blog_writing_style').catch(() => '');

  /* Workers AI로 글 생성 */
  const prompt = buildGenerationPrompt(topic, category, focusKw, sourceContent, customRules, writingStyle);
  let aiRaw = await generateWithWorkersAI(env, prompt);
  let post = parseAIResponse(aiRaw);

  /* 파싱 실패 시 간단한 프롬프트로 재시도 */
  if (!post || !post.title || !post.content) {
    const simplePrompt = `Write a blog post about "${topic}" in the ${category} category. Focus keyword: "${focusKw}". Return ONLY a JSON object with these exact keys: title, content (HTML, 800-1200 words), excerpt, seo_title, seo_description, focus_keyword, keywords (array of 5).`;
    aiRaw = await generateWithWorkersAI(env, simplePrompt);
    post = parseAIResponse(aiRaw);
  }
  if (!post || !post.title || !post.content) {
    throw new Error('Workers AI returned unparseable response');
  }

  /* 한국어 감지 시 영어 전용 프롬프트로 재시도 */
  const _koreanRe = /[\uAC00-\uD7A3\u3131-\u318E\u1100-\u11FF]/;
  const _hasKorean = (s) => _koreanRe.test(s || '');
  if (_hasKorean(post.title) || _hasKorean(post.content)) {
    console.warn('[blog-gen] Korean detected — retrying with strict English-only prompt');
    const _enPrompt = `CRITICAL: Write ONLY in English. No Korean, no other language.
Write a blog post about "${topic}" in English. Focus keyword: "${focusKw}". Category: ${category}.
Return ONLY a JSON object: {"title":"English title","content":"HTML blog post in English only, 1000+ words","excerpt":"English excerpt","seo_title":"English SEO title","seo_description":"English meta description","focus_keyword":"${focusKw}","keywords":["kw1","kw2","kw3","kw4","kw5"],"img_alt_featured":"English alt text","img_alt_body":"English alt text"}`;
    const _enRaw = await generateWithWorkersAI(env, _enPrompt);
    const _enPost = parseAIResponse(_enRaw);
    if (_enPost && _enPost.title && !_hasKorean(_enPost.title)) {
      Object.assign(post, _enPost);
      console.log('[blog-gen] English retry succeeded');
    } else {
      console.warn('[blog-gen] English retry still has Korean — stripping Korean characters');
      post.title = (post.title || '').replace(_koreanRe, '').trim() || topic;
      post.content = (post.content || '').replace(/[\uAC00-\uD7A3\u3131-\u318E\u1100-\u11FF\s]+/g, ' ');
    }
  }

  /* 제목 중복 방지 (접두사 과다 사용 체크) */
  try {
    const existingTitles = await env.DB.prepare(
      `SELECT title FROM blog_posts WHERE title IS NOT NULL ORDER BY created_at DESC LIMIT 60`
    ).all().catch(() => ({ results: [] }));
    const prefixCount = {};
    for (const row of existingTitles.results ?? []) {
      const words = (row.title || '').trim().split(/\s+/);
      if (words.length >= 2) {
        const prefix = words[0].toLowerCase() + ' ' + words[1].toLowerCase();
        prefixCount[prefix] = (prefixCount[prefix] || 0) + 1;
      }
    }
    const ALT_OPENERS = [
      'Essential', 'Practical', 'Proven', 'Modern', 'Quick', 'Effective', 'Simple',
      'Key', 'Smart', 'Real-World', 'Core', 'Actionable', 'Beginner', 'Advanced',
      'Best', 'Ultimate', 'Expert', 'Direct',
    ];
    const titleWords = (post.title || '').trim().split(/\s+/);
    if (titleWords.length >= 2) {
      const prefix = titleWords[0].toLowerCase() + ' ' + titleWords[1].toLowerCase();
      if ((prefixCount[prefix] || 0) >= 3) {
        const usedOpeners = new Set(
          (existingTitles.results ?? []).map((r) => ((r.title || '').split(/\s+/)[0] || '').toLowerCase())
        );
        const fresh = ALT_OPENERS.find((o) => !usedOpeners.has(o.toLowerCase())) || ALT_OPENERS[Math.floor(Math.random() * ALT_OPENERS.length)];
        titleWords[0] = fresh;
        post.title = titleWords.join(' ');
        console.log(`[blog-gen] Title prefix "${prefix}" overused (${prefixCount[prefix]}x) — replaced with "${fresh}"`);
      }
    }
  } catch (_) {}

  /* 본문 단어 수 부족 시 확장 */
  const _wc0 = post.content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (_wc0 < 1400) {
    console.log(`[blog-gen] content only ${_wc0} words — expanding...`);
    post.content = await expandContent(env, post.content, focusKw, _wc0);
  }

  /* 키워드 밀도 조절 + 후처리 */
  post.content = enforceKeywordDensity(post.content, focusKw, 2);
  post.content = postProcessContent(post.content);

  /* Unsplash 이미지 2장 (featured + body) */
  const unsplashKey = await getSetting(env.DB, 'unsplash_access_key').catch(() => '');
  let featuredImg = '';
  let bodyImg = '';
  const FALLBACK_IMG = 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1080&q=80';
  const _usedRows = await env.DB.prepare(
    'SELECT featured_image, body_image FROM blog_posts WHERE featured_image IS NOT NULL OR body_image IS NOT NULL'
  ).all().catch(() => ({ results: [] }));
  const _usedUrls = new Set(
    _usedRows.results.flatMap((r) => [r.featured_image, r.body_image]).filter(Boolean).map((u) => u.split('?')[0])
  );
  if (unsplashKey) {
    try {
      const candidates = await fetchUnsplashImages(focusKw, unsplashKey, 8);
      const fresh = candidates.filter((u) => !_usedUrls.has(u.split('?')[0]));
      featuredImg = fresh[1] || fresh[0] || candidates[1] || candidates[0] || FALLBACK_IMG;
      bodyImg = fresh[0] || candidates[0] || FALLBACK_IMG;
      if (featuredImg === bodyImg && fresh.length >= 2) featuredImg = fresh[1];
    } catch (e) {
      console.warn('[blog-gen] Unsplash failed:', e.message);
      featuredImg = FALLBACK_IMG;
      bodyImg = FALLBACK_IMG;
    }
  } else {
    featuredImg = FALLBACK_IMG;
    bodyImg = FALLBACK_IMG;
  }

  /* 본문에 이미지 삽입 */
  if (bodyImg) {
    const _stripHtml = (s) => (s || '').replace(/<[^>]+>/g, '').trim();
    const _rawAlt = _stripHtml(post.img_alt_body || '');
    const imgAlt = _rawAlt.toLowerCase().includes(focusKw.toLowerCase()) ? _rawAlt : `${focusKw} — ${_rawAlt || focusKw}`;
    post.content = insertImageBeforeThirdH(post.content, bodyImg, imgAlt);
  }

  /* 외부 링크 + 내부 링크 삽입 */
  post.content = injectExternalLinks(post.content, category);
  post.content = await injectInternalLinks(post.content, env.DB);

  /* 요약/FAQ 테이블 추가 */
  const _countRow = await env.DB.prepare('SELECT COUNT(*) as c FROM blog_posts').first().catch(() => null);
  const _tableType = (_countRow?.c || 0) % 2 === 0 ? 'summary' : 'qa';
  const _summaryTable = buildSummaryTable(post.content, _tableType);
  if (_summaryTable) post.content += _summaryTable;
  console.log(`[blog-gen] Appended ${_tableType} table`);

  /* OpenAI SEO 검증 */
  if (useOpenAI) {
    try {
      const seoResult = await validateWithOpenAI(env, post.title, post.content, focusKw);
      if (seoResult.seo_title) post.seo_title = seoResult.seo_title;
      if (seoResult.seo_description) post.seo_description = seoResult.seo_description;
      if (seoResult.keywords?.length) post.keywords = seoResult.keywords;
    } catch (e) {
      console.warn('[blog-gen] OpenAI SEO refinement failed:', e.message);
    }
  }

  /* Meta Description 길이 보정 */
  if (post.seo_description) {
    let md = post.seo_description.trim();
    if (md.length < 140) {
      const kwAppend = ` Learn more about ${focusKw} today.`;
      const kwAppend2 = ` Discover practical ${focusKw} tips now.`;
      if (md.length + kwAppend.length <= 160) md += kwAppend;
      else if (md.length + kwAppend2.length <= 160) md += kwAppend2;
      else md += ' Find out how today.';
      md = md.slice(0, 160);
    } else if (md.length > 160) {
      md = md.slice(0, 157) + '...';
    }
    post.seo_description = md;
  }

  /* Slug 생성 + 중복 체크 */
  let slug = toSlug(post.title);
  const existingSlug = await env.DB.prepare('SELECT id FROM blog_posts WHERE slug=?').bind(slug).first().catch(() => null);
  if (existingSlug) slug = slug + '-' + Date.now().toString(36);

  /* SEO 점수 계산 */
  let realSeoScore = computeRealSeoScore(post, focusKw, slug);

  /* ── SEO 90점 미만이면 1회 재생성 시도 ── */
  if (realSeoScore < 90 && useOpenAI) {
    console.log(`[blog-gen] SEO score ${realSeoScore} < 90 — attempting regeneration...`);
    try {
      const retryPrompt = buildGenerationPrompt(topic, category, focusKw, sourceContent, customRules, writingStyle);
      const retryRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a professional SEO blog writer. Your previous attempt scored ' + realSeoScore + '/100. This time you MUST score 90+. Pay extra attention to: keyword density 1-2%, focus keyword in title/H2/first paragraph/meta description, at least 5 H2 and 2 H3 headings, 1500-2000 words, 140-160 char meta description.' },
            { role: 'user', content: retryPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });
      const retryData = await retryRes.json();
      const retryText = retryData.choices?.[0]?.message?.content || '';
      const retryJson = JSON.parse(retryText.replace(/```json\s*/gi, '').replace(/```/g, '').trim());
      if (retryJson.title && retryJson.content) {
        /* 후처리 적용 */
        retryJson.content = enforceKeywordDensity(retryJson.content, focusKw, 2);
        retryJson.content = postProcessContent(retryJson.content);
        if (bodyImg) {
          const _stripH = (s) => (s || '').replace(/<[^>]+>/g, '').trim();
          const _rAlt = _stripH(retryJson.img_alt_body || '');
          const iAlt = _rAlt.toLowerCase().includes(focusKw.toLowerCase()) ? _rAlt : `${focusKw} — ${_rAlt || focusKw}`;
          retryJson.content = insertImageBeforeThirdH(retryJson.content, bodyImg, iAlt);
        }
        retryJson.content = injectExternalLinks(retryJson.content, category);
        retryJson.content = await injectInternalLinks(retryJson.content, env.DB);
        const _rt = buildSummaryTable(retryJson.content, 'summary');
        if (_rt) retryJson.content += _rt;
        const retryScore = computeRealSeoScore(retryJson, focusKw, slug);
        console.log(`[blog-gen] Retry SEO score: ${retryScore} (was ${realSeoScore})`);
        if (retryScore > realSeoScore) {
          post.title = retryJson.title;
          post.content = retryJson.content;
          post.excerpt = retryJson.excerpt || post.excerpt;
          post.seo_title = retryJson.seo_title || post.seo_title;
          post.seo_description = retryJson.seo_description || post.seo_description;
          post.keywords = retryJson.keywords || post.keywords;
          realSeoScore = retryScore;
          slug = toSlug(post.title);
          const existSlug2 = await env.DB.prepare('SELECT id FROM blog_posts WHERE slug=?').bind(slug).first().catch(() => null);
          if (existSlug2) slug = slug + '-' + Date.now().toString(36);
          console.log(`[blog-gen] Using retry version: SEO=${retryScore}`);
        }
      }
    } catch (retryErr) {
      console.warn('[blog-gen] Retry generation failed:', retryErr.message);
    }
  }

  /* DB 저장 */
  const ins = await env.DB.prepare(
    `INSERT INTO blog_posts
     (title, slug, excerpt, content, featured_image, body_image, category, tags,
      seo_title, seo_description, seo_score, focus_keyword, status, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', datetime('now'), datetime('now'), datetime('now'))`
  ).bind(
    post.title, slug, post.excerpt || '', post.content,
    featuredImg, bodyImg, category, (post.keywords || []).join(','),
    post.seo_title || post.title, post.seo_description || post.excerpt || '', realSeoScore, focusKw,
  ).run();
  const postId = ins.meta?.last_row_id;

  /* KV 캐시 무효화 (있으면) */
  try { if (env.KV) { env.KV.delete('c:blog:posts').catch(() => {}); env.KV.delete('c:blog:settings').catch(() => {}); } } catch (_) {}

  /* 생성 이력 업데이트 */
  const duration = Date.now() - t0;
  await env.DB.prepare(
    `UPDATE blog_gen_log
     SET post_id=?, source_ids=?, focus_kw=?, status='success', seo_score=?, duration_ms=?
     WHERE id=?`
  ).bind(postId, sourceIds.join(','), focusKw, realSeoScore, duration, logId).run().catch(() => {});
  console.log(`[blog-gen] Created: "${post.title}" | SEO=${realSeoScore}/100 | ${duration}ms`);
}

/* ══════════════════════════════════════════════
   프롬프트 빌더
   ══════════════════════════════════════════════ */
function buildGenerationPrompt(topic, category, focusKw, sourceContent, customRules, writingStyle) {
  const srcSection = sourceContent
    ? `══ REFERENCE MATERIAL (참고 자료) ══

🚨 CRITICAL ORIGINALITY RULES — ZERO TOLERANCE FOR COPYING:
1. COMPLETELY TRANSFORM every sentence from the source material — change EVERY word, phrase, and sentence structure without exception
2. Do NOT copy ANY phrase from the sources — not even casual expressions like "it is important to", "you should", "one of the most common"
3. Extract FACTS, numbers, and technical concepts ONLY — then express them entirely in your own original voice using completely different words
4. Imagine you read all sources 2 weeks ago and are now writing purely from memory — you are NOT looking at them while writing
5. If a sentence could appear verbatim in any source material, DELETE it and rewrite from scratch with completely different wording
6. Synthesize and combine information from ALL sources to create unique perspectives not found in any single source
7. TARGET: final content must share less than 15% word-level similarity with any single source

🎯 TARGET AUDIENCE:
- WordPress intermediate users (1–3 years of hands-on experience)
- They know: plugin installation, dashboard navigation, basic settings, adding themes
- They do NOT know: server-level commands, PHP code, advanced hosting, CLI tools
- Write AS IF explaining to a smart colleague who uses WordPress regularly but is NOT a developer

📖 WRITING LEVEL (고등학교 1학년 수준 — Korean High School Freshman equivalent):
- Use simple, everyday vocabulary — if a technical term is unavoidable, IMMEDIATELY explain it in plain words in the SAME sentence
- Keep sentences SHORT: 15–20 words maximum per sentence
- ONE idea per sentence. ONE main concept per paragraph.
- Replace technical jargon with plain words: "malicious code" → "harmful code planted by hackers", "vulnerability" → "security weak point", "authentication" → "login verification step"
- Write as if explaining to a 15-year-old who is smart and curious but has no technical background
- No academic phrasing — be direct, friendly, and practical

SOURCE MATERIAL (extract facts only — COMPLETELY transform ALL expressions, DO NOT copy any phrase):
${sourceContent.slice(0, 5000)}`
    : `Write based on your knowledge about: ${topic}.
🎯 TARGET AUDIENCE: WordPress intermediate users (1–3 years experience, knows plugin installation and dashboard use, but not server-level or coding concepts).
📖 WRITING LEVEL: Simple and accessible — Korean high school freshman equivalent. Short sentences (15–20 words max), plain vocabulary, explain every technical term in plain words when first used.`;
  const rulesSection = customRules && customRules.trim()
    ? `\nBASE WRITING REFERENCE (core style guidelines — apply to every sentence and paragraph):\n${customRules.trim()}\n` : '';
  const styleSection = writingStyle && writingStyle.trim()
    ? `\nWRITING STYLE & TONE (apply throughout the entire post):\n${writingStyle.trim()}\n` : '';

  return `You are an expert English content writer. Write a complete, SEO-optimized blog post targeting a RankMath score of 90+.

LANGUAGE RULE (ABSOLUTE — ZERO EXCEPTIONS):
- The ENTIRE post MUST be written in ENGLISH ONLY — title, content, headings, excerpt, seo_title, seo_description, all fields
- NEVER write in Korean, Japanese, Chinese, or any other language
- If the topic appears to be in another language, write about it in English anyway
- ALL JSON field values must be in English

TOPIC: "${topic}"
CATEGORY: ${category}
FOCUS KEYWORD: "${focusKw}"

═══ WORD COUNT (ABSOLUTE REQUIREMENT) ═══
- The content field MUST contain at least 1,500 words of visible text (count only words, not HTML tags)
- Target: 1,600 – 2,000 words. Falling below 1,500 words is a FAILURE.
- To reach 1,600 words: write EXACTLY 7 <h2> sections — each H2 block contributes ~200 words
- Tone: professional, clear, practical — Grade 10 reading level

═══ HTML STRUCTURE (STRICTLY ENFORCED) ═══
- Allowed tags ONLY: <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>, <blockquote>
- NEVER include <h1> tags — the page title is already H1
- NEVER include <script>, <style>, <svg>, <i>, <span>, <div>, <img>, <a> tags — these are injected separately
- NEVER include icon elements, emoji icons, badge labels, or decorative HTML elements
- REQUIRED structure — EXACTLY 7 <h2> sections (follow this pattern):
    <p>intro paragraph — 80–100 words, includes focus keyword naturally</p>
    <h2>Section 1 Title [includes focus keyword]</h2>
      <p>direct paragraph — 4+ lines, 80–100 words directly under H2 before any H3</p>
      <h3>Subsection 1.1</h3><p>…80+ words…</p>
    <h2>Section 2 Title</h2>
      <p>direct paragraph — 4+ lines, 80–100 words directly under H2</p>
      <h3>Subsection 2.1</h3><p>…80+ words…</p>
    <h2>Section 3 Title</h2>
      <p>direct paragraph — 4+ lines, 80–100 words directly under H2</p>
      <h3>Subsection 3.1</h3><p>…80+ words…</p>
    <h2>Section 4 Title</h2>
      <p>direct paragraph — 4+ lines, 80–100 words directly under H2</p>
      <h3>Subsection 4.1</h3><p>…80+ words…</p>
    <h2>Section 5 Title</h2>
      <p>direct paragraph — 4+ lines, 80–100 words directly under H2</p>
      <p>second paragraph — additional 60–80 words with practical detail</p>
    <h2>Section 6 Title</h2>
      <p>direct paragraph — 4+ lines, 80–100 words directly under H2</p>
      <p>second paragraph — additional 60–80 words</p>
    <h2>Section 7 Title</h2>
      <p>direct paragraph — 4+ lines, 80–100 words directly under H2</p>
      <p>second paragraph — additional 60–80 words</p>
    <p>conclusion paragraph — 60–80 words</p>
- CRITICAL: Every <h2> MUST be followed IMMEDIATELY by a direct <p> paragraph (80+ words, 4+ lines) before any <h3>
- FORBIDDEN: <h2>Heading</h2><h3>Sub</h3> — H2 must NEVER jump directly to H3 without a paragraph
- FORBIDDEN: <h2>Heading</h2><p>One sentence.</p> — all H2 direct paragraphs must be 4+ lines
- FORBIDDEN: two heading tags with fewer than 40 words between them

═══ EMPTY TAG RULE (CRITICAL — zero tolerance) ═══
- NEVER produce empty HTML tags of any kind
- <strong></strong>  ← STRICTLY FORBIDDEN
- <em></em>          ← STRICTLY FORBIDDEN
- <h2></h2>          ← STRICTLY FORBIDDEN
- <h3></h3>          ← STRICTLY FORBIDDEN
- Every tag must contain actual text. If you bold a phrase, write the full phrase inside <strong>.
- Correct: <strong>${focusKw}</strong>
- Wrong:   <strong></strong>

═══ FOCUS KEYWORD PLACEMENT (STRICTLY ENFORCED) ═══
- MUST appear in the very first <p> (intro paragraph) within the first 50 words — written naturally
- MUST appear in the title field
- MUST appear in at least one <h2> heading (verbatim or closely paraphrased)
- MUST appear at least once in each major section (once per <h2> block)
- Total occurrences in content body: 4–5 times (density ≈ 0.8% – 1.5% of total word count)
- Do NOT repeat the full keyword more than once per paragraph
- When bolding the keyword with <strong>, always write the full keyword text inside

═══ SEO FIELDS ═══
- title: 50–60 characters, includes focus keyword, includes ONE power word — rotate variety: (Guide, Tips, How to, Step-by-Step, Fix, Essential, Practical, Proven, Modern, Quick, Effective, Simple, Key, Smart, Core, Actionable, Beginner, Best, Expert)
- NEVER start the title with "Complete Guide" — this phrase is overused. Choose a different opening that is specific and varied.
- seo_title: 50–60 characters, optimized variation of title
- seo_description: EXACTLY 140–160 characters — includes focus keyword — ends with a call to action (e.g. "Learn more.", "Start today.", "Find out how.")
- excerpt: 120–160 characters, compelling, includes focus keyword
- img_alt_featured: describe the image AND include the focus keyword phrase
- img_alt_body: describe the image AND include the focus keyword phrase

═══ PRIVACY & NEUTRALITY RULES (STRICTLY ENFORCED) ═══
- NEVER mention any real person's name, personal identity, or individual attribution
- NEVER promote, advertise, or endorse any specific brand, product, company, or commercial service by name
- NEVER include personally identifiable information of any kind
- Write general, educational content only — no case studies tied to specific named individuals or companies
- Exception: you may reference well-known platform categories (e.g. "WordPress", "Google Search Console") only as tools, not endorsements

═══ CLEAN CONTENT RULES ═══
- No AI-generated labels, badges, or indicators (do not write "AI Generated", "Written by AI", etc.)
- No decorative emojis or icon characters in the content body
- No inline CSS style attributes — content is styled by the site's stylesheet
- No unnecessary filler phrases like "In conclusion, it is worth noting that..."
- Every sentence must add real informational value

═══ H2 HEADING RULES (CRITICAL) ═══
- H2 headings must be SHORT, SPECIFIC, and DESCRIPTIVE (4–8 words max)
- NEVER start an H2 with the full focus keyword phrase — headings must be original titles, not keyword repetition
- FORBIDDEN H2 pattern: "<h2>focus-keyword: Some Suffix</h2>" — do NOT prefix headings with the keyword
- FORBIDDEN: Generic boilerplate headings like "Getting Started", "Before You Begin", "Advanced Tips", "Key Takeaways", "Everything You Need to Know" unless they contain specific topical content
- FORBIDDEN: Two consecutive H2 headings with nearly identical meaning or structure
- Each H2 heading must describe what that specific section teaches — make it unique and topically meaningful

═══ HUMAN AUTHENTICITY — ZERO AI FINGERPRINTS ═══

BANNED WORDS — never use any of these (they are the strongest AI tells):
  delve, leverage, utilize, robust, seamless, streamline, navigate, realm, landscape,
  ecosystem, paradigm, synergy, empower, harness, cutting-edge, game-changer,
  comprehensive, paramount, shed light on, foster, curated, nuanced, holistic,
  underscores, it is crucial, it is vital, it is important to note, it's worth mentioning,
  as we explore, let's dive in, in today's digital world, in the realm of, going forward

BANNED PARAGRAPH OPENERS — never start a paragraph with:
  "In today's...", "In the world of...", "When it comes to...",
  "It's important to understand...", "One of the most important/common/critical...",
  "First and foremost...", "Last but not least...", "Without a doubt...",
  "In this article/section/guide..."

ANTI-AI WRITING TECHNIQUES — apply ALL of these:

1. MID-THOUGHT STARTS: At least 2 paragraphs per post must open with a concrete scenario or example FIRST — state the main point AFTER. Example: "Picture this: your contact form looks completely normal. No alerts. No warnings. But behind the scenes, a bot has already submitted 300 spam entries in two hours." — then explain the takeaway. Do NOT open every paragraph with a topic sentence.

2. NATURAL LIST IMPERFECTION: In any bulleted or numbered list, deliberately make at least 2 items slightly different in length or grammatical form from the others — perfectly parallel lists are a strong AI signal.

3. CONTRACTION RULE: Use "don't", "it's", "you'll", "there's", "isn't", "won't", "that's", "can't" throughout. NEVER write "do not", "it is", "you will", "there is" more than twice per 500 words.

4. CONVERSATIONAL INTERJECTION: Add exactly one natural aside per post — such as: "Here's the thing:", "The catch is this:", "This part actually matters:", "Fair warning:", "Here's what's easy to miss:" — placed where the writing needs a natural beat.

5. IMPERFECT TRANSITIONS — replace all formal connectors:
   "Furthermore," → "And that's exactly why..." or "Which connects to..."
   "Moreover," → "There's also this:" or "Worth adding:"
   "In addition," → "On top of that," or "There's more:"
   "However," → "But here's the thing —" or "That said,"
   "In conclusion," → "Bottom line:" or "The short version:"

6. ONE MILD CAVEAT per post: Include one honest limitation — "This won't fix everything — but it covers the cases that matter most." or "Results vary depending on your setup, but the approach stays the same."

7. NO SECTION SUMMARIES: Never end a section with "In summary...", "As we've seen...", "To recap..." — end on the final practical point and move on.

8. SENTENCE PUNCH PAIRS: After two medium-length sentences, write two SHORT sentences back-to-back (6–10 words each) for emphasis. This is how real writers land a point.

9. ONE LONGER NATURAL SENTENCE per H2 is allowed — if the idea genuinely needs room (32–40 words), keep it. Don't force splits when the thought flows naturally as one.

═══ SENTENCE & WRITING STYLE RULES (STRICTLY ENFORCED) ═══
- AUDIENCE: WordPress intermediate users (1–3 years). They use dashboards, install plugins, but are NOT developers or server admins.
- READING LEVEL: Korean high school freshman (고등학교 1학년) equivalent — simple, clear, zero jargon without immediate explanation.
- PRIMARY sentence length: 15–20 words. This is the default. Keep it short and punchy.
- MAXIMUM sentence length: 40 words hard cap — split any sentence that exceeds this.
- AVOID academic or overly formal phrasing — be conversational, direct, and practical.
- Explain every technical term in plain words the FIRST time you use it, inside the same sentence. Example: "malware (harmful software that attackers secretly install on your site)"
- Vary rhythm within each paragraph: mix of medium → short → medium, or long → short → short. Never write three sentences of the same length back-to-back.
- Use these sentence patterns to create confident, readable prose:
  • Corrective opener:   "It's not about X — it's about Y."
  • Moment capture:      "There's a moment when [situation] — and that's when [insight] matters."
  • Concede and pivot:   "True, X has its place. But consider this:"
  • Grounded question:   Pose a short question, then answer it immediately in the next sentence.
  • Reader observation:  "Most people assume X. In practice, Y is closer to the truth."
  • Punch pair:          [medium sentence]. [8-word max]. [8-word max].
- NEVER open every paragraph with a topic sentence — mix in scenario-first and question-first openings.
- Cut all filler: "furthermore", "moreover", "it is worth noting", "needless to say", "it goes without saying" — replace with direct statements.
- Prefer active voice. Write "the plugin updates the cache" not "the cache is updated by the plugin".
- VOCABULARY: Replace technical jargon wherever possible. Examples: "exploit" → "take advantage of a weak point", "vulnerability" → "security gap", "authentication" → "login check", "malicious" → "harmful", "mitigate" → "reduce", "implement" → "set up", "configure" → "adjust the settings".

═══ LINK & TABLE RULES ═══
- All links (external and internal) must use the same color as surrounding body text — NEVER yellow, NEVER colored
- All links must have NO underline — they should be invisible from surrounding text unless hovered
- Summary/FAQ table at the bottom: maximum 4 data rows, all text in English only
- Table header and column labels must be in English (e.g. Topic/Summary, Question/Answer)
${styleSection}${rulesSection}
${srcSection}

Respond ONLY with a single valid JSON object. No markdown fences, no explanation before or after the JSON.
{"title":"title 50-60 chars with focus keyword + power word","content":"complete HTML blog post 1500-2000 words","excerpt":"120-160 char excerpt with focus keyword","seo_title":"50-60 char SEO title","seo_description":"140-160 char meta description ending with CTA","focus_keyword":"${focusKw}","keywords":["kw1","kw2","kw3","kw4","kw5"],"img_alt_featured":"image description WITH focus keyword","img_alt_body":"image description WITH focus keyword"}`;
}

/* ══════════════════════════════════════════════
   Workers AI 글 생성
   ══════════════════════════════════════════════ */
async function generateWithWorkersAI(env, prompt) {
  const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      { role: 'system', content: 'You are an expert blog writer. Always respond with valid JSON only. No markdown fences, no explanation, no text before or after the JSON object.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 8192,
    temperature: 0.7,
  });
  const raw = result.response;
  if (!raw) return '';
  if (typeof raw === 'object') return JSON.stringify(raw);
  return String(raw);
}

/* ── AI 응답 JSON 파서 ── */
function parseAIResponse(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); }
  catch { return null; }
}

/* ══════════════════════════════════════════════
   OpenAI SEO 검증
   ══════════════════════════════════════════════ */
async function validateWithOpenAI(env, title, content, focusKw) {
  const key = await getSetting(env.DB, 'openai_api_key').catch(() => '');
  if (!key) return { score: null };
  const wordCount = content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  const excerpt = content.replace(/<[^>]*>/g, ' ').slice(0, 500);
  const prompt = `You are an SEO expert. Evaluate this blog post. Return ONLY valid JSON, no extra text.

Title: "${title}"
Focus Keyword: "${focusKw}"
Word Count: ${wordCount}
Content excerpt: ${excerpt}

Score 0-100:
- Focus keyword in title (20pts)
- Focus keyword in first 100 words (20pts)
- Word count 1500+ (20pts)
- Meta description quality (20pts)
- Keyword relevance & density (20pts)

Respond ONLY with:
{"score":85,"seo_title":"optimized title 50-60 chars","seo_description":"meta desc 140-160 chars","keywords":["kw1","kw2","kw3","kw4","kw5"]}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI HTTP ${res.status}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '{}';
  try { return JSON.parse(raw.replace(/```json|```/g, '').trim()); }
  catch { return { score: null }; }
}

/* ── OpenAI 토큰 상태 체크 ── */
async function checkOpenAIToken(env) {
  const key = await getSetting(env.DB, 'openai_api_key').catch(() => '');
  if (!key) return { valid: false, error: 'OpenAI API key not configured', code: 'no_key' };
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      }),
    });
    if (res.ok) return { valid: true };
    const errData = await res.json().catch(() => ({}));
    const code = errData?.error?.code || '';
    const msg = errData?.error?.message || `HTTP ${res.status}`;
    return { valid: false, error: msg, code };
  } catch (e) {
    return { valid: false, error: 'Network error: ' + e.message, code: 'network' };
  }
}

/* ══════════════════════════════════════════════
   키워드 밀도 조절
   ══════════════════════════════════════════════ */
function enforceKeywordDensity(content, keyword, maxPct) {
  const text = content.replace(/<[^>]*>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean);
  const totalWords = words.length;
  if (!totalWords || !keyword) return content;
  const kwWords = keyword.split(/\s+/).length;
  const matches = text.toLowerCase().split(keyword.toLowerCase()).length - 1;
  const density = matches * kwWords / totalWords * 100;
  if (density <= maxPct) return content;
  const maxOccurrences = Math.max(3, Math.floor(totalWords * 0.015 / kwWords));
  let count = 0;
  const kw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `(?:<(?:strong|em)>\\s*)?${kw}(?:\\s*<\\/(?:strong|em)>)?`, 'gi'
  );
  return content.replace(regex, (m) => {
    count++;
    return count <= maxOccurrences ? m : '';
  });
}

/* ══════════════════════════════════════════════
   콘텐츠 확장 (단어 수 부족 시)
   ══════════════════════════════════════════════ */
async function expandContent(env, content, focusKw, currentWc) {
  try {
    const shortSections = [];
    /* H2 아래 직접 본문이 짧은 섹션 찾기 */
    const h2Re = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h[2-3]|$)/gi;
    let m2;
    while ((m2 = h2Re.exec(content)) !== null) {
      const title = m2[1].replace(/<[^>]*>/g, '').trim();
      const directBody = m2[2].replace(/<h3[\s\S]*$/, '').trim();
      const bodyWc = directBody.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
      if (bodyWc < 80 && title.length > 3) {
        shortSections.push({ tag: 'h2', title, matchEnd: m2.index + `<h2>${m2[1]}</h2>`.length });
      }
    }
    /* H3 아래 본문이 짧은 섹션 찾기 */
    const sectionRe = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h[2-6]|$)/gi;
    let m;
    while ((m = sectionRe.exec(content)) !== null) {
      const title = m[1].replace(/<[^>]*>/g, '').trim();
      const body = m[2];
      const bodyWc = body.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
      if (bodyWc < 80 && title.length > 3) {
        shortSections.push({ tag: 'h3', title, index: m.index, fullLen: m[0].length });
      }
    }
    /* 짧은 섹션이 없으면 일반 확장 */
    if (shortSections.length === 0) {
      const h3Titles = (content.match(/<h3[^>]*>([\s\S]*?)<\/h3>/gi) || []).map((h) => h.replace(/<[^>]*>/g, '').trim()).slice(0, 4).join('; ');
      const raw2 = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          { role: 'system', content: 'Return only <p> HTML paragraphs. No headings, no JSON, no markdown.' },
          { role: 'user', content: `Write 4 additional <p> paragraphs (each 110–130 words) expanding on "${focusKw}". Subtopics covered: ${h3Titles}. Add new practical details not yet covered. Mention "${focusKw}" once naturally. Return ONLY <p> tags.` },
        ],
        max_tokens: 1800,
        temperature: 0.65,
      });
      let extra2 = (raw2?.response || '').trim().replace(/^```html?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      if (!extra2) return content;
      if (!/<p[^>]*>/i.test(extra2)) {
        extra2 = extra2.split(/\n\n+/).filter((t) => t.trim().length > 30).map((t) => `<p>${t.trim()}</p>`).join('\n');
      }
      const lastP = content.lastIndexOf('<p>');
      content = lastP > 0 ? content.slice(0, lastP) + extra2 + '\n' + content.slice(lastP) : content + '\n' + extra2;
      const nwc = content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
      console.log(`[blog-gen] expanded (general) ${currentWc} → ${nwc} words`);
      return content;
    }
    /* 타겟 섹션별 확장 */
    const targets = shortSections.slice(0, 5);
    const sectionList = targets.map((s, i) => `${i + 1}. "${s.title}"`).join('\n');
    const raw = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: 'You are a blog writer. Return exactly the requested number of <p> paragraphs in order. No headings, no JSON, no extra text.' },
        { role: 'user', content: `For each numbered topic below, write ONE detailed <p> paragraph (110–130 words each) with practical tips related to "${focusKw}". Return ONLY the <p> tags, in the same numbered order:\n${sectionList}\n\nOutput format:\n<p>1: ...</p>\n<p>2: ...</p>\n...` },
      ],
      max_tokens: 1800,
      temperature: 0.65,
    });
    let extra = (raw?.response || '').trim().replace(/^```html?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    if (!extra) return content;
    const newParas = (extra.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []).map((p) => p.replace(/<p([^>]*)>\s*\d+[.:]\s*/i, '<p$1>'));
    let result = content;
    for (let i = 0; i < Math.min(newParas.length, targets.length); i++) {
      const s = targets[i];
      const para = newParas[i];
      if (!para) continue;
      const escapedTitle = s.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const hRe = new RegExp(`<${s.tag}[^>]*>${escapedTitle}<\\/${s.tag}>`, 'i');
      const match = hRe.exec(result);
      if (match) {
        const insertAt = match.index + match[0].length;
        result = result.slice(0, insertAt) + '\n' + para + '\n' + result.slice(insertAt);
      }
    }
    const newWc = result.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    console.log(`[blog-gen] expanded (targeted) ${currentWc} → ${newWc} words`);
    return result;
  } catch (e) {
    console.warn('[blog-gen] expandContent failed:', e.message);
    return content;
  }
}

/* ══════════════════════════════════════════════
   이미지 삽입 (H2 세 번째 앞에)
   ══════════════════════════════════════════════ */
function insertImageBeforeThirdH(content, imgUrl, altText, minWordsBeforeImg = 400) {
  const imgFigure = `<figure style="margin:32px 0;"><img src="${imgUrl}" alt="${altText}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;display:block;" loading="lazy"/><figcaption style="text-align:center;font-size:13px;color:#6b7280;margin-top:8px;">${altText}</figcaption></figure>`;
  let wordsSoFar = 0;
  let inserted = false;
  return content.replace(/(<h[2-6][^>]*>)/gi, (m, hTag, offset) => {
    if (inserted) return hTag;
    const before = content.slice(0, offset);
    wordsSoFar = before.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    if (wordsSoFar >= minWordsBeforeImg) {
      inserted = true;
      return imgFigure + hTag;
    }
    return hTag;
  });
}

/* ── 요약/FAQ 테이블 ── */
function buildSummaryTable(html, tableType) {
  const sections = [];
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html)) !== null && sections.length < 4) {
    const heading = m[1].replace(/<[^>]*>/g, '').trim();
    const paraText = m[2].replace(/<[^>]*>/g, '').trim();
    const sentence = (paraText.match(/^[^.!?]+[.!?]/) || [paraText.slice(0, 160)])[0].trim();
    if (heading && sentence) sections.push({ heading, sentence });
  }
  if (sections.length < 2) return '';
  if (tableType === 'summary') {
    const rows = sections.map(
      (s) => `<tr><td><strong>${s.heading}</strong></td><td>${s.sentence}</td></tr>`
    ).join('');
    return `\n<h2>Key Takeaways</h2>\n<div class="summary-table-wrap"><table class="summary-table"><thead><tr><th>Topic</th><th>Summary</th></tr></thead><tbody>${rows}</tbody></table></div>\n`;
  } else {
    const rows = sections.map((s) => {
      const q = /[?？]$/.test(s.heading) ? s.heading : s.heading + '?';
      return `<tr><td><strong>${q}</strong></td><td>${s.sentence}</td></tr>`;
    }).join('');
    return `\n<h2>Frequently Asked Questions</h2>\n<div class="summary-table-wrap"><table class="summary-table"><thead><tr><th>Question</th><th>Answer</th></tr></thead><tbody>${rows}</tbody></table></div>\n`;
  }
}

/* ── HTML 후처리 ── */
function postProcessContent(content) {
  return content
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '')
    .replace(/<h[2-6][^>]*>\s*<\/h[2-6]>/gi, '')
    .replace(/<strong>\s*<\/strong>/gi, '')
    .replace(/<em>\s*<\/em>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1')
    .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    .replace(/<i[^>]*>[\s\S]*?<\/i>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<a\s[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/\s+style="[^"]*"/gi, '')
    .replace(/(<\/p>)\s{2,}(<p)/gi, '$1\n$2')
    .trim();
}

/* ── 외부 권위 링크 삽입 ── */
function injectExternalLinks(content, category) {
  const refs = CAT_EXTERNAL_REFS[category] || CAT_EXTERNAL_REFS['malware-removal'];
  if (!refs || !refs.length) return content;
  const half = Math.floor(content.length / 2);
  const insertPoint = content.lastIndexOf('</p>', half);
  if (insertPoint === -1) return content;
  const [url1, label1] = refs[0];
  const [url2, label2] = refs[1] || refs[0];
  const refBlock = `\n<p>For further reading, refer to the <a href="${url1}" rel="noopener noreferrer" target="_blank">${label1}</a> and <a href="${url2}" rel="noopener noreferrer" target="_blank">${label2}</a>.</p>`;
  return content.slice(0, insertPoint + 4) + refBlock + content.slice(insertPoint + 4);
}

/* ── 내부 링크 삽입 ── */
async function injectInternalLinks(content, DB) {
  try {
    const res = await DB.prepare(
      `SELECT title, slug FROM blog_posts WHERE status='published' ORDER BY RANDOM() LIMIT 4`
    ).all().catch(() => ({ results: [] }));
    const posts = (res.results || []).slice(0, 2);
    if (!posts.length) return content;
    const listItems = posts.map((p) => `<li><a href="/blog-post.html?slug=${encodeURIComponent(p.slug)}">${p.title}</a></li>`).join('');
    const relatedBlock = `\n<h2>Related Articles</h2>\n<ul>${listItems}</ul>`;
    const lastP = content.lastIndexOf('</p>');
    if (lastP === -1) return content + relatedBlock;
    return content.slice(0, lastP + 4) + relatedBlock + content.slice(lastP + 4);
  } catch { return content; }
}

/* ══════════════════════════════════════════════
   SEO 점수 계산 (RankMath 기준 0-100)
   ══════════════════════════════════════════════ */
function computeRealSeoScore(post, focusKw, slug) {
  let score = 0;
  const kw = (focusKw || '').toLowerCase();
  const title = (post.title || '').toLowerCase();
  const seoT = (post.seo_title || '').toLowerCase();
  const metaD = post.seo_description || '';
  const metaDl = metaD.toLowerCase();
  const raw = post.content || '';
  const text = raw.replace(/<[^>]*>/g, ' ').toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wc = words.length;

  if (kw && title.includes(kw)) score += 5;
  if (kw && seoT.includes(kw)) score += 5;
  if (kw && metaDl.includes(kw)) score += 5;
  const kwSlug = kw.replace(/\s+/g, '-');
  if (kw && slug.includes(kwSlug)) score += 5;
  if (kw && words.slice(0, 100).join(' ').includes(kw)) score += 5;

  const headingText = (raw.match(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/gi) || []).map((h) => h.replace(/<[^>]*>/g, '')).join(' ').toLowerCase();
  if (kw && headingText.includes(kw)) score += 5;

  if (kw && wc) {
    const kwCount = text.split(kw).length - 1;
    const kwWc = kw.split(/\s+/).length;
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

  const powerWords = ['guide', 'how', 'best', 'complete', 'ultimate', 'step', 'fix', 'improve', 'top', 'easy', 'tips', 'checklist', 'explained'];
  if (powerWords.some((w) => title.includes(w))) score += 5;

  const paras = raw.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  if (paras.length) {
    const avg = paras.map((p) => p.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length).reduce((a, b) => a + b, 0) / paras.length;
    if (avg >= 40 && avg <= 150) score += 5;
  }

  if (metaD.length >= 140 && metaD.length <= 160) score += 5;
  if (!/<h1[^>]*>/i.test(raw)) score += 5;
  return Math.min(score, 100);
}

/* ── URL Slug 생성 ── */
function toSlug(title) {
  return (title || 'post').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80).replace(/^-+|-+$/g, '');
}

/* ══════════════════════════════════════════════
   웹사이트 콘텐츠 가져오기
   ══════════════════════════════════════════════ */
async function fetchWebsiteContent(srcUrl) {
  const res = await fetch(srcUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Noteracker-Bot/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} when fetching ${srcUrl}`);
  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : srcUrl;
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15000);
  return { title, content: text };
}

/* ══════════════════════════════════════════════
   YouTube 콘텐츠 가져오기
   ══════════════════════════════════════════════ */
async function fetchYouTubeContent(videoUrl, apiKey) {
  /* 단일 영상 */
  const videoIdMatch = videoUrl.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (videoIdMatch) {
    const videoId = videoIdMatch[1];
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}`);
    const data = await res.json();
    if (!data.items?.length) throw new Error('YouTube video not found');
    const snippet = data.items[0].snippet;
    const title = snippet.title || 'YouTube Video';
    const tags = (snippet.tags || []).slice(0, 20).join(', ');
    const content = `Title: ${title}\n\nDescription:\n${snippet.description || ''}\n\nTags: ${tags}\n\nPublished: ${snippet.publishedAt || ''}`;
    return { title, content };
  }
  /* 채널 ID */
  const channelIdMatch = videoUrl.match(/\/channel\/([A-Za-z0-9_-]+)/);
  if (channelIdMatch) {
    const channelId = channelIdMatch[1];
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?channelId=${channelId}&part=snippet&order=date&maxResults=5&type=video&key=${apiKey}`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}`);
    const data = await res.json();
    if (!data.items?.length) throw new Error('No videos found in this channel');
    const channelTitle = data.items[0]?.snippet?.channelTitle || channelId;
    const descriptions = data.items.map((i) => `Video: ${i.snippet.title}\n${i.snippet.description}`).join('\n\n---\n\n');
    return { title: `Channel: ${channelTitle}`, content: descriptions };
  }
  /* @핸들 */
  const decodedUrl = (() => { try { return decodeURIComponent(videoUrl); } catch { return videoUrl; } })();
  const handleMatch = decodedUrl.match(/\/@([^/?#\s]+)/);
  if (handleMatch) {
    const handle = handleMatch[1];
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`
    );
    if (!channelRes.ok) throw new Error(`YouTube API HTTP ${channelRes.status}`);
    const channelData = await channelRes.json();
    if (!channelData.items?.length) throw new Error('YouTube channel not found: @' + handle);
    const channelId = channelData.items[0].id;
    const channelTitle = channelData.items[0].snippet?.title || handle;
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?channelId=${channelId}&part=snippet&order=date&maxResults=5&type=video&key=${apiKey}`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}`);
    const data = await res.json();
    if (!data.items?.length) throw new Error('No videos found for channel: @' + handle);
    const descriptions = data.items.map((i) => `Video: ${i.snippet.title}\n${i.snippet.description}`).join('\n\n---\n\n');
    return { title: `Channel: ${channelTitle}`, content: descriptions };
  }
  throw new Error('Invalid YouTube URL. Supported: youtube.com/watch?v=ID, youtube.com/channel/ID, youtube.com/@handle');
}

/* ══════════════════════════════════════════════
   Unsplash 이미지 검색
   ══════════════════════════════════════════════ */
async function fetchUnsplashImages(keyword, accessKey, count = 2) {
  const stopWords = /\b(for|to|how|the|a|an|with|and|or|of|in|on|at|by|from|tips|guide|basics|complete|step|best|using|your|site|owners|what|is|why|when)\b/gi;
  const cleanKw = keyword.replace(stopWords, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  const queries = [cleanKw, keyword.split(' ').slice(0, 3).join(' ')];
  for (const q of queries) {
    const encoded = encodeURIComponent(q);
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encoded}&per_page=${count + 4}&orientation=landscape&content_filter=high&client_id=${accessKey}`
    );
    if (!res.ok) continue;
    const data = await res.json();
    /* 코드/프로그래밍 이미지 제외 */
    const codeKws = /\b(code|programming|terminal|console|screen|monitor|dark\s+theme|syntax|html|css|javascript|python|computer\s+screen)\b/i;
    const results = (data.results || []).filter((img) => {
      const desc = ((img.description || '') + ' ' + (img.alt_description || '')).toLowerCase();
      return !codeKws.test(desc);
    });
    const urls = results.slice(0, count).map((img) => img.urls?.regular || img.urls?.full || '').filter(Boolean);
    if (urls.length >= 1) return urls;
  }
  return [];
}

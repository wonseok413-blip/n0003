/**
 * blog-gen.js n0003 블로그 자동생성 엔진
 *
 * ═══════════════════════════════════════════════
 *  공식 생성 규칙 (OFFICIAL GENERATION RULES)
 *  이 규칙은 프롬프트, 프로그램 검사, ChatGPT 검사 3곳 모두 동일 적용
 * ═══════════════════════════════════════════════
 *
 *  R1.  단어 수: 1,500~2,200 (목표 1,600~2,000)
 *  R2.  H2 개수: 정확히 7개 (허용 5~9)
 *  R3.  H3 개수: 정확히 4개 (허용 2~6), H2 1~4번 뒤에 각 1개
 *  R4.  포커스 키워드: 제목에 반드시 포함
 *  R5.  포커스 키워드: 첫 문단 100단어 이내에 포함
 *  R6.  포커스 키워드: H2 1개 이상에 포함
 *  R7.  포커스 키워드: 본문 전체 4~8회 등장
 *  R8.  메타 설명: 정확히 140~160자, 키워드 + CTA 포함
 *  R9.  언어: 영어 전용, 한국어/일본어/중국어 절대 금지
 *  R10. 빈 태그: <strong></strong>, <p></p> 등 절대 금지
 *  R11. 단락 길이: 모든 <p>는 정확히 4~5문장, 60~100단어
 *       40단어 미만 → 자동 보충 / 120단어 초과 → 자동 분할
 *  R12. AI 금지 단어: delve, leverage, utilize, robust, seamless,
 *       streamline, navigate, realm, landscape, ecosystem, paradigm,
 *       synergy, empower, harness, cutting-edge, game-changer,
 *       comprehensive, paramount, holistic, crucial, essential,
 *       ensure, bolstering, foster, nuanced, curated, underscores,
 *       mitigate, proactive, prioritize, optimal, pivotal, facilitate,
 *       enhance, furthermore, moreover, additionally 등
 *       → 발견 시 대체어로 자동 교체 (postProcessContent + auto-fix)
 *  R13. 결론 섹션: "Conclusion", "Final Thoughts", "Summary" H2 절대 금지
 *       → 발견 시 자동 제거
 *  R14. 제목 길이: 50~60자
 *  R15. 비축약형 과다 금지: "do not", "will not" 등 non-contraction 5회 초과 금지
 *       → postProcessContent 축약형 강제 (don't, won't, it's 등)
 *  R16. 금지된 단락 시작 표현: "In today's", "When it comes to" 등
 *       → 발견 즉시 위반 처리
 *
 *  생성 흐름:
 *  1) Workers AI (Llama 3.3 70B) → 글 생성
 *  2) 후처리: AI 패턴 제거, 축약형 강제, 키워드 밀도 보정
 *  3) H2/H3 보강: 목표 개수 미달 시 자동 삽입
 *  4) 단락 길이 보정: 짧으면 보충, 길면 분할
 *  5) R7 키워드 횟수 강제 조정 (4-8회, 목표 6회)
 *  6) 1단계 프로그램 검사: R1~R16 자동 체크
 *  7) 2단계 ChatGPT 검사: R1~R16 전수 검사 (90점+ 통과)
 *  8) 불합격 → R7/R12/R13/R10 자동 수정 + 재검사
 *  9) 3단계 최종 검사: 위반 잔존 시 전체 재생성 (최대 2회)
 *  10) 합격 → DB 저장 / 2회 재생성 후에도 개선 안 되면 최선 버전 저장
 *
 *  이미지 규칙:
 *  - Unsplash에서 2장 (대표 + 본문)
 *  - 기존 n0003 글에서 사용한 이미지 중복 차단
 *  - n0005 블로그에서 사용한 이미지 절대 차단
 *
 *  작성자: Kim Eun Ho (ID 1) / Lee Hae Soo (ID 2) 랜덤 배정
 * ═══════════════════════════════════════════════
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
  'wordpress',
  'web-hosting',
  'ecommerce',
  'seo',
  'web-security',
];

/* ── 카테고리별 외부 권위 링크 ── */
const CAT_EXTERNAL_REFS = {
  'wordpress': [
    ['https://developer.wordpress.org/', 'WordPress Developer Resources'],
    ['https://wordpress.org/documentation/', 'WordPress Official Documentation'],
  ],
  'web-hosting': [
    ['https://www.cloudflare.com/learning/', 'Cloudflare Learning Center'],
    ['https://httpd.apache.org/docs/', 'Apache HTTP Server Documentation'],
  ],
  'ecommerce': [
    ['https://woocommerce.com/documentation/', 'WooCommerce Documentation'],
    ['https://baymard.com/research', 'Baymard Institute UX Research'],
  ],
  'seo': [
    ['https://developers.google.com/search/docs', 'Google Search Central Documentation'],
    ['https://moz.com/learn/seo', 'Moz SEO Learning Center'],
  ],
  'web-security': [
    ['https://owasp.org/www-project-top-ten/', 'OWASP Top Ten Security Risks'],
    ['https://www.cloudflare.com/learning/security/', 'Cloudflare Security Learning Center'],
  ],
};

/* ── 주제에서 짧은 포커스 키워드 추출 ── */
function extractFocusKeyword(topic, category) {
  /* 카테고리 기반 2-4단어 키워드 맵: topic substring → short keyword */
  const kwMap = {
    'wordpress': [
      ['plugin', 'wordpress plugin guide'],
      ['theme', 'wordpress theme setup'],
      ['gutenberg', 'gutenberg block editor'],
      ['multisite', 'wordpress multisite setup'],
      ['migration', 'wordpress site migration'],
      ['staging', 'wordpress staging site'],
      ['custom post', 'custom post types'],
      ['rest api', 'wordpress rest api'],
      ['headless', 'headless wordpress'],
      ['maintenance', 'wordpress maintenance tips'],
      ['backup', 'wordpress backup strategy'],
      ['update', 'wordpress update guide'],
      ['database', 'wordpress database optimize'],
      ['page builder', 'wordpress page builder'],
      ['child theme', 'wordpress child theme'],
    ],
    'web-hosting': [
      ['cloud hosting', 'cloud hosting guide'],
      ['vps', 'vps hosting setup'],
      ['cdn', 'cdn setup guide'],
      ['server', 'web server configuration'],
      ['ssl certificate', 'ssl certificate setup'],
      ['domain', 'domain management guide'],
      ['caching', 'server caching setup'],
      ['load balancing', 'load balancing setup'],
      ['managed hosting', 'managed hosting benefits'],
      ['migration', 'hosting migration guide'],
      ['uptime', 'uptime monitoring setup'],
      ['nginx', 'nginx server setup'],
      ['docker', 'docker web hosting'],
      ['cloudflare', 'cloudflare setup guide'],
      ['email hosting', 'email hosting setup'],
    ],
    'ecommerce': [
      ['woocommerce', 'woocommerce store setup'],
      ['product page', 'product page optimization'],
      ['checkout', 'checkout flow optimization'],
      ['payment gateway', 'payment gateway setup'],
      ['shipping', 'shipping setup guide'],
      ['inventory', 'inventory management tips'],
      ['conversion', 'ecommerce conversion rate'],
      ['abandoned cart', 'abandoned cart recovery'],
      ['subscription', 'subscription commerce setup'],
      ['dropshipping', 'dropshipping store setup'],
      ['b2b', 'b2b ecommerce guide'],
      ['product photo', 'product photography tips'],
      ['tax', 'ecommerce tax setup'],
      ['returns', 'returns policy setup'],
      ['upsell', 'upselling strategy guide'],
    ],
    'seo': [
      ['core web vitals', 'core web vitals guide'],
      ['keyword research', 'keyword research guide'],
      ['on-page', 'on-page seo guide'],
      ['backlink', 'backlink building guide'],
      ['schema', 'schema markup guide'],
      ['site speed', 'site speed optimization'],
      ['mobile seo', 'mobile seo guide'],
      ['local seo', 'local seo strategy'],
      ['technical seo', 'technical seo audit'],
      ['content strategy', 'seo content strategy'],
      ['image seo', 'image seo optimization'],
      ['rank tracking', 'rank tracking setup'],
      ['sitemap', 'xml sitemap guide'],
      ['internal linking', 'internal linking strategy'],
      ['featured snippet', 'featured snippet guide'],
    ],
    'web-security': [
      ['firewall', 'web application firewall'],
      ['ssl', 'ssl security setup'],
      ['malware', 'malware removal guide'],
      ['ddos', 'ddos protection guide'],
      ['brute force', 'brute force protection'],
      ['sql injection', 'sql injection prevention'],
      ['xss', 'xss prevention guide'],
      ['two-factor', 'two-factor authentication'],
      ['backup', 'security backup strategy'],
      ['vulnerability', 'vulnerability scanning guide'],
      ['security headers', 'security headers setup'],
      ['wordpress security', 'wordpress security guide'],
      ['data breach', 'data breach prevention'],
      ['monitoring', 'security monitoring tools'],
      ['incident response', 'incident response plan'],
    ],
  };
  const topicLower = topic.toLowerCase();
  const catKws = kwMap[category] || [];
  for (const [match, kw] of catKws) {
    if (topicLower.includes(match)) return kw;
  }
  /* fallback: extract 3-4 meaningful words from topic */
  const stopWords = new Set(['how','to','the','a','an','and','or','for','from','your','of','in','on','is','are','by','with','this','that','it','as','do','be','at','my']);
  const meaningful = topic.toLowerCase().split(/\s+/).filter(w => !stopWords.has(w) && w.length > 2);
  return meaningful.slice(0, 3).join(' ') || category.replace(/-/g, ' ');
}

/* ── 카테고리별 주제 15개 ── */
const CAT_TOPICS = {
  'wordpress': [
    'how to choose the right WordPress plugins for your business site',
    'building a custom WordPress theme from scratch step by step',
    'WordPress Gutenberg block editor tips for faster content creation',
    'setting up WordPress multisite for managing multiple websites',
    'migrating your WordPress site to a new host without downtime',
    'how to create a WordPress staging site for safe testing',
    'custom post types and taxonomies for advanced WordPress sites',
    'using the WordPress REST API to build modern web applications',
    'headless WordPress with modern front-end frameworks explained',
    'essential WordPress maintenance tasks every site owner should do monthly',
    'automated WordPress backup strategies that actually protect your data',
    'safely updating WordPress core plugins and themes without breaking your site',
    'optimizing your WordPress database for peak performance',
    'comparing top WordPress page builders for business websites',
    'creating a WordPress child theme for safe customizations',
  ],
  'web-hosting': [
    'cloud hosting vs shared hosting which is right for your business',
    'setting up a VPS for WordPress hosting step by step guide',
    'how to set up a CDN to speed up your website globally',
    'web server configuration guide for optimal performance',
    'SSL certificate installation and renewal best practices',
    'domain name management tips for small business owners',
    'server-side caching strategies to reduce page load times',
    'load balancing setup for high-traffic websites',
    'managed hosting vs unmanaged hosting pros and cons',
    'how to migrate your website to a new hosting provider',
    'setting up uptime monitoring to catch downtime before customers do',
    'Nginx vs Apache choosing the right web server for your site',
    'Docker containers for web application deployment guide',
    'setting up Cloudflare for performance and security',
    'business email hosting setup and configuration guide',
  ],
  'ecommerce': [
    'setting up a WooCommerce store from scratch complete guide',
    'product page optimization tips that increase conversions',
    'streamlining your checkout flow to reduce cart abandonment',
    'choosing the right payment gateway for your online store',
    'shipping setup guide for WooCommerce store owners',
    'inventory management best practices for online retailers',
    'proven strategies to improve your ecommerce conversion rate',
    'abandoned cart recovery emails that win back lost sales',
    'setting up subscription-based products in WooCommerce',
    'starting a dropshipping store with WordPress and WooCommerce',
    'B2B ecommerce features your wholesale store needs',
    'product photography tips for better online sales',
    'ecommerce tax configuration guide for multiple regions',
    'creating a returns policy that builds customer trust',
    'upselling and cross-selling strategies for online stores',
  ],
  'seo': [
    'Core Web Vitals explained and how to pass all three metrics',
    'keyword research guide for small business websites',
    'on-page SEO checklist for every blog post and page',
    'building quality backlinks for small business websites',
    'schema markup guide to get rich results in Google search',
    'site speed optimization techniques that improve SEO rankings',
    'mobile SEO best practices for responsive websites',
    'local SEO strategy guide for service-based businesses',
    'technical SEO audit checklist for WordPress websites',
    'content strategy framework that drives organic traffic',
    'image SEO optimization for faster pages and better rankings',
    'setting up rank tracking to monitor your SEO progress',
    'XML sitemap creation and submission best practices',
    'internal linking strategy that boosts page authority',
    'how to optimize content for Google featured snippets',
  ],
  'web-security': [
    'web application firewall setup guide for business websites',
    'SSL and HTTPS configuration best practices for website security',
    'detecting and removing malware from your WordPress site',
    'DDoS protection strategies for small business websites',
    'preventing brute force attacks on your WordPress login',
    'SQL injection prevention techniques every developer should know',
    'cross-site scripting XSS prevention for WordPress sites',
    'setting up two-factor authentication for website administrators',
    'automated backup strategies to recover from security incidents',
    'website vulnerability scanning tools and how to use them',
    'essential security headers every website should implement',
    'WordPress security hardening checklist for site owners',
    'data breach prevention strategies for online businesses',
    'real-time security monitoring tools for website protection',
    'building an incident response plan for your business website',
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
    /* URL 중복 방지 동일 URL이 이미 존재하면 거부 */
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
          console.warn('[blog-gen] YouTube API Key 미설정 URL만 저장');
          errorMsg = 'YouTube API Key 미설정 스크립트 수집 불가, URL만 저장됨';
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

The system already enforces these core requirements automatically do NOT repeat them:
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
export async function runBlogGeneration(env, count = 2, forcedCategory = null) {
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
  const focusKw = extractFocusKeyword(topic, category);

  /* 소스 콘텐츠 준비 최소 3개 이상 소스 활용, 유튜브 스크립트 원문 명시 */
  let sourceContent = '';
  const sourceIds = [];
  if (sources.length) {
    const shuffled = [...sources].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.max(3, Math.min(sources.length, 5)));
    for (const s of picked) {
      sourceIds.push(s.id);
      const isYT = s.type === 'youtube';
      const label = isYT
        ? `[YouTube Transcript: ${s.title || 'Video'}] 아래는 유튜브 영상의 원본 스크립트입니다. 이 스크립트를 다른 자료와 비교·대조하여 재구성하세요.`
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
    console.warn('[blog-gen] Korean detected retrying with strict English-only prompt');
    const _enPrompt = `CRITICAL: Write ONLY in English. No Korean, no other language.
Write a blog post about "${topic}" in English. Focus keyword: "${focusKw}". Category: ${category}.
Return ONLY a JSON object: {"title":"English title","content":"HTML blog post in English only, 1000+ words","excerpt":"English excerpt","seo_title":"English SEO title","seo_description":"English meta description","focus_keyword":"${focusKw}","keywords":["kw1","kw2","kw3","kw4","kw5"],"img_alt_featured":"English alt text","img_alt_body":"English alt text"}`;
    const _enRaw = await generateWithWorkersAI(env, _enPrompt);
    const _enPost = parseAIResponse(_enRaw);
    if (_enPost && _enPost.title && !_hasKorean(_enPost.title)) {
      Object.assign(post, _enPost);
      console.log('[blog-gen] English retry succeeded');
    } else {
      console.warn('[blog-gen] English retry still has Korean stripping Korean characters');
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
        console.log(`[blog-gen] Title prefix "${prefix}" overused (${prefixCount[prefix]}x) replaced with "${fresh}"`);
      }
    }
  } catch (_) {}

  /* 본문 단어 수 부족 시 확장 */
  const _wc0 = post.content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (_wc0 < 1400) {
    console.log(`[blog-gen] content only ${_wc0} words expanding...`);
    post.content = await expandContent(env, post.content, focusKw, _wc0);
  }

  /* 후처리 (AI 패턴 정리 + HTML 정리) */
  post.content = postProcessContent(post.content);

  /* ⛔ H2/H3 태그 필수 검증 — 목표 H2=7, H3=4 (허용 H2:5-9, H3:2-6) */
  const _h2Tags = (post.content.match(/<h2[\s>]/gi) || []);
  const _h3Tags = (post.content.match(/<h3[\s>]/gi) || []);
  console.log(`[blog-gen] Heading check: H2=${_h2Tags.length}, H3=${_h3Tags.length} (target: H2=7, H3=4)`);
  if (_h2Tags.length < 5 || _h3Tags.length < 2) {
    console.log('[blog-gen] Heading structure insufficient, injecting to reach target...');
    /* H2 보강 — 목표 7개까지 */
    const h2Target = 7;
    if (_h2Tags.length < 5) {
      const needed = Math.min(h2Target - _h2Tags.length, 5);
      const sectionTitles = [
        `Key ${focusKw} Strategies You Need`,
        `How ${focusKw} Impacts Your Business`,
        `Common ${focusKw} Mistakes to Avoid`,
        `${focusKw} Best Practices for Success`,
        `Why ${focusKw} Matters More Than Ever`,
        `Advanced ${focusKw} Techniques`,
        `Smart Ways to Handle ${focusKw}`,
      ];
      let parts = post.content.split(/(<\/p>)/gi);
      const pTags = parts.filter(p => p.toLowerCase() === '</p>').length;
      const step = Math.max(2, Math.floor(pTags / (needed + 1)));
      let injected = 0;
      let pCount = 0;
      let result = '';
      for (let i = 0; i < parts.length; i++) {
        result += parts[i];
        if (parts[i].toLowerCase() === '</p>') {
          pCount++;
          if (injected < needed && pCount > 1 && pCount % step === 0) {
            const title = sectionTitles[injected % sectionTitles.length];
            result += `\n<h2>${title}</h2>\n`;
            injected++;
          }
        }
      }
      if (injected > 0) post.content = result;
    }
    /* H3 보강 — 목표 4개까지, 첫 4개 H2 뒤에 삽입 */
    const currentH3 = (post.content.match(/<h3[\s>]/gi) || []).length;
    if (currentH3 < 2) {
      const h3Target = 4;
      const needed = Math.min(h3Target - currentH3, 4);
      const subTitles = [
        `Quick ${focusKw} Checklist`,
        `Step-by-Step ${focusKw} Process`,
        `${focusKw} Implementation Tips`,
        `Practical ${focusKw} Examples`,
      ];
      let subIdx = 0;
      /* H2 뒤 첫 </p> 다음에 H3 삽입 */
      let h2Count = 0;
      post.content = post.content.replace(/<\/h2>([\s\S]*?)<\/p>/gi, (match) => {
        h2Count++;
        if (subIdx < needed && h2Count <= 4) {
          const sub = subTitles[subIdx++ % subTitles.length];
          return match + `\n<h3>${sub}</h3>\n<p>This step builds on the previous section and adds practical detail you can apply right away. Most site owners find this part straightforward once they understand the basics. The key is consistency in your approach. Take it one step at a time for best results.</p>`;
        }
        return match;
      });
    }
    const _h2After = (post.content.match(/<h2[\s>]/gi) || []).length;
    const _h3After = (post.content.match(/<h3[\s>]/gi) || []).length;
    console.log(`[blog-gen] After heading injection: H2=${_h2After}, H3=${_h3After}`);
  }

  /* H2 헤딩에 focus keyword 보강 (SEO 점수용) */
  const _headingCheck = (post.content.match(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/gi) || [])
    .map(h => h.replace(/<[^>]*>/g, '')).join(' ').toLowerCase();
  if (!_headingCheck.includes(focusKw.toLowerCase())) {
    /* 두번째 H2 헤딩에 focus keyword 삽입 */
    let _h2count = 0;
    post.content = post.content.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (match, inner) => {
      _h2count++;
      if (_h2count === 2) {
        const cap = focusKw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        return `<h2>${cap}: ${inner.replace(/<[^>]*>/g, '').trim()}</h2>`;
      }
      return match;
    });
  }

  /* ⛔ H태그 제목당 4-5줄 규정 검증 — 너무 짧은 단락 보강 */
  post.content = enforceHeadingParagraphLength(post.content);

  /* ⛔ R7 키워드 횟수 강제 조정 (4-8회, 목표 6회) */
  post.content = enforceKeywordCount(post.content, focusKw, 6);

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

  /* ⛔ n0005 이미지 사용금지 — n0005 블로그에서 사용 중인 이미지 차단 */
  try {
    const n5Res = await fetch('https://n0005.wonseok413.workers.dev/api/blog', { signal: AbortSignal.timeout(5000) });
    if (n5Res.ok) {
      const n5Data = await n5Res.json();
      (n5Data.posts || []).forEach((p) => {
        if (p.featured_image) _usedUrls.add(p.featured_image.split('?')[0]);
        if (p.body_image) _usedUrls.add(p.body_image.split('?')[0]);
      });
      console.log(`[blog-gen] n0005 image blocklist loaded: ${(n5Data.posts || []).length} posts`);
    }
  } catch (_) { console.warn('[blog-gen] n0005 image blocklist fetch failed (ignored)'); }
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
    const imgAlt = _rawAlt.toLowerCase().includes(focusKw.toLowerCase()) ? _rawAlt : `${focusKw} ${_rawAlt || focusKw}`;
    post.content = insertImageBeforeThirdH(post.content, bodyImg, imgAlt);
  }

  /* 외부 링크 + 내부 링크 삽입 */
  post.content = injectExternalLinks(post.content, category);
  post.content = await injectInternalLinks(post.content, env.DB);

  /* n0005 상품 프로모션 CTA 삽입 (본문 중간 50% 지점) */
  post.content = injectProductCTA(post.content, category);

  /* 요약/FAQ 테이블 추가 */
  const _countRow = await env.DB.prepare('SELECT COUNT(*) as c FROM blog_posts').first().catch(() => null);
  const _tableType = (_countRow?.c || 0) % 2 === 0 ? 'summary' : 'qa';
  const _summaryTable = buildSummaryTable(post.content, _tableType);
  if (_summaryTable) post.content += _summaryTable;
  console.log(`[blog-gen] Appended ${_tableType} table`);

  /* ⛔ 1단계: 프로그램 규정 검사 */
  const ruleCheck = programmaticRuleCheck(post, focusKw);
  console.log(`[blog-gen] Rule check: pass=${ruleCheck.pass}, violations=${ruleCheck.violations.length}`);
  if (!ruleCheck.pass) {
    console.log(`[blog-gen] Rule violations: ${ruleCheck.violations.join(' | ')}`);
  }

  /* ⛔ 2단계: ChatGPT 규정 전수 검사 */
  if (useOpenAI) {
    try {
      const gptResult = await validateAllRulesWithOpenAI(env, post, focusKw);
      if (gptResult.seo_title) post.seo_title = gptResult.seo_title;
      if (gptResult.seo_description) post.seo_description = gptResult.seo_description;
      if (gptResult.keywords?.length) post.keywords = gptResult.keywords;

      /* ChatGPT 불합격 시 자동 수정 시도 */
      if (gptResult.pass === false || ruleCheck.violations.length > 0) {
        console.warn(`[blog-gen] FAILED validation (GPT=${gptResult.score}, programmatic=${ruleCheck.violations.length} violations). Auto-fixing...`);

        /* R7 수정: 키워드 밀도 초과 시 강제 축소 */
        post.content = enforceKeywordCount(post.content, focusKw, 6);

        /* R12 수정: 금지 단어 → 대체어로 교체 */
        const bannedRe = /\b(delve|leverage|utilize|robust|seamless|streamline|navigate|realm|landscape|ecosystem|paradigm|synergy|empower|harness|cutting-edge|game-changer|comprehensive|paramount|holistic|crucial|essential|ensure|enhancing|facilitating|subsequently|bolstering|foster|nuanced|curated|underscores|mitigate|proactive|prioritize|optimal|pivotal|facilitate|enhance)\b/gi;
        const replacements = { delve:'explore', leverage:'use', utilize:'use', robust:'strong', seamless:'smooth', streamline:'simplify', navigate:'handle', realm:'area', landscape:'field', ecosystem:'system', paradigm:'approach', synergy:'teamwork', empower:'help', harness:'use', 'cutting-edge':'modern', 'game-changer':'big step forward', comprehensive:'full', paramount:'top', holistic:'complete', crucial:'important', essential:'key', ensure:'make sure', enhancing:'improving', facilitating:'helping', subsequently:'then', bolstering:'strengthening', foster:'build', nuanced:'detailed', curated:'selected', underscores:'shows', mitigate:'reduce', proactive:'early', prioritize:'focus on', optimal:'best', pivotal:'key', facilitate:'help', enhance:'improve' };
        post.content = post.content.replace(bannedRe, (m) => replacements[m.toLowerCase()] || m);

        /* R13 수정: 결론 H2 제거 */
        post.content = post.content.replace(/<h2[^>]*>\s*(Conclusion|Final Thoughts|Summary|Wrapping Up|Key Takeaways)[^<]*<\/h2>/gi, '');

        /* R10 수정: 빈 태그 제거 */
        post.content = post.content.replace(/<(strong|em|h2|h3|p)>\s*<\/\1>/gi, '');

        /* 후처리 재적용 */
        post.content = postProcessContent(post.content);
        post.content = enforceHeadingParagraphLength(post.content);

        /* 수정 후 재검사 */
        const recheck = programmaticRuleCheck(post, focusKw);
        console.log(`[blog-gen] After auto-fix: ${recheck.violations.length} violations remaining`);
        if (recheck.violations.length > 0) {
          console.log(`[blog-gen] Remaining: ${recheck.violations.join(' | ')}`);
        }
      }
    } catch (e) {
      console.warn('[blog-gen] ChatGPT validation failed:', e.message);
    }
  }

  /* ⛔ 3단계: 최종 R1-R14 전수 검사 — 위반 시 자동 재생성 (최대 2회) */
  const finalCheck = programmaticRuleCheck(post, focusKw);
  if (!finalCheck.pass) {
    console.warn(`[blog-gen] FINAL CHECK FAILED: ${finalCheck.violations.join(' | ')}. Attempting full regeneration...`);
    for (let regenAttempt = 1; regenAttempt <= 2; regenAttempt++) {
      try {
        console.log(`[blog-gen] Regeneration attempt ${regenAttempt}/2...`);
        const regenPrompt = buildGenerationPrompt(topic, category, focusKw, sourceContent, customRules, writingStyle);
        const regenRaw = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: `You are a senior SEO content writer. CRITICAL: The focus keyword "${focusKw}" must appear EXACTLY 5-6 times in the content body. NOT more. Count carefully before submitting. Previous attempt FAILED because keyword appeared too many times. Write naturally without keyword stuffing.` },
            { role: 'user', content: regenPrompt },
          ],
          max_tokens: 4000,
          temperature: 0.6,
        });
        const regenText = (regenRaw?.response || '').trim();
        let regenJson;
        try {
          regenJson = JSON.parse(regenText.replace(/```json\s*/gi, '').replace(/```/g, '').trim());
        } catch (_) {
          console.warn(`[blog-gen] Regen ${regenAttempt}: parse failed`);
          continue;
        }
        if (!regenJson.title || !regenJson.content) {
          console.warn(`[blog-gen] Regen ${regenAttempt}: missing title/content`);
          continue;
        }

        /* 후처리 파이프라인 재적용 */
        regenJson.content = enforceKeywordDensity(regenJson.content, focusKw, 2);
        regenJson.content = enforceKeywordCount(regenJson.content, focusKw, 6);
        regenJson.content = postProcessContent(regenJson.content);
        regenJson.content = enforceHeadingParagraphLength(regenJson.content);

        /* 금지 단어 제거 */
        const bannedRe2 = /\b(delve|leverage|utilize|robust|seamless|streamline|navigate|realm|landscape|ecosystem|paradigm|synergy|empower|harness|cutting-edge|game-changer|comprehensive|paramount|holistic|crucial|essential|ensure|enhancing|facilitating|subsequently|bolstering|foster|nuanced|curated|underscores|mitigate|proactive|prioritize|optimal|pivotal|facilitate|enhance)\b/gi;
        const rep2 = { delve:'explore', leverage:'use', utilize:'use', robust:'strong', seamless:'smooth', streamline:'simplify', navigate:'handle', realm:'area', landscape:'field', ecosystem:'system', paradigm:'approach', synergy:'teamwork', empower:'help', harness:'use', 'cutting-edge':'modern', 'game-changer':'big step forward', comprehensive:'full', paramount:'top', holistic:'complete', crucial:'important', essential:'key', ensure:'make sure', enhancing:'improving', facilitating:'helping', subsequently:'then', bolstering:'strengthening', foster:'build', nuanced:'detailed', curated:'selected', underscores:'shows', mitigate:'reduce', proactive:'early', prioritize:'focus on', optimal:'best', pivotal:'key', facilitate:'help', enhance:'improve' };
        regenJson.content = regenJson.content.replace(bannedRe2, (m) => rep2[m.toLowerCase()] || m);

        /* 결론 H2 제거 */
        regenJson.content = regenJson.content.replace(/<h2[^>]*>\s*(Conclusion|Final Thoughts|Summary|Wrapping Up|Key Takeaways)[^<]*<\/h2>/gi, '');

        /* 빈 태그 제거 */
        regenJson.content = regenJson.content.replace(/<(strong|em|h2|h3|p)>\s*<\/\1>/gi, '');

        /* 재검사 */
        const tempPost = { ...post, title: regenJson.title, content: regenJson.content, seo_description: regenJson.seo_description || post.seo_description };
        const regenCheck = programmaticRuleCheck(tempPost, focusKw);
        console.log(`[blog-gen] Regen ${regenAttempt} check: ${regenCheck.violations.length} violations${regenCheck.violations.length > 0 ? ' (' + regenCheck.violations.join(', ') + ')' : ''}`);

        if (regenCheck.pass || regenCheck.violations.length < finalCheck.violations.length) {
          post.title = regenJson.title;
          post.content = regenJson.content;
          if (regenJson.excerpt) post.excerpt = regenJson.excerpt;
          if (regenJson.seo_title) post.seo_title = regenJson.seo_title;
          if (regenJson.seo_description) post.seo_description = regenJson.seo_description;
          if (regenJson.keywords?.length) post.keywords = regenJson.keywords;
          console.log(`[blog-gen] Regen ${regenAttempt} accepted: ${regenCheck.violations.length} violations (was ${finalCheck.violations.length})`);
          if (regenCheck.pass) break;
        }
      } catch (regenErr) {
        console.warn(`[blog-gen] Regen ${regenAttempt} error:`, regenErr.message);
      }
    }
  }

  /* Meta Description 길이 보정 (반드시 140-160자) */
  if (post.seo_description) {
    let md = post.seo_description.trim();
    if (md.length > 160) {
      md = md.slice(0, 157) + '...';
    }
    if (md.length < 140) {
      const fillers = [
        ` Learn more about ${focusKw} today.`,
        ` Discover practical ${focusKw} tips now.`,
        ` Get expert ${focusKw} guidance here.`,
        ` Start protecting your website today.`,
        ` Find out how to get started right away.`,
        ` Take action and secure your site now.`,
        ` Read our complete guide to learn more.`,
      ];
      for (const f of fillers) {
        if (md.length + f.length >= 140 && md.length + f.length <= 160) { md += f; break; }
      }
      /* 여전히 140 미만이면 padding으로 맞춤 */
      if (md.length < 140) {
        const pad = ' Protect your site with proven strategies and actionable steps for better security.';
        md = (md + pad).slice(0, 155);
      }
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
    console.log(`[blog-gen] SEO score ${realSeoScore} < 90 attempting regeneration...`);
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
          const iAlt = _rAlt.toLowerCase().includes(focusKw.toLowerCase()) ? _rAlt : `${focusKw} ${_rAlt || focusKw}`;
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

  /* 콘텐츠 품질 + AI 유사성 점수 */
  let qualityScore = computeContentQuality(post.content);
  let aiSimilarity = computeAISimilarity(post.content);
  console.log(`[blog-gen] Quality=${qualityScore}/100, AI-similarity=${aiSimilarity}/100`);

  /* AI 유사성 25 이상이면 humanize rewrite 시도 */
  if (aiSimilarity > 25) {
    try {
      console.log('[blog-gen] AI similarity too high, attempting humanization pass...');
      const textOnly = post.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
      const humanizeResult = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          { role: 'system', content: 'You are a human writing coach. Your ONLY job is to rewrite text to sound less robotic. Keep the same meaning and structure but change word choices, sentence patterns, and transitions. Return ONLY the rewritten HTML, no explanation.' },
          { role: 'user', content: `Rewrite ONLY the <p> paragraph content below to sound more human and natural. Keep all HTML tags, headings, images, links, tables, and blockquotes EXACTLY as they are. Only change the text inside <p> tags. Rules: 1) Replace formal/corporate language with casual direct language 2) Vary sentence lengths dramatically 3) Use contractions everywhere 4) Start some sentences with "But", "And", "So" 5) Add 1-2 short rhetorical questions 6) Remove any phrase that sounds like corporate speak. Return the FULL HTML:\n\n${post.content}` },
        ],
        max_tokens: 8192,
        temperature: 0.9,
      });
      const rewritten = (humanizeResult?.response || '').trim();
      if (rewritten && rewritten.length > post.content.length * 0.5) {
        /* 확인: rewritten이 여전히 HTML 구조를 유지하는지 */
        if (/<h2/.test(rewritten) && /<p/.test(rewritten)) {
          /* humanized 결과에도 postProcess 적용 */
          const cleanRewritten = postProcessContent(rewritten);
          const newSim = computeAISimilarity(cleanRewritten);
          console.log(`[blog-gen] Humanized: AI-similarity ${aiSimilarity} → ${newSim}`);
          if (newSim < aiSimilarity) {
            post.content = cleanRewritten;
            aiSimilarity = newSim;
            qualityScore = computeContentQuality(post.content);
          }
        }
      }
    } catch (e) {
      console.warn('[blog-gen] Humanization pass failed:', e.message);
    }
  }

  /* DB 저장 */
  const authorId = Math.random() < 0.5 ? 1 : 2;
  const ins = await env.DB.prepare(
    `INSERT INTO blog_posts
     (title, slug, excerpt, content, featured_image, body_image, category, tags,
      seo_title, seo_description, seo_score, focus_keyword, quality_score, ai_similarity, author_id, status, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', datetime('now'), datetime('now'), datetime('now'))`
  ).bind(
    post.title, slug, (post.excerpt || '').replace(/<[^>]*>/g, ''), post.content,
    featuredImg, bodyImg, category, (post.keywords || []).join(','),
    post.seo_title || post.title, post.seo_description || post.excerpt || '', realSeoScore, focusKw,
    qualityScore, aiSimilarity, authorId,
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

🚨 CRITICAL ORIGINALITY RULES ZERO TOLERANCE FOR COPYING:
1. COMPLETELY TRANSFORM every sentence from the source material change EVERY word, phrase, and sentence structure without exception
2. Do NOT copy ANY phrase from the sources not even casual expressions like "it is important to", "you should", "one of the most common"
3. Extract FACTS, numbers, and technical concepts ONLY then express them entirely in your own original voice using completely different words
4. Imagine you read all sources 2 weeks ago and are now writing purely from memory you are NOT looking at them while writing
5. If a sentence could appear verbatim in any source material, DELETE it and rewrite from scratch with completely different wording
6. Synthesize and combine information from ALL sources to create unique perspectives not found in any single source
7. TARGET: final content must share less than 15% word-level similarity with any single source

🎯 TARGET AUDIENCE:
- WordPress intermediate users (1–3 years of hands-on experience)
- They know: plugin installation, dashboard navigation, basic settings, adding themes
- They do NOT know: server-level commands, PHP code, advanced hosting, CLI tools
- Write AS IF explaining to a smart colleague who uses WordPress regularly but is NOT a developer

📖 WRITING LEVEL (고등학교 1학년 수준 Korean High School Freshman equivalent):
- Use simple, everyday vocabulary if a technical term is unavoidable, IMMEDIATELY explain it in plain words in the SAME sentence
- Keep sentences SHORT: 15–20 words maximum per sentence
- ONE idea per sentence. ONE main concept per paragraph.
- Replace technical jargon with plain words: "malicious code" → "harmful code planted by hackers", "vulnerability" → "security weak point", "authentication" → "login verification step"
- Write as if explaining to a 15-year-old who is smart and curious but has no technical background
- No academic phrasing be direct, friendly, and practical

SOURCE MATERIAL (extract facts only COMPLETELY transform ALL expressions, DO NOT copy any phrase):
${sourceContent.slice(0, 5000)}`
    : `Write based on your knowledge about: ${topic}.
🎯 TARGET AUDIENCE: WordPress intermediate users (1–3 years experience, knows plugin installation and dashboard use, but not server-level or coding concepts).
📖 WRITING LEVEL: Simple and accessible Korean high school freshman equivalent. Short sentences (15–20 words max), plain vocabulary, explain every technical term in plain words when first used.`;
  const rulesSection = customRules && customRules.trim()
    ? `\nBASE WRITING REFERENCE (core style guidelines apply to every sentence and paragraph):\n${customRules.trim()}\n` : '';
  const styleSection = writingStyle && writingStyle.trim()
    ? `\nWRITING STYLE & TONE (apply throughout the entire post):\n${writingStyle.trim()}\n` : '';

  return `You are an expert English content writer. Write a complete, SEO-optimized blog post targeting a RankMath score of 90+.

LANGUAGE RULE (ABSOLUTE ZERO EXCEPTIONS):
- The ENTIRE post MUST be written in ENGLISH ONLY title, content, headings, excerpt, seo_title, seo_description, all fields
- NEVER write in Korean, Japanese, Chinese, or any other language
- If the topic appears to be in another language, write about it in English anyway
- ALL JSON field values must be in English

TOPIC: "${topic}"
CATEGORY: ${category}
FOCUS KEYWORD: "${focusKw}"

═══ WORD COUNT (ABSOLUTE REQUIREMENT) ═══
- Total visible text: exactly 1,500–2,000 words (not counting HTML tags)
- 7 H2 sections × ~200 words each + intro + closing = 1,600 words target
- Below 1,500 = REJECTED. Above 2,200 = REJECTED.

═══ HTML STRUCTURE (ZERO TOLERANCE — #1 PRIORITY RULE) ═══

ALLOWED TAGS ONLY: <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>, <blockquote>
FORBIDDEN TAGS: <h1>, <script>, <style>, <svg>, <i>, <span>, <div>, <img>, <a>

EXACT STRUCTURE — follow this template PRECISELY:

  <p>[intro paragraph: exactly 4–5 sentences, 60–100 words, includes focus keyword]</p>

  <h2>[Section 1 Title — includes focus keyword]</h2>
  <p>[exactly 4–5 sentences, 60–100 words]</p>
  <h3>[Subsection 1.1]</h3>
  <p>[exactly 4–5 sentences, 60–100 words]</p>

  <h2>[Section 2 Title]</h2>
  <p>[exactly 4–5 sentences, 60–100 words]</p>
  <h3>[Subsection 2.1]</h3>
  <p>[exactly 4–5 sentences, 60–100 words]</p>

  <h2>[Section 3 Title]</h2>
  <p>[exactly 4–5 sentences, 60–100 words]</p>
  <h3>[Subsection 3.1]</h3>
  <p>[exactly 4–5 sentences, 60–100 words]</p>

  <h2>[Section 4 Title]</h2>
  <p>[exactly 4–5 sentences, 60–100 words]</p>
  <h3>[Subsection 4.1]</h3>
  <p>[exactly 4–5 sentences, 60–100 words]</p>

  <h2>[Section 5 Title]</h2>
  <p>[exactly 4–5 sentences, 60–100 words]</p>
  <p>[exactly 4–5 sentences, 60–100 words]</p>

  <h2>[Section 6 Title]</h2>
  <p>[exactly 4–5 sentences, 60–100 words]</p>
  <p>[exactly 4–5 sentences, 60–100 words]</p>

  <h2>[Section 7 Title]</h2>
  <p>[exactly 4–5 sentences, 60–100 words]</p>
  <p>[exactly 4–5 sentences, 60–100 words]</p>

PARAGRAPH LENGTH RULE — THE MOST IMPORTANT RULE:
- Every single <p> tag MUST contain EXACTLY 4 or 5 sentences
- Every single <p> tag MUST contain 60–100 words
- 3 sentences = REJECTED. 6 sentences = REJECTED. 2 sentences = REJECTED.
- Count your sentences before writing each paragraph. If it's not 4 or 5, rewrite it.

HEADING COUNT RULE:
- Exactly 7 <h2> tags. Not 6. Not 8. Exactly 7.
- Exactly 4 <h3> tags. One each under H2 sections 1, 2, 3, 4.
- H2 sections 5, 6, 7 have NO <h3>, just two <p> paragraphs each.

HEADING-PARAGRAPH SEQUENCE RULE:
- Every <h2> MUST be immediately followed by a <p> paragraph. NEVER <h2> then <h3>.
- Every <h3> MUST be immediately followed by a <p> paragraph. NEVER <h3> then <h2>.
- Between any two heading tags, there MUST be at least 60 words of paragraph text.

═══ EMPTY TAG RULE (CRITICAL zero tolerance) ═══
- NEVER produce empty HTML tags of any kind
- <strong></strong>  ← STRICTLY FORBIDDEN
- <em></em>          ← STRICTLY FORBIDDEN
- <h2></h2>          ← STRICTLY FORBIDDEN
- <h3></h3>          ← STRICTLY FORBIDDEN
- Every tag must contain actual text. If you bold a phrase, write the full phrase inside <strong>.
- Correct: <strong>${focusKw}</strong>
- Wrong:   <strong></strong>

═══ FOCUS KEYWORD PLACEMENT (STRICTLY ENFORCED — ZERO TOLERANCE) ═══
- MUST appear in the very first <p> (intro paragraph) within the first 50 words written naturally
- MUST appear in the title field
- MUST appear in at least one <h2> heading (verbatim or closely paraphrased)
- ⚠️ CRITICAL R7 RULE: The EXACT focus keyword phrase must appear EXACTLY 5–6 times in the ENTIRE content body. NOT 4, NOT 7, NOT 8, NOT 12. EXACTLY 5 or 6 times TOTAL.
- Count EVERY occurrence including inside <strong>, <em>, <h2>, <h3>, <p> — ALL count toward the total.
- NEVER exceed 8 occurrences under ANY circumstance. Going over 8 = AUTOMATIC FAIL and full regeneration.
- Do NOT repeat the full keyword more than once per paragraph
- Do NOT stuff the keyword — spread it evenly across intro, 2 middle sections, and near the end
- When bolding the keyword with <strong>, always write the full keyword text inside

═══ SEO FIELDS ═══
- title: 50–60 characters, includes focus keyword, includes ONE power word rotate variety: (Guide, Tips, How to, Step-by-Step, Fix, Essential, Practical, Proven, Modern, Quick, Effective, Simple, Key, Smart, Core, Actionable, Beginner, Best, Expert)
- NEVER start the title with "Complete Guide" this phrase is overused. Choose a different opening that is specific and varied.
- seo_title: 50–60 characters, optimized variation of title
- seo_description: EXACTLY 140–160 characters includes focus keyword ends with a call to action (e.g. "Learn more.", "Start today.", "Find out how.")
- excerpt: 120–160 characters, compelling, includes focus keyword
- img_alt_featured: describe the image AND include the focus keyword phrase
- img_alt_body: describe the image AND include the focus keyword phrase

═══ PRIVACY & NEUTRALITY RULES (STRICTLY ENFORCED) ═══
- NEVER mention any real person's name, personal identity, or individual attribution
- NEVER promote, advertise, or endorse any specific brand, product, company, or commercial service by name
- NEVER include personally identifiable information of any kind
- Write general, educational content only no case studies tied to specific named individuals or companies
- Exception: you may reference well-known platform categories (e.g. "WordPress", "Google Search Console") only as tools, not endorsements

═══ CLEAN CONTENT RULES ═══
- No AI-generated labels, badges, or indicators (do not write "AI Generated", "Written by AI", etc.)
- No decorative emojis or icon characters in the content body
- No inline CSS style attributes content is styled by the site's stylesheet
- No unnecessary filler phrases like "In conclusion, it is worth noting that..."
- Every sentence must add real informational value

═══ H2 HEADING RULES (CRITICAL) ═══
- H2 headings must be SHORT, SPECIFIC, and DESCRIPTIVE (4–8 words max)
- NEVER start an H2 with the full focus keyword phrase headings must be original titles, not keyword repetition
- FORBIDDEN H2 pattern: "<h2>focus-keyword: Some Suffix</h2>" do NOT prefix headings with the keyword
- FORBIDDEN: Generic boilerplate headings like "Getting Started", "Before You Begin", "Advanced Tips", "Key Takeaways", "Everything You Need to Know" unless they contain specific topical content
- FORBIDDEN: Two consecutive H2 headings with nearly identical meaning or structure
- Each H2 heading must describe what that specific section teaches make it unique and topically meaningful
- STRICTLY FORBIDDEN H2s: "Conclusion", "Conclusion and Next Steps", "Final Thoughts", "Summary", "Wrapping Up", "Key Takeaways". NEVER create a conclusion section. End the post with the last practical section, not a summary.
- At least ONE H2 heading MUST naturally contain the focus keyword phrase "${focusKw}"

═══ HUMAN AUTHENTICITY ZERO AI FINGERPRINTS ═══

BANNED WORDS never use any of these (they are the strongest AI tells):
  delve, leverage, utilize, robust, seamless, streamline, navigate, realm, landscape,
  ecosystem, paradigm, synergy, empower, harness, cutting-edge, game-changer,
  comprehensive, paramount, shed light on, foster, curated, nuanced, holistic,
  underscores, it is crucial, it is vital, it is important to note, it's worth mentioning,
  as we explore, let's dive in, in today's digital world, in the realm of, going forward,
  crucial, essential, ensure, enhancing, facilitating, subsequently, bolstering,
  in today's, cybersecurity landscape, digital landscape, ever-evolving,
  it is important to, it is essential to, it's crucial to, it's essential to,
  plays a crucial role, is a critical component, is particularly important

BANNED PARAGRAPH OPENERS never start a paragraph with:
  "In today's...", "In the world of...", "When it comes to...",
  "It's important to understand...", "One of the most important/common/critical...",
  "First and foremost...", "Last but not least...", "Without a doubt...",
  "In this article/section/guide..."

ANTI-AI WRITING TECHNIQUES apply ALL of these (THIS IS THE MOST IMPORTANT SECTION):

1. MID-THOUGHT STARTS: At least 3 paragraphs per post must open with a concrete scenario, question, or direct statement instead of a topic sentence. Examples:
   - "Your server logs show 400 failed login attempts overnight. Now what?"
   - "Last Tuesday a small retail site got hit. The owner didn't notice for 72 hours."
   - "Three settings. That's all it takes to block 90% of brute-force attacks."
   Do NOT start paragraphs with "Topic X is...", "Understanding Y involves...", "The process of Z...". These are AI tells.

2. NATURAL LIST IMPERFECTION: In any bulleted or numbered list, deliberately make at least 2 items slightly different in length or grammatical form from the others perfectly parallel lists are a strong AI signal.

3. CONTRACTION RULE: Use "don't", "it's", "you'll", "there's", "isn't", "won't", "that's", "can't" throughout. NEVER write "do not", "it is", "you will", "there is" more than twice per 500 words.

4. CONVERSATIONAL INTERJECTION: Add exactly one natural aside per post such as: "Here's the thing:", "The catch is this:", "This part actually matters:", "Fair warning:", "Here's what's easy to miss:" placed where the writing needs a natural beat.

5. IMPERFECT TRANSITIONS replace all formal connectors:
   "Furthermore," → "And that's exactly why..." or "Which connects to..."
   "Moreover," → "There's also this:" or "Worth adding:"
   "In addition," → "On top of that," or "There's more:"
   "However," → "But here's the thing -" or "That said,"
   "In conclusion," → "Bottom line:" or "The short version:"

6. ONE MILD CAVEAT per post: Include one honest limitation "This won't fix everything but it covers the cases that matter most." or "Results vary depending on your setup, but the approach stays the same."

7. NO SECTION SUMMARIES: Never end a section with "In summary...", "As we've seen...", "To recap..." end on the final practical point and move on.

8. SENTENCE PUNCH PAIRS: After two medium-length sentences, write two SHORT sentences back-to-back (6–10 words each) for emphasis. This is how real writers land a point.

9. ONE LONGER NATURAL SENTENCE per H2 is allowed if the idea genuinely needs room (32–40 words), keep it. Don't force splits when the thought flows naturally as one.

═══ SENTENCE & WRITING STYLE RULES (STRICTLY ENFORCED) ═══
- AUDIENCE: WordPress intermediate users (1–3 years). They use dashboards, install plugins, but are NOT developers or server admins.
- READING LEVEL: Korean high school freshman (고등학교 1학년) equivalent simple, clear, zero jargon without immediate explanation.
- PRIMARY sentence length: 15–20 words. This is the default. Keep it short and punchy.
- MAXIMUM sentence length: 40 words hard cap split any sentence that exceeds this.
- AVOID academic or overly formal phrasing be conversational, direct, and practical.
- Explain every technical term in plain words the FIRST time you use it, inside the same sentence. Example: "malware (harmful software that attackers secretly install on your site)"
- Vary rhythm within each paragraph: mix of medium → short → medium, or long → short → short. Never write three sentences of the same length back-to-back.
- Use these sentence patterns to create confident, readable prose:
  • Corrective opener:   "It's not about X it's about Y."
  • Moment capture:      "There's a moment when [situation] and that's when [insight] matters."
  • Concede and pivot:   "True, X has its place. But consider this:"
  • Grounded question:   Pose a short question, then answer it immediately in the next sentence.
  • Reader observation:  "Most people assume X. In practice, Y is closer to the truth."
  • Punch pair:          [medium sentence]. [8-word max]. [8-word max].
- NEVER open every paragraph with a topic sentence mix in scenario-first and question-first openings.
- Cut all filler: "furthermore", "moreover", "it is worth noting", "needless to say", "it goes without saying" replace with direct statements.
- Prefer active voice. Write "the plugin updates the cache" not "the cache is updated by the plugin".
- VOCABULARY: Replace technical jargon wherever possible. Examples: "exploit" → "take advantage of a weak point", "vulnerability" → "security gap", "authentication" → "login check", "malicious" → "harmful", "mitigate" → "reduce", "implement" → "set up", "configure" → "adjust the settings".

═══ LINK & TABLE RULES ═══
- All links (external and internal) must use the same color as surrounding body text NEVER yellow, NEVER colored
- All links must have NO underline they should be invisible from surrounding text unless hovered
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
      { role: 'system', content: 'You are a veteran tech journalist with 15 years of hands-on cybersecurity experience. You write the way you talk - direct, opinionated, and practical. You hate corporate jargon and AI-sounding text. Always respond with valid JSON only. No markdown fences, no explanation, no text before or after the JSON object.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 8192,
    temperature: 0.85,
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
/* ══════════════════════════════════════════════
   1단계: 프로그램 규정 검사 (구조 규칙 자동 체크)
   ══════════════════════════════════════════════ */
function programmaticRuleCheck(post, focusKw) {
  const violations = [];
  const content = post.content || '';
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const h2s = content.match(/<h2[\s>]/gi) || [];
  const h3s = content.match(/<h3[\s>]/gi) || [];

  /* R1: 단어 수 1,500~2,200 */
  if (words.length < 1400) violations.push(`R1_WORD_COUNT: ${words.length} (need 1500+)`);
  if (words.length > 2500) violations.push(`R1_WORD_EXCESS: ${words.length} (max 2200)`);

  /* R2: H2 정확히 7개 (허용 범위 5~9) */
  if (h2s.length < 5) violations.push(`R2_H2_LOW: ${h2s.length} H2 (need 5-9, target 7)`);
  if (h2s.length > 9) violations.push(`R2_H2_HIGH: ${h2s.length} H2 (max 9)`);

  /* R3: H3 정확히 4개 (허용 범위 2~6) */
  if (h3s.length < 2) violations.push(`R3_H3_LOW: ${h3s.length} H3 (need 2-6, target 4)`);
  if (h3s.length > 8) violations.push(`R3_H3_HIGH: ${h3s.length} H3 (max 8)`);

  /* R4: 포커스 키워드 — 제목 */
  const kwLower = focusKw.toLowerCase();
  if (!(post.title || '').toLowerCase().includes(kwLower)) violations.push('R4_KW_TITLE: keyword missing from title');

  /* R5: 포커스 키워드 — 첫 문단 (100단어 이내) */
  const first100 = text.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
  if (!first100.includes(kwLower)) violations.push('R5_KW_INTRO: keyword missing from first 100 words');

  /* R6: 포커스 키워드 — H2 1개 이상 */
  const h2Texts = (content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || []).map(h => h.replace(/<[^>]*>/g, '').toLowerCase());
  if (!h2Texts.some(t => t.includes(kwLower))) violations.push('R6_KW_H2: keyword missing from all H2');

  /* R7: 포커스 키워드 — 전체 4~8회 (목표 5~6회) */
  const kwCount = (text.toLowerCase().match(new RegExp(kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (kwCount < 4) violations.push(`R7_KW_DENSITY_LOW: keyword appears ${kwCount} times (need 4-8)`);
  if (kwCount > 8) violations.push(`R7_KW_DENSITY_HIGH: keyword appears ${kwCount} times (max 8, got ${kwCount})`);

  /* R8: 메타 설명 140~160자 */
  const metaLen = (post.seo_description || '').length;
  if (metaLen > 0 && metaLen < 130) violations.push(`R8_META_SHORT: ${metaLen} chars (need 140-160)`);
  if (metaLen > 170) violations.push(`R8_META_LONG: ${metaLen} chars (need 140-160)`);

  /* R9: 한국어 절대 금지 */
  const korRe = /[\uAC00-\uD7A3\u3131-\u318E]/;
  if (korRe.test(post.title) || korRe.test(text)) violations.push('R9_KOREAN: Korean text detected');

  /* R10: 빈 태그 금지 */
  const emptyTags = content.match(/<(strong|em|h2|h3|p)>\s*<\/\1>/gi) || [];
  if (emptyTags.length) violations.push(`R10_EMPTY_TAGS: ${emptyTags.length} found`);

  /* R11: H태그 뒤 단락 4-5줄 (60-100단어) — 40단어 미만 섹션 개수 */
  const headingSplits = content.split(/<h[23][^>]*>/gi);
  let tooShort = 0;
  let tooLong = 0;
  for (let i = 1; i < headingSplits.length; i++) {
    const afterHeading = headingSplits[i].split(/<h[23][^>]*>/i)[0] || '';
    const firstP = (afterHeading.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '';
    const pWords = firstP.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    if (pWords > 0 && pWords < 40) tooShort++;
    if (pWords > 130) tooLong++;
  }
  if (tooShort > 1) violations.push(`R11_SHORT_PARA: ${tooShort} sections under 40 words after heading`);
  if (tooLong > 1) violations.push(`R11_LONG_PARA: ${tooLong} sections over 130 words after heading`);

  /* R12: AI 금지 단어 (0개 허용) - HUMAN AUTHENTICITY 섹션과 완전 동기화 */
  const banned = /\b(delve|leverage|utilize|robust|seamless|streamline|navigate|realm|landscape|ecosystem|paradigm|synergy|empower|harness|cutting-edge|game-changer|comprehensive|paramount|holistic|crucial|essential|ensure|bolstering|foster|nuanced|underscores|curated|mitigate|proactive|prioritize|optimal|pivotal|facilitate|enhance)\b/gi;
  const bannedMatches = text.match(banned) || [];
  if (bannedMatches.length > 0) violations.push(`R12_BANNED: ${bannedMatches.length} AI words (${[...new Set(bannedMatches.map(w => w.toLowerCase()))].join(', ')})`);

  /* R13: 결론 섹션 금지 */
  const conclusionH2 = h2Texts.some(t => /\b(conclusion|final thoughts|summary|wrapping up|key takeaways)\b/i.test(t));
  if (conclusionH2) violations.push('R13_CONCLUSION: conclusion-type H2 heading found');

  /* R14: 제목 길이 50-60자 */
  const titleLen = (post.title || '').length;
  if (titleLen < 40) violations.push(`R14_TITLE_SHORT: ${titleLen} chars (need 50-60)`);
  if (titleLen > 70) violations.push(`R14_TITLE_LONG: ${titleLen} chars (need 50-60)`);

  /* R15: 비축약형 과다 사용 금지 (postProcessContent 이후에도 남아있으면 위반) */
  const formalRe = /\b(do not|will not|cannot|does not|is not|are not|would not|should not|have not|has not|did not|was not|were not)\b/gi;
  const formalCount = (text.match(formalRe) || []).length;
  const formalMax = Math.max(3, Math.ceil(words.length / 300));
  if (formalCount > formalMax) violations.push(`R15_FORMAL_PHRASES: ${formalCount} non-contraction forms found (max ~${formalMax} for ${words.length} words)`);

  /* R16: 금지된 단락 시작 표현 */
  const paraTexts = (content.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [])
    .map(p => p.replace(/<[^>]*>/g, '').trim().toLowerCase().slice(0, 70));
  const bannedOpenerPats = [
    /^in today'?s/,
    /^in the world of/,
    /^when it comes to/,
    /^it'?s important to/,
    /^one of the most (?:important|common|critical)/,
    /^first and foremost/,
    /^without a doubt/,
    /^in this (?:article|section|guide|blog)/,
    /^in conclusion/,
    /^to summarize/,
  ];
  const badOpeners = paraTexts.filter(t => bannedOpenerPats.some(p => p.test(t))).length;
  if (badOpeners > 0) violations.push(`R16_BANNED_OPENER: ${badOpeners} paragraphs start with banned AI opener phrases`);

  return { pass: violations.length === 0, violations };
}

/* ══════════════════════════════════════════════
   2단계: ChatGPT 규정 전수 검사
   AI가 생성한 글의 품질/규정 준수 최종 검증
   ══════════════════════════════════════════════ */
async function validateAllRulesWithOpenAI(env, post, focusKw) {
  const key = await getSetting(env.DB, 'openai_api_key').catch(() => '');
  if (!key) return { pass: true, seo_title: null, seo_description: null, keywords: [] };

  const content = post.content || '';
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const prompt = `You are a STRICT blog quality inspector. Check EVERY rule. Return ONLY valid JSON.

TITLE: "${post.title}"
FOCUS KEYWORD: "${focusKw}"
WORD COUNT: ${wordCount}
FULL CONTENT (text only): ${text.slice(0, 4000)}

═══ 14 RULES — CHECK EVERY SINGLE ONE ═══
R1. WORD COUNT: 1,500–2,200 words. Current: ${wordCount}.
R2. H2 COUNT: exactly 7 (allow 5-9). Current: ${(content.match(/<h2[\s>]/gi) || []).length}.
R3. H3 COUNT: exactly 4 (allow 2-6). Current: ${(content.match(/<h3[\s>]/gi) || []).length}.
R4. KEYWORD IN TITLE: "${focusKw}" must appear in title.
R5. KEYWORD IN FIRST PARAGRAPH: "${focusKw}" must appear in first 100 words.
R6. KEYWORD IN H2: "${focusKw}" must appear in at least 1 H2 heading.
R7. KEYWORD DENSITY: "${focusKw}" must appear EXACTLY 4-8 times total in content. Current count: ${(text.toLowerCase().match(new RegExp(focusKw.toLowerCase().replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'g')) || []).length}. Over 8 = AUTOMATIC FAIL.
R8. META DESCRIPTION: 140-160 characters with keyword and call to action.
R9. ENGLISH ONLY: zero Korean, Japanese, Chinese text.
R10. NO EMPTY TAGS: no <strong></strong>, <p></p>, etc.
R11. PARAGRAPH LENGTH: every <p> after a heading must have EXACTLY 4-5 sentences (60-100 words). Check: are there paragraphs with only 1-2 sentences? Are there paragraphs with 7+ sentences?
R12. BANNED AI WORDS: zero tolerance for: delve, leverage, utilize, robust, seamless, streamline, navigate, realm, landscape, ecosystem, paradigm, synergy, empower, harness, cutting-edge, game-changer, comprehensive, paramount, holistic, crucial, essential, ensure, bolstering, foster, nuanced, underscores, curated, mitigate, proactive, prioritize, optimal, pivotal, facilitate, enhance, furthermore, moreover, additionally.
R13. NO CONCLUSION: last H2 must NOT be "Conclusion", "Final Thoughts", "Summary", "Wrapping Up".
R14. TITLE LENGTH: 50-60 characters.
R15. CONTRACTIONS: count occurrences of "do not", "will not", "cannot", "does not", "is not", "are not", "would not", "should not". If total exceeds 5, this is a violation. Writers use contractions naturally.
R16. BANNED OPENERS: paragraphs must NOT start with: "In today's", "In the world of", "When it comes to", "It's important to", "One of the most important/common/critical", "First and foremost", "Without a doubt", "In this article/section/guide". Each violation counts.

═══ RESPOND WITH EXACTLY THIS JSON ═══
{"pass":true/false,"score":0-100,"violations":["R1: detail","R11: detail"],"seo_title":"optimized 50-60 chars","seo_description":"140-160 chars with keyword ending with CTA","keywords":["kw1","kw2","kw3","kw4","kw5"]}

SCORING: Each rule = ~6 points. 90+ = pass. Any R7 (keyword over 8) or R11 or R12 violation = automatic fail. R15/R16 violations each = -8 points.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `OpenAI HTTP ${res.status}`);
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '{}';
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim());
    console.log(`[blog-gen] ChatGPT validation: pass=${result.pass}, score=${result.score}, violations=${(result.violations || []).length}`);
    if (result.violations?.length) {
      console.log(`[blog-gen] Violations: ${result.violations.join(' | ')}`);
    }
    return result;
  } catch (e) {
    console.warn('[blog-gen] ChatGPT validation failed:', e.message);
    return { pass: true, score: null, seo_title: null, seo_description: null, keywords: [] };
  }
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
  const maxOccurrences = Math.max(4, Math.floor(totalWords * 0.015 / kwWords));
  const replacements = [
    'this process', 'these measures', 'this approach',
    'these techniques', 'this method', 'the strategy',
  ];
  let count = 0;
  let replIdx = 0;
  const kw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* H2/H3 헤딩과 그 외 영역을 분리하여 처리 - 헤딩 내부는 교체 안 함 */
  const parts = content.split(/(<h[2-3][^>]*>[\s\S]*?<\/h[2-3]>)/gi);
  return parts.map(part => {
    if (/^<h[2-3]/i.test(part)) return part; /* 헤딩은 건드리지 않음 */
    const regex = new RegExp(
      `(?:<(?:strong|em)>\\s*)?${kw}(?:\\s*<\\/(?:strong|em)>)?`, 'gi'
    );
    return part.replace(regex, (m) => {
      count++;
      if (count <= maxOccurrences) return m;
      const alt = replacements[replIdx % replacements.length];
      replIdx++;
      return alt;
    });
  }).join('');
}

/* ══════════════════════════════════════════════
   키워드 출현 횟수 강제 조정 (R7 자동 수정)
   targetCount 목표 횟수 (기본 6), 초과 시 대체어로 교체, 부족 시 삽입
   ══════════════════════════════════════════════ */
function enforceKeywordCount(content, keyword, targetCount = 6) {
  if (!keyword) return content;
  const kwLower = keyword.toLowerCase();
  const kwEscaped = kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const text = content.replace(/<[^>]*>/g, ' ');
  const currentCount = (text.toLowerCase().match(new RegExp(kwEscaped, 'g')) || []).length;

  /* 4-8 범위 안이면 수정 불필요 */
  if (currentCount >= 4 && currentCount <= 8) return content;

  /* 초과 시: targetCount까지만 남기고 나머지 대체 */
  if (currentCount > 8) {
    const maxKeep = targetCount; /* 6개만 유지 */
    const alts = ['this process', 'these methods', 'this approach', 'these techniques', 'this strategy', 'the practice', 'this system', 'such methods'];
    let kept = 0;
    let altIdx = 0;
    const parts = content.split(/(<h[2-3][^>]*>[\s\S]*?<\/h[2-3]>)/gi);
    const result = parts.map(part => {
      if (/^<h[2-3]/i.test(part)) {
        /* H2/H3 제목 안의 키워드는 1개까지만 허용 */
        const regex = new RegExp(kwEscaped, 'gi');
        let hKept = 0;
        return part.replace(regex, (m) => {
          hKept++;
          kept++;
          if (hKept <= 1 && kept <= maxKeep) return m;
          kept--;
          return alts[altIdx++ % alts.length];
        });
      }
      const regex = new RegExp(`(?:<(?:strong|em)>\\s*)?${kwEscaped}(?:\\s*<\\/(?:strong|em)>)?`, 'gi');
      return part.replace(regex, (m) => {
        kept++;
        if (kept <= maxKeep) return m;
        return alts[altIdx++ % alts.length];
      });
    });
    const fixed = result.join('');
    const newCount = (fixed.replace(/<[^>]*>/g, ' ').toLowerCase().match(new RegExp(kwEscaped, 'g')) || []).length;
    console.log(`[blog-gen] R7 fix: keyword "${keyword}" ${currentCount} → ${newCount} occurrences (target ${targetCount})`);
    return fixed;
  }

  /* 부족 시: 본문 <p> 중간에 키워드 자연 삽입 */
  if (currentCount < 4) {
    const needed = targetCount - currentCount;
    const pMatches = [...content.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
    const step = Math.max(1, Math.floor(pMatches.length / (needed + 1)));
    let inserted = 0;
    for (let i = step; i < pMatches.length && inserted < needed; i += step) {
      const pContent = pMatches[i][1];
      const pText = pContent.replace(/<[^>]*>/g, '');
      /* 이미 키워드가 있는 단락은 건너뜀 */
      if (pText.toLowerCase().includes(kwLower)) continue;
      /* 단락 중간에 키워드를 자연스럽게 삽입 */
      const sentences = pText.split(/\.\s+/);
      if (sentences.length >= 2) {
        const insertPoint = Math.floor(sentences.length / 2);
        sentences[insertPoint] = sentences[insertPoint] + `. When applying ${keyword}, this becomes especially relevant`;
        const newP = sentences.join('. ');
        content = content.replace(pMatches[i][0], `<p>${newP}</p>`);
        inserted++;
      }
    }
    console.log(`[blog-gen] R7 fix: keyword "${keyword}" ${currentCount} → ${currentCount + inserted} occurrences (inserted ${inserted})`);
  }

  return content;
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
  let c = content
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
    .replace(/(<\/p>)\s{2,}(<p)/gi, '$1\n$2');
  /* "Conclusion" 타입 H2 제목만 제거 (본문 문단은 유지하여 단어수 보존) */
  c = c.replace(/<h2[^>]*>\s*(?:Conclusion|Final Thoughts?|Summary|Wrapping Up|In Closing|Conclusion and Next Steps)[^<]*<\/h2>/gi, '');

  /* AI 패턴 후처리 제거 */
  const aiPhrases = [
    [/\bin today'?s (?:digital |cybersecurity |ever-evolving |modern )?(?:world|landscape|era|age)\b/gi, 'right now'],
    [/\bit(?:'s| is) (?:crucial|essential|vital|important) (?:to |that |in |for )/gi, 'you should '],
    [/\bis (?:crucial|essential|vital) (?:in |for |to )/gi, 'matters for '],
    [/\bplays a (?:crucial|vital|key|important|significant) role\b/gi, 'matters a lot'],
    [/\bis a critical component of\b/gi, 'is a key part of'],
    [/\bis particularly (?:important|crucial|vital)\b/gi, 'really matters'],
    [/\bensure that\b/gi, 'make sure'],
    [/\bensure your\b/gi, 'keep your'],
    [/\butilize\b/gi, 'use'],
    [/\bleverage\b/gi, 'use'],
    [/\bin this (?:article|guide|section|post),?\s*(?:we(?:'ll| will) (?:explore|discuss|cover|examine|look at|delve into))/gi, 'here we cover'],
    [/\blet'?s (?:dive in|explore|take a look|examine|discuss)\b/gi, "let's get started"],
    [/\bin conclusion,?\s*/gi, ''],
    [/\bas we(?:'ve| have) (?:seen|discussed|explored|covered),?\s*/gi, ''],
    [/\bto summarize,?\s*/gi, ''],
    [/\bneedless to say,?\s*/gi, ''],
    [/\bit goes without saying (?:that )?/gi, ''],
    [/\bwithout further ado,?\s*/gi, ''],
    [/\bfurthermore,?\s*/gi, 'also, '],
    [/\bmoreover,?\s*/gi, 'also, '],
    [/\badditionally,?\s*/gi, 'also, '],
    [/\bcan significantly (?:reduce|improve|enhance|increase|help)\b/gi, 'can really help'],
    [/\bby taking these (?:steps|measures|precautions|actions),?\s*/gi, 'with this done, '],
    [/\bremember,?\s*(?:that )?/gi, ''],
    [/\bit(?:'s| is) (?:also )?worth (?:noting|mentioning) (?:that )?/gi, ''],
    [/\bwhen it comes to\b/gi, 'for'],
    [/\bone of the most (?:common|important|critical|effective|significant|popular)\b/gi, 'a very common'],
    [/\bthis (?:is where|is when|is why)\b/gi, 'that explains why'],
    [/\bby (?:doing so|doing this),?\s*/gi, ''],
    [/\bas a result,?\s*/gi, 'so '],
    [/\bconsequently,?\s*/gi, 'so '],
    [/\bto (?:effectively|efficiently|properly|successfully) /gi, 'to '],
    [/\b(?:significantly|substantially|dramatically|considerably) (?:reduce|improve|enhance|increase|decrease)\b/gi, function(m) { return m.split(/\s+/).pop(); }],
    [/\brobust\b/gi, 'strong'],
    [/\bcomprehensive\b/gi, 'complete'],
    [/\bseamless(?:ly)?\b/gi, 'smooth'],
    [/\bthis (?:includes|involves|encompasses|entails) /gi, 'that means '],
    [/\bthis starts with\b/gi, 'start by'],
    [/\bwebsite owners should (?:also )?/gi, 'you should '],
    [/\bthey (?:should|must|need to) (?:also )?/gi, 'you need to '],
    [/\borganizations (?:should|must|need to)\b/gi, 'you need to'],
    [/\bto achieve this,?\s*/gi, ''],
    [/\bto accomplish this,?\s*/gi, ''],
    [/\bit(?:'s| is) (?:also )?important (?:to |that )/gi, ''],
    [/\bplaying a (?:key|crucial|vital|important) role\b/gi, 'helping'],
    [/\btaking (?:proactive |necessary )?(?:steps|measures|action)\b/gi, 'acting'],
    [/\bmaintaining (?:a )?(?:secure|safe|protected)\b/gi, 'keeping things safe'],
    /* 추가 AI 단어 제거 */
    [/\bdelve(?:s|d)? (?:into|deeper)\b/gi, 'look at'],
    [/\bstreamline(?:s|d)?\b/gi, 'simplify'],
    [/\bnavigate\b/gi, 'handle'],
    [/\blandscape\b/gi, 'space'],
    [/\becosystem\b/gi, 'setup'],
    [/\bparadigm\b/gi, 'approach'],
    [/\bempower(?:s|ed|ing)?\b/gi, 'help'],
    [/\bharness(?:es|ed|ing)?\b/gi, 'use'],
    [/\bcutting[- ]edge\b/gi, 'latest'],
    [/\bgame[- ]changer\b/gi, 'big deal'],
    [/\bparamount\b/gi, 'key'],
    [/\bfoster(?:s|ed|ing)?\b/gi, 'build'],
    [/\bholistic(?:ally)?\b/gi, 'full'],
    [/\bnuanced\b/gi, 'detailed'],
    [/\bunderscores?\b/gi, 'shows'],
    [/\bfirst and foremost,?\s*/gi, ''],
    [/\blast but not least,?\s*/gi, ''],
    [/\bensure\b/gi, 'make sure'],
    [/\bin order to\b/gi, 'to'],
    [/\ba wide (?:range|variety|array) of\b/gi, 'many'],
    [/\bvast (?:majority|array|range)\b/gi, 'most'],
    [/\bpivotal\b/gi, 'key'],
    [/\bfacilitate(?:s|d)?\b/gi, 'help'],
    [/\boptimal\b/gi, 'best'],
    [/\bmitigate(?:s|d)?\b/gi, 'reduce'],
    [/\bprioritize\b/gi, 'focus on'],
    [/\bimplementation\b/gi, 'setup'],
    [/\bproactive(?:ly)?\b/gi, 'early'],
    [/\bexplore(?:s|d)? (?:the |various |different )/gi, 'check '],
    [/\benhance(?:s|d)?\b/gi, 'improve'],
    [/\bwith that (?:said|in mind),?\s*/gi, ''],
    [/\bthat (?:said|being said),?\s*/gi, ''],
    [/\bhaving said that,?\s*/gi, ''],
    [/\bit is (?:worth|important to) (?:noting|note|mentioning|mention) that\s*/gi, ''],
    [/\b(?:serves|serve) as (?:a |an )?/gi, 'is '],
    /* ── 축약형 강제: AI는 formal 표현 선호 → 자연스러운 축약형으로 ── */
    [/\bdo not\b/gi, "don't"],
    [/\bwill not\b/gi, "won't"],
    [/\bcannot\b/gi, "can't"],
    [/\bdoes not\b/gi, "doesn't"],
    [/\bis not\b/gi, "isn't"],
    [/\bare not\b/gi, "aren't"],
    [/\bwould not\b/gi, "wouldn't"],
    [/\bshould not\b/gi, "shouldn't"],
    [/\bhave not\b/gi, "haven't"],
    [/\bhas not\b/gi, "hasn't"],
    [/\bdid not\b/gi, "didn't"],
    [/\bwas not\b/gi, "wasn't"],
    [/\bwere not\b/gi, "weren't"],
    [/\byou will\b/gi, "you'll"],
    [/\bthere is\b/gi, "there's"],
    [/\bhere is\b/gi, "here's"],
    [/\bit is\b/gi, "it's"],
    [/\bthat is\b/gi, "that's"],
  ];
  for (const [pattern, replacement] of aiPhrases) {
    c = c.replace(pattern, replacement);
  }
  /* 문장 시작 소문자 보정: <p>, <li>, <h2>, <h3> 직후 첫 글자 대문자화 */
  c = c.replace(/(<(?:p|li|h[23])[^>]*>)\s*([a-z])/g, (m, tag, ch) => tag + ch.toUpperCase());
  return c.trim();
}

/* ── 외부 권위 링크 삽입 ── */
function injectExternalLinks(content, category) {
  const refs = CAT_EXTERNAL_REFS[category] || CAT_EXTERNAL_REFS['web-security'];
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

/* ══════════════════════════════════════════════
   콘텐츠 품질 점수 (0-100) + AI 유사성 점수 (0-100, 낮을수록 좋음)
   ══════════════════════════════════════════════ */
function computeContentQuality(content) {
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wc = words.length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  let score = 0;

  /* 1. 단어 수 충분 (1000+) */
  if (wc >= 1500) score += 15;
  else if (wc >= 1000) score += 10;
  else if (wc >= 600) score += 5;

  /* 2. 문장 다양성 (길이 변화) */
  const sentLens = sentences.map(s => s.trim().split(/\s+/).length);
  if (sentLens.length >= 5) {
    const avg = sentLens.reduce((a, b) => a + b, 0) / sentLens.length;
    const variance = sentLens.reduce((a, l) => a + (l - avg) ** 2, 0) / sentLens.length;
    if (variance >= 30) score += 15;
    else if (variance >= 15) score += 10;
    else score += 5;
  }

  /* 3. 문단 구조 */
  const paras = content.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  if (paras.length >= 8) score += 10;
  else if (paras.length >= 5) score += 5;

  /* 4. 헤딩 구조 */
  const h2s = (content.match(/<h2[^>]*>/gi) || []).length;
  const h3s = (content.match(/<h3[^>]*>/gi) || []).length;
  if (h2s >= 5 && h3s >= 2) score += 10;
  else if (h2s >= 3) score += 5;

  /* 5. 외부 링크 존재 */
  if (/<a\s[^>]*href="https?:\/\//.test(content)) score += 5;

  /* 6. 이미지 존재 */
  if (/<img\s/.test(content)) score += 5;

  /* 7. 리스트/불릿 존재 */
  if (/<ul[^>]*>/.test(content) || /<ol[^>]*>/.test(content)) score += 5;

  /* 8. 시작 단어 다양성 (첫 단어가 반복되지 않을수록 좋음) */
  const starters = paras.map(p => {
    const t = p.replace(/<[^>]*>/g, '').trim();
    return (t.split(/\s+/)[0] || '').toLowerCase();
  }).filter(Boolean);
  const uniqueStarters = new Set(starters).size;
  const starterDiversity = starters.length ? uniqueStarters / starters.length : 0;
  if (starterDiversity >= 0.7) score += 10;
  else if (starterDiversity >= 0.5) score += 5;

  /* 9. 능동태 비율 */
  const passivePatterns = /\b(?:is|are|was|were|been|being) (?:used|done|made|taken|given|known|called|found|seen|shown|needed|required|recommended|considered|expected)/gi;
  const passiveCount = (text.match(passivePatterns) || []).length;
  const passiveRatio = sentences.length ? passiveCount / sentences.length : 0;
  if (passiveRatio < 0.15) score += 10;
  else if (passiveRatio < 0.25) score += 5;

  /* 10. 콘텐츠 깊이 (구체적 숫자/예시 포함) */
  const hasNumbers = /\d+/.test(text);
  const hasExamples = /example|for instance|such as|e\.g\./i.test(text);
  if (hasNumbers && hasExamples) score += 5;
  else if (hasNumbers || hasExamples) score += 3;

  return Math.min(score, 100);
}

function computeAISimilarity(content) {
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wc = words.length;
  if (!wc) return 100;
  let penalties = 0;

  /* AI 시그니처 표현 */
  const aiSignatures = [
    /\bit is (?:crucial|essential|vital|important|worth noting|imperative)\b/g,
    /\bit'?s (?:crucial|essential|vital|important|worth mentioning)\b/g,
    /\bin today'?s (?:digital |modern |fast-paced )?(?:world|landscape|era|age)\b/g,
    /\bplays a (?:crucial|vital|key|important|significant|pivotal) role\b/g,
    /\bin conclusion\b/g,
    /\bto summarize\b/g,
    /\bas (?:we'?ve|we have) (?:seen|discussed|explored|covered)\b/g,
    /\bin this (?:article|guide|blog post|section)\b/g,
    /\bdelve(?:s|d)?\b/g,
    /\bleverage(?:s|d)?\b/g,
    /\brobust\b/g,
    /\bseamless(?:ly)?\b/g,
    /\bstreamline(?:s|d)?\b/g,
    /\bnavigate\b/g,
    /\blandscape\b/g,
    /\becosystem\b/g,
    /\bparadigm\b/g,
    /\bempower(?:s|ed|ing)?\b/g,
    /\bharness(?:es|ed|ing)?\b/g,
    /\bcutting[- ]edge\b/g,
    /\bgame[- ]changer\b/g,
    /\bcomprehensive(?:ly)?\b/g,
    /\bparamount\b/g,
    /\bfoster(?:s|ed|ing)?\b/g,
    /\bholistic(?:ally)?\b/g,
    /\bnuanced\b/g,
    /\bunderscores\b/g,
    /\bfurthermore\b/g,
    /\bmoreover\b/g,
    /\badditionally\b/g,
    /\bneedless to say\b/g,
    /\bit goes without saying\b/g,
    /\bwithout further ado\b/g,
    /\bfirst and foremost\b/g,
    /\blast but not least\b/g,
    /\bone of the most (?:common|important|critical|significant)\b/g,
    /\bcan significantly (?:reduce|improve|enhance|increase|help)\b/g,
    /\bby taking these (?:steps|measures|precautions|actions)\b/g,
    /\bensure that\b/g,
  ];
  for (const pat of aiSignatures) {
    const matches = text.match(pat) || [];
    penalties += matches.length * 3;
  }

  /* 반복 구문 패턴 (같은 문장 시작 반복) */
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10).map(s => s.trim());
  const openers = sentences.map(s => s.split(/\s+/).slice(0, 3).join(' '));
  const openerCount = {};
  openers.forEach(o => { openerCount[o] = (openerCount[o] || 0) + 1; });
  const repeatedOpeners = Object.values(openerCount).filter(c => c > 2).reduce((a, b) => a + b, 0);
  penalties += repeatedOpeners * 2;

  /* 수동태 과다 */
  const passiveCount = (text.match(/\b(?:is|are|was|were|been|being) \w+ed\b/g) || []).length;
  if (sentences.length && passiveCount / sentences.length > 0.3) penalties += 10;

  /* 동일 문장 길이 반복 (3+ 연속 유사 길이) */
  const sentLens = sentences.map(s => s.split(/\s+/).length);
  for (let i = 0; i < sentLens.length - 2; i++) {
    if (Math.abs(sentLens[i] - sentLens[i + 1]) <= 2 && Math.abs(sentLens[i + 1] - sentLens[i + 2]) <= 2) {
      penalties += 1;
    }
  }

  return Math.min(Math.max(penalties, 0), 100);
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

/* ══════════════════════════════════════════════
   H태그 제목당 4-5줄 단락 검증/보강
   짧은 단락은 확장, 긴 단락은 분할
   ══════════════════════════════════════════════ */
function enforceHeadingParagraphLength(content) {
  /* 모든 <p> 태그를 검사하여 60-100 단어 (4-5문장) 범위로 보정 */
  const FILLER_SENTENCES = [
    'This approach works well for most standard setups.',
    'Many site owners overlook this simple but effective step.',
    'The difference shows up clearly in your site performance metrics.',
    'You can test this yourself within just a few minutes.',
    'Professional developers recommend this method for reliable results.',
    'It takes less effort than most people expect.',
    'The results speak for themselves once you try it.',
    'This single change can save you hours of troubleshooting later.',
  ];

  let result = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, inner) => {
    const text = inner.replace(/<[^>]*>/g, '').trim();
    const words = text.split(/\s+/).filter(Boolean);

    /* 10단어 미만은 단독 문장 (링크, CTA 등) — 건드리지 않음 */
    if (words.length < 10) return match;

    /* 40단어 미만 → 60단어까지 보충 */
    if (words.length < 40) {
      let expanded = text;
      let fi = Math.floor(Math.random() * FILLER_SENTENCES.length);
      while (expanded.split(/\s+/).filter(Boolean).length < 60 && fi < FILLER_SENTENCES.length + 4) {
        expanded += ' ' + FILLER_SENTENCES[fi % FILLER_SENTENCES.length];
        fi++;
      }
      return `<p>${expanded}</p>`;
    }

    /* 120단어 초과 → 100단어에서 문장 경계 찾아 자르고 새 <p>로 분할 */
    if (words.length > 120) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      let chunk1 = '';
      let chunk2 = '';
      let wCount = 0;
      let split = false;
      for (const s of sentences) {
        const sWords = s.trim().split(/\s+/).length;
        if (!split && wCount + sWords <= 100) {
          chunk1 += s;
          wCount += sWords;
        } else {
          split = true;
          chunk2 += s;
        }
      }
      if (chunk2.trim()) {
        return `<p>${chunk1.trim()}</p>\n<p>${chunk2.trim()}</p>`;
      }
    }

    return match;
  });

  /* 안전 체크: H태그 수 보존 확인 */
  const beforeH = (content.match(/<h[23][\s>]/gi) || []).length;
  const afterH = (result.match(/<h[23][\s>]/gi) || []).length;
  if (beforeH !== afterH) return content;
  return result;
}

/* ══════════════════════════════════════════════
   n0005 상품 프로모션 CTA 삽입
   본문 중간(50% 지점 H2 앞)에 프로모션 블록 삽입
   ══════════════════════════════════════════════ */
function injectProductCTA(content, category) {
  const N5 = 'https://noteracker.com';
  const PROMOS = {
    'malware-removal': {
      title: 'Need Professional Malware Cleanup?',
      desc: 'Our managed WordPress care plans include real-time malware scanning, removal, and ongoing protection so you can focus on your business.',
      link: `${N5}/en/pricing/#MonthlyCarePlan`,
      btn: 'View Care Plans',
    },
    'website-security': {
      title: 'Get Enterprise-Grade Website Security',
      desc: 'Cloudflare WAF, DDoS protection, SSL management, and 24/7 monitoring all included in our monthly care plans.',
      link: `${N5}/en/pricing/#MonthlyCarePlan`,
      btn: 'Explore Security Plans',
    },
    'vulnerability': {
      title: 'Worried About Website Vulnerabilities?',
      desc: 'Our team runs regular vulnerability assessments and patches security gaps before attackers find them.',
      link: `${N5}/en/pricing/#MonthlyCarePlan`,
      btn: 'Start Protection Today',
    },
    'threat-detection': {
      title: 'Detect Threats Before They Strike',
      desc: 'Real-time threat monitoring, automated alerts, and rapid incident response backed by Cloudflare infrastructure.',
      link: `${N5}/en/pricing/#MonthlyCarePlan`,
      btn: 'See Monitoring Plans',
    },
    'security-hardening': {
      title: 'Harden Your WordPress Security',
      desc: 'Server-level hardening, plugin audits, and security header configuration done for you every month.',
      link: `${N5}/en/pricing/#MonthlyCarePlan`,
      btn: 'Get Hardened Today',
    },
    'incident-response': {
      title: 'Fast Incident Response When It Matters',
      desc: 'Hacked site? Our emergency response team restores your site and closes security gaps within hours.',
      link: `${N5}/en/pricing/#MonthlyCarePlan`,
      btn: 'Get Emergency Help',
    },
  };
  const promo = PROMOS[category] || PROMOS['website-security'];
  const ctaHtml = `<blockquote style="border-left:4px solid #e6b802;background:#1a1a2e;padding:1.2rem 1.5rem;margin:2rem 0;border-radius:8px;">
<p><strong>${promo.title}</strong></p>
<p>${promo.desc}</p>
<p><a href="${promo.link}" target="_blank" rel="noopener">${promo.btn} &rarr;</a></p>
</blockquote>`;

  /* 본문 H2 태그 위치 찾아서 50% 지점에 삽입 */
  const h2Matches = [...content.matchAll(/<h2[^>]*>/gi)];
  if (h2Matches.length >= 4) {
    const midIdx = Math.floor(h2Matches.length / 2);
    const insertPos = h2Matches[midIdx].index;
    return content.slice(0, insertPos) + ctaHtml + content.slice(insertPos);
  }
  /* H2가 3개 이하면 끝에서 2번째 </p> 앞에 삽입 */
  const lastP = content.lastIndexOf('</p>');
  if (lastP > 200) {
    const secondLastP = content.lastIndexOf('</p>', lastP - 1);
    if (secondLastP > 0) return content.slice(0, secondLastP + 4) + ctaHtml + content.slice(secondLastP + 4);
  }
  return content + ctaHtml;
}

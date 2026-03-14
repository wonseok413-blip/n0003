import { autoInit, maybeCleanupSessions } from './db.js';
import { login, logout, me, getSession } from './auth.js';
import { adminRoute } from './admin.js';
import { blogGenRoute, runBlogGeneration, autoCollectSources } from './blog-gen.js';

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,Cookie',
  'Access-Control-Allow-Credentials': 'true',
};
const json = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{'Content-Type':'application/json',...CORS} });

// Video proxy routes: browser → Worker → R2 (with Cloudflare edge caching)
const VIDEO_ROUTES = {
};

async function handleVideo(request, originUrl) {
  const rangeHeader = request.headers.get('Range');
  const r2Response = await fetch(originUrl, {
    headers: rangeHeader ? { Range: rangeHeader } : {},
    cf: {
      cacheEverything: true,
      cacheTtl: 86400,
    },
  });
  const headers = new Headers(r2Response.headers);
  headers.set('Cache-Control', 'public, max-age=86400');
  return new Response(r2Response.body, { status: r2Response.status, headers });
}

const HEADER_HTML = `<div class="sub-header">
  <p>Join now and receive 20% off your first payment <a href="https://noteracker.com/en/pricing/#MonthlyCarePlan"><strong>Click!</strong></a></p>
</div>
<header class="header">
  <nav class="nav-container">
    <a href="/index.html" class="logo">
      <img src="/images/noteracker-logo-02-opt.webp" alt="Noteracker Ltd." width="143" height="40">
    </a>

    <ul class="nav-menu">
      <li><a href="/services" class="nav-link">Service</a></li>
      <li><a href="/product" class="nav-link">Product</a></li>
      <li><a href="/solution" class="nav-link">Solution</a></li>
      <li><a href="/blog" class="nav-link">Blog</a></li>
      <li><a href="/contact" class="nav-link">Contact</a></li>
    </ul>

    <div class="nav-cta">
      <a href="/dashboard-admin.html" class="cta-admin" id="cta-admin" style="display:none;" aria-label="Dashboard"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></a>
      <button class="cta-login" onclick="window.location.href='/login'">Log In</button>
      <button class="cta-button" onclick="window.location.href='https://noteracker.com/en/pricing/#MonthlyCarePlan'">Get Started</button>
    </div>

    <button class="mobile-toggle" aria-label="Toggle navigation menu" aria-expanded="false">
      <span></span>
      <span></span>
      <span></span>
    </button>
  </nav>
</header>
<div class="header-mini">
  <ul class="header-mini-nav">
    <li><a href="/services">Service</a></li>
    <li><a href="/product">Product</a></li>
    <li><a href="/solution">Solution</a></li>
    <li><a href="/blog">Blog</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</div>
<script>
(function(){
  var sid = sessionStorage.getItem('nr_session') || localStorage.getItem('nr_session');
  if (sid) {
    fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + sid } })
      .then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(d){
        if (!d.user_type) return;
        var btn = document.querySelector('.cta-login');
        if (btn) {
          btn.textContent = 'Log Out';
          btn.onclick = function(){
            fetch('/api/auth/logout',{method:'POST',headers:{'Authorization':'Bearer '+sid}});
            sessionStorage.removeItem('nr_session');
            localStorage.removeItem('nr_session');
            window.location.href='/';
          };
        }
        if (d.user_type === 'admin') {
          var adm = document.getElementById('cta-admin');
          if (adm) adm.style.display = 'flex';
        }
      }).catch(function(){});
  }
  if (window.__headerInit) return;
  window.__headerInit = true;
  function initHeader() {
    var header = document.querySelector('.header');
    var subHeader = document.querySelector('.sub-header');
    var miniHeader = document.querySelector('.header-mini');
    var mobileToggle = document.querySelector('.mobile-toggle');
    var navMenu = document.querySelector('.nav-menu');
    if (!header) return;
    window.addEventListener('scroll', function(){
      var y = window.pageYOffset;
      if (y > 50) {
        if (subHeader) subHeader.classList.add('hidden');
        header.style.transform = 'translateY(calc(-100% - 35px))';
        if (miniHeader) miniHeader.classList.add('visible');
      } else {
        if (subHeader) subHeader.classList.remove('hidden');
        header.style.transform = 'translateY(0)';
        header.style.top = '';
        if (miniHeader) miniHeader.classList.remove('visible');
      }
    });
    if (mobileToggle && navMenu) {
      mobileToggle.addEventListener('click', function(){
        navMenu.classList.toggle('active');
        mobileToggle.setAttribute('aria-expanded', String(navMenu.classList.contains('active')));
      });
      document.querySelectorAll('.nav-link').forEach(function(a){
        a.addEventListener('click', function(){ if (window.innerWidth <= 768) navMenu.classList.remove('active'); });
      });
    }
    var p = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(function(a){
      var href = a.getAttribute('href');
      if (href && (p === href || (p === '/' && href === '/index.html'))) a.classList.add('active');
    });
    document.querySelectorAll('.header-mini-nav a').forEach(function(a){
      var href = a.getAttribute('href');
      if (href && (p === href || (p === '/' && href === '/index.html'))) a.classList.add('active');
    });
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initHeader); }
  else { initHeader(); }
})();
</script>`;

const N5 = 'https://n0005.wonseok413.workers.dev';
const FOOTER_HTML = `<footer class="footer" id="footer">
    <div class="container">
      <div class="footer-top">
        <div class="footer-brand">
          <a href="/index.html" class="footer-logo">
            <img src="/images/noteracker-logo-02-opt.webp" alt="Noteracker Ltd." width="143" height="40" style="filter: brightness(1.2);">
          </a>
          <p>We cherish the value of genuine communication as we continue shaping our digital world. And if you ever wish to know more about Noteracker&#8230;</p>
          <div class="footer-email-label">Channel of communication</div>
          <div class="footer-email">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <a href="mailto:support@noteracker.com">support@noteracker.com</a>
          </div>
          <div class="footer-brand-links">
            <a href="https://noteracker.uk">Noteracker UK Ltd.</a>
            <a href="https://noteracker.kr">Noteracker Korea</a>
            <a href="https://noteracker.com">Noteracker.com</a>
          </div>
        </div>

        <div class="footer-cols">
          <div class="footer-col">
          <h4>Products</h4>
          <ul>
            <li><a href="${N5}/service">Website Design &amp; Build</a></li>
            <li><a href="${N5}/service">WP Complete Rebuild</a></li>
            <li><a href="${N5}/service">WP Performance &amp; Security</a></li>
            <li><a href="${N5}/pricing.html">Monthly WP Care Plans</a></li>
            <li><a href="${N5}/service">Digital file</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4>Support</h4>
          <ul>
            <li><a href="${N5}/contact.html#Process">Order Process</a></li>
            <li><a href="${N5}/contact.html#Process">Subscription Process</a></li>
            <li><a href="${N5}/contact.html#FAQs">FAQs</a></li>
            <li><a href="${N5}/contact.html">User Guide</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4>SNS</h4>
          <ul>
            <li><a href="https://www.instagram.com/" target="_blank" rel="noopener">Instagram</a></li>
            <li><a href="https://www.facebook.com/" target="_blank" rel="noopener">Facebook</a></li>
            <li><a href="https://www.youtube.com/" target="_blank" rel="noopener">YouTube</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4>Company</h4>
          <ul>
            <li><a href="${N5}/#">About Us</a></li>
            <li><a href="${N5}/service">Service</a></li>
            <li><a href="${N5}/shop.html">Shop</a></li>
            <li><a href="${N5}/#">Our story</a></li>
            <li><a href="${N5}/blog.html">Blog</a></li>
          </ul>
        </div>

        <div class="footer-col footer-col-compliance">
          <h4>Compliance</h4>
          <ul>
            <li><a href="${N5}/terms-of-service.html" target="_blank" rel="noopener">Terms of Service</a></li>
            <li><a href="${N5}/privacy-policy.html" target="_blank" rel="noopener">Privacy Policy</a></li>
            <li><a href="${N5}/gdpr-eprivacy.html" target="_blank" rel="noopener">GDPR &amp; ePrivacy</a></li>
            <li><a href="${N5}/cookie-policy.html" target="_blank" rel="noopener">Cookie Policy</a></li>
            <li><a href="${N5}/refund-guide.html" target="_blank" rel="noopener">Refund Guide</a></li>
          </ul>
        </div>
        </div>
      </div>

      <div class="footer-bottom">
        <div class="footer-copy">
          <strong>&copy; 2026 Noteracker Korea</strong><br />
          418-38-01542 3F, Room 302-J37, 36 Daeji-ro,<br />Suji-gu, Yongin-si, Gyeonggi-do, 16873, South Korea
        </div>
      </div>
      <div class="footer-trademark">
        The WordPress&reg; and WooCommerce&reg; trademarks belong to the WordPress Foundation and WooCommerce, Inc. Reference to these trademarks, along with Breakdance Builder, WP Rocket, Wordfence, Perfmatters, Rank Math, and Object Cache Pro, is strictly for identification purposes. Noteracker is an independent agency specializing in website optimization and management. These professional software tools are utilized solely to provide premium performance and security as part of our management services; they are not for individual resale. Noteracker is not endorsed by, affiliated with, or owned by the owners of these respective trademarks.
      </div>
    </div>
  </footer>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p   = url.pathname;
    const m   = request.method;

    /* ── DB 초기화 ── */
    await autoInit(env.DB);
    await maybeCleanupSessions(env.DB);

    /* ── CORS preflight ── */
    if (m === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    /* ── Video proxy ── */
    if (VIDEO_ROUTES[p]) {
      return handleVideo(request, VIDEO_ROUTES[p]);
    }

    /* ── API routes ── */
    if (p.startsWith('/api/')) {

      /* Auth */
      if (p === '/api/auth/login'  && m === 'POST') return login(request, env);
      if (p === '/api/auth/logout' && m === 'POST') return logout(request, env);
      if (p === '/api/auth/me'     && m === 'GET')  return me(request, env);

      /* 공개 로고 */
      if (p === '/api/public/logo' && m === 'GET') {
        return adminRoute(request, url, env, null);
      }

      /* 디지털 상품 프록시 (N0005 production) */
      if (p === '/api/shop/products' && m === 'GET') {
        try {
          const r = await fetch('https://noteracker.com/api/shop/products');
          if (!r.ok) return json({ products: [] });
          const d = await r.json();
          return json(d);
        } catch { return json({ products: [] }); }
      }

      /* Lottie 애니메이션 JSON 프록시 (CORS 우회) */
      const lottieJsonMatch = p.match(/^\/api\/lottie\/(.+\.json)$/);
      if (lottieJsonMatch && m === 'GET') {
        try {
          const r = await fetch('https://noteracker.com/api/lottie/' + lottieJsonMatch[1]);
          if (!r.ok) return new Response('Not found', { status: 404, headers: CORS });
          const data = await r.arrayBuffer();
          const h = new Headers(CORS);
          h.set('Content-Type', 'application/json');
          h.set('Cache-Control', 'public, max-age=86400');
          return new Response(data, { status: 200, headers: h });
        } catch {
          return new Response('Not found', { status: 404, headers: CORS });
        }
      }

      /* 공개 블로그 API */
      if (p === '/api/blog' && m === 'GET') {
        const rows = await env.DB.prepare(
          `SELECT p.id, p.title, p.slug, p.excerpt, p.featured_image, p.category, p.tags, p.published_at, p.created_at,
                  a.name AS author_name, a.avatar AS author_avatar
           FROM blog_posts p LEFT JOIN blog_authors a ON p.author_id = a.id
           WHERE p.status='published' ORDER BY p.published_at DESC`
        ).all();
        return json({ posts: rows.results ?? [] });
      }
      const blogSlugMatch = p.match(/^\/api\/blog\/(.+)$/);
      if (blogSlugMatch && m === 'GET') {
        const post = await env.DB.prepare(
          `SELECT p.*, a.name AS author_name, a.title AS author_title, a.avatar AS author_avatar, a.bio AS author_bio
           FROM blog_posts p LEFT JOIN blog_authors a ON p.author_id = a.id
           WHERE p.slug=? AND p.status='published'`
        ).bind(blogSlugMatch[1]).first();
        if (!post) return json({ error: 'Post not found' }, 404);
        const translations = await env.DB.prepare(
          'SELECT * FROM blog_post_translations WHERE post_id=? ORDER BY lang'
        ).bind(post.id).all();
        return json({ post, translations: translations.results ?? [] });
      }

      /* 블로그 자동생성 API (세션 확인) n0005 프로덕션과 동일 패턴 */
      if (p.startsWith('/api/admin/blog-gen/')) {
        const session = await getSession(env.DB, request, 'admin');
        if (!session) return json({ error: 'Unauthorized' }, 401);
        const res = await blogGenRoute(request, url, env);
        if (res !== null) return res;
      }

      /* 관리자 API (세션 확인) */
      if (p.startsWith('/api/admin/')) {
        const session = await getSession(env.DB, request, 'admin');
        if (!session) return json({ error: 'Unauthorized' }, 401);
        return adminRoute(request, url, env, session);
      }

      return json({ error: 'Not found' }, 404);
    }

    /* ── 정적 파일 / HTML ── */
    const response = await env.ASSETS.fetch(request);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      const ext = p.split('.').pop()?.toLowerCase();
      const longCache = ['css','js','webp','png','jpg','jpeg','gif','svg','ico','woff','woff2','ttf','eot'];
      if (longCache.includes(ext)) {
        const nh = new Headers(response.headers);
        nh.set('Cache-Control', 'public, max-age=2592000, immutable');
        return new Response(response.body, { status: response.status, headers: nh });
      }
      return response;
    }

    const transformed = new HTMLRewriter()
      .on('#header-one', {
        element(el) {
          el.replace(HEADER_HTML, { html: true });
        },
      })
      .on('#footer-one', {
        element(el) {
          el.replace(FOOTER_HTML, { html: true });
        },
      })
      .transform(response);

    const newHeaders = new Headers(transformed.headers);
    newHeaders.set('Cache-Control', 'public, max-age=60, s-maxage=600');
    return new Response(transformed.body, {
      status: transformed.status,
      headers: newHeaders,
    });
  },

  /* ── Cron 트리거: 12시간마다 블로그 1개 자동 생성 (하루 2개) ── */
  async scheduled(event, env, ctx) {
    try {
      await autoInit(env.DB);
      await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
      console.log('[cron] Session cleanup done');
    } catch (e) {
      console.error('[cron] Session cleanup error:', e.message);
    }
    /* DB 소스 자동 고도화 (카테고리 순환, 매일 1개 추가) */
    try {
      const collected = await autoCollectSources(env);
      console.log(`[cron] Auto source enrichment done: ${collected} new source added`);
    } catch (e) {
      console.error('[cron] Auto source enrichment failed:', e.message);
    }
    /* 블로그 자동 생성 */
    try {
      const count = await runBlogGeneration(env, 1);
      console.log(`[cron] Blog generation done: ${count} post(s) created`);
    } catch (e) {
      console.error('[cron] Blog generation failed:', e.message);
    }
  },
};

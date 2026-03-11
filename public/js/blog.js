/* ═══════════════════════════════════════════
   blog.js — Blog page: API 동적 로딩 + 싱글포스트 연결
   ═══════════════════════════════════════════ */

(function () {
  var ALL_POSTS = [];
  var STATIC_FEATURED = null;
  var STATIC_GRID = null;

  /* ── Lottie 네비 ── */
  var steps = document.querySelectorAll('.lstep');
  var navBtns = document.querySelectorAll('.lnav-btn');
  var lbl = document.getElementById('lnavLabel');

  function goStep(idx) {
    steps.forEach(function (s) { s.classList.remove('lstep-active'); });
    navBtns.forEach(function (b) { b.classList.remove('active'); });
    if (steps[idx]) {
      steps[idx].querySelectorAll('[style*="--d"], .lstep-fill').forEach(function (el) {
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
      });
      steps[idx].classList.add('lstep-active');
    }
    if (navBtns[idx]) navBtns[idx].classList.add('active');
    if (lbl && navBtns[idx]) lbl.textContent = navBtns[idx].dataset.label || '';
  }

  navBtns.forEach(function (btn, idx) {
    btn.addEventListener('click', function () { goStep(idx); });
  });

  /* ── Featured 렌더 ── */
  function renderFeatured(post) {
    var wrap = document.getElementById('featured-wrap');
    if (!wrap || !post) return;
    var cat = (post.category || 'Blog').replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    var excerpt = (post.excerpt || '').slice(0, 220);
    var thumb = post.featured_image
      ? '<img src="' + post.featured_image + '" alt="' + esc(post.title) + '" style="width:100%;height:100%;object-fit:cover;">'
      : '<div class="featured-thumb-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
    wrap.innerHTML =
      '<a href="/blog-post.html?slug=' + encodeURIComponent(post.slug) + '" class="featured-card">'
      + '<div class="featured-thumb">' + thumb + '<div class="featured-badge">Featured</div></div>'
      + '<div class="featured-body">'
      + '<div class="featured-cat">' + esc(cat) + '</div>'
      + '<h2>' + esc(post.title || '') + '</h2>'
      + '<p>' + esc(excerpt) + '</p>'
      + '</div>'
      + '</a>';
  }

  /* ── Grid 렌더 ── */
  function renderGrid(posts) {
    var grid = document.getElementById('posts-grid');
    if (!grid) return;
    if (!posts.length) {
      if (STATIC_GRID !== null) grid.innerHTML = STATIC_GRID;
      return;
    }
    grid.innerHTML = posts.map(function (p) {
      var cat = (p.category || '').toLowerCase();
      var catLabel = (p.category || 'Blog').replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      var date = p.published_at
        ? new Date(p.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
      var excerpt = (p.excerpt || '').slice(0, 140);
      var thumb = p.featured_image
        ? '<img src="' + p.featured_image + '" alt="' + esc(p.title) + '" style="width:100%;height:100%;object-fit:cover;">'
        : '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
      return '<a href="/blog-post.html?slug=' + encodeURIComponent(p.slug) + '" class="post-card" data-cat="' + esc(cat) + '">'
        + '<div class="post-thumb">' + thumb + '<div class="post-thumb-accent"></div></div>'
        + '<div class="post-body">'
        + '<div class="post-cat">' + esc(catLabel) + '</div>'
        + '<h3>' + esc(p.title || '') + '</h3>'
        + '<p>' + esc(excerpt) + '</p>'
        + '<div class="post-footer">'
        + '<div class="post-meta">' + esc(date) + '</div>'
        + '<div class="post-read">Read <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>'
        + '</div>'
        + '</div>'
        + '</a>';
    }).join('');
  }

  /* ── 카테고리 필터 ── */
  function applyFilter(cat) {
    document.querySelectorAll('.posts-grid .post-card').forEach(function (card) {
      card.style.display = (cat === 'all' || card.dataset.cat === cat) ? 'flex' : 'none';
    });
  }

  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      applyFilter(btn.dataset.cat);
    });
  });

  /* ── static 콘텐츠 백업 ── */
  var gridEl = document.getElementById('posts-grid');
  if (gridEl) STATIC_GRID = gridEl.innerHTML;
  var featWrap = document.getElementById('featured-wrap');
  if (featWrap) STATIC_FEATURED = featWrap.innerHTML;

  /* ── API 로딩 ── */
  fetch('/api/blog')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      ALL_POSTS = d.posts || [];
      if (!ALL_POSTS.length) return; // API 포스트 없으면 static 유지
      renderFeatured(ALL_POSTS[0]);
      renderGrid(ALL_POSTS);
    })
    .catch(function () {}); // 오류 시 static 유지

  /* ── 유틸 ── */
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();

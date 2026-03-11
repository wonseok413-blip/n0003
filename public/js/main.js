// Noteracker Ltd. - Main JavaScript

// Initialize everything after DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
  await loadComponents();
  initFadeInAnimations();
  initSmoothScrolling();
  createMalwareAnimation();
  initCounterAnimation();
});

// Load shared header and footer components
async function loadComponents() {
  const headerEl = document.getElementById('header-one');
  const footerEl = document.getElementById('footer-one');

  const fetches = [];
  var cbv = 'v=7';
  if (headerEl) fetches.push(fetch('/components/header.html?' + cbv).then(r => r.text()));
  else fetches.push(null);
  if (footerEl) fetches.push(fetch('/components/footer.html?' + cbv).then(r => r.text()));
  else fetches.push(null);

  const [headerHTML, footerHTML] = await Promise.all(fetches);

  if (headerEl && headerHTML) headerEl.outerHTML = headerHTML;
  if (footerEl && footerHTML) footerEl.outerHTML = footerHTML;

  // Initialize components that depend on header/footer (skip if inline header script already ran)
  if (!window.__headerInit) {
    window.__headerInit = true;
    initMobileToggle();
    initHeaderScroll();
    setActiveNav();
  }
}

// Mobile Navigation Toggle
function initMobileToggle() {
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (mobileToggle) {
    mobileToggle.addEventListener('click', function() {
      navMenu.classList.toggle('active');
      var expanded = navMenu.classList.contains('active');
      mobileToggle.setAttribute('aria-expanded', String(expanded));
    });
  }

  // Close mobile menu when clicking on a link
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', function() {
      if (window.innerWidth <= 768) {
        navMenu.classList.remove('active');
      }
    });
  });
}

// Header Scroll Effect with Hide/Show
function initHeaderScroll() {
  let lastScroll = 0;
  const header = document.querySelector('.header');
  const subHeader = document.querySelector('.sub-header');
  if (!header) return;

  window.addEventListener('scroll', function() {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Sub-header: hide on scroll down
    if (subHeader) {
      if (currentScroll > 50) {
        subHeader.classList.add('hidden');
        header.style.top = '0';
      } else {
        subHeader.classList.remove('hidden');
        header.style.top = '';
      }
    }

    if (currentScroll > lastScroll && currentScroll > 100) {
      header.style.transform = 'translateY(-100%)';
    } else {
      header.style.transform = 'translateY(0)';
    }

    lastScroll = currentScroll;
  });
}

// Smooth Scrolling for Anchor Links
function initSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href !== '#' && href !== '') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          const headerOffset = 80;
          const elementPosition = target.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
      }
    });
  });
}

// Active Navigation Highlight
function setActiveNav() {
  const pathname = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (pathname === href || (pathname === '/' && href === '/index.html')) {
      link.classList.add('active');
    }
  });
}

// Intersection Observer for Fade-in Animations
function initFadeInAnimations() {
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.card, .stat-card, .section-header').forEach(el => {
    el.classList.add('fade-init');
    observer.observe(el);
  });
}

// Counter Animation for Stats
function animateCounter(element) {
  const target = parseInt(element.getAttribute('data-target'));
  const duration = 2000;
  const step = target / (duration / 16);
  let current = 0;

  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      element.textContent = target.toLocaleString();
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current).toLocaleString();
    }
  }, 16);
}

function initCounterAnimation() {
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
        animateCounter(entry.target);
        entry.target.classList.add('counted');
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.stat-number').forEach(stat => {
    statsObserver.observe(stat);
  });
}

// Enhanced 4-Stage Malware Animation (450x450px)
function createMalwareAnimation() {
  const container = document.getElementById('malware-animation');
  if (!container) return;

  const NS = 'http://www.w3.org/2000/svg';
  const W = 450, H = 450;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.maxWidth = W + 'px';
  svg.style.margin = '0 auto';
  svg.style.display = 'block';

  // === Helper functions ===
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    return e;
  }

  // === Shared browser mockup builder ===
  function createBrowserMockup(borderColor, glowClass) {
    const g = el('g');

    // Browser window frame
    const frame = el('rect', { x: 55, y: 40, width: 340, height: 280, rx: 12, fill: '#1c2228', stroke: borderColor, 'stroke-width': 3 });
    if (glowClass) frame.setAttribute('class', glowClass);
    g.appendChild(frame);

    // Title bar background
    g.appendChild(el('rect', { x: 55, y: 40, width: 340, height: 36, rx: '12', fill: '#323841' }));
    // Clip bottom corners of title bar
    g.appendChild(el('rect', { x: 55, y: 64, width: 340, height: 12, rx: '0', fill: '#323841' }));

    // Window dots (close, minimize, maximize)
    g.appendChild(el('circle', { cx: 76, cy: 58, r: 5, fill: '#ff5f57' }));
    g.appendChild(el('circle', { cx: 94, cy: 58, r: 5, fill: '#febc2e' }));
    g.appendChild(el('circle', { cx: 112, cy: 58, r: 5, fill: '#28c840' }));

    // URL bar
    g.appendChild(el('rect', { x: 135, y: 48, width: 200, height: 20, rx: 6, fill: '#252b30' }));
    const urlText = el('text', { x: 165, y: 62, fill: '#616161', 'font-size': 10, 'font-family': 'monospace' });
    urlText.textContent = 'yoursite.com';
    g.appendChild(urlText);
    // Lock icon placeholder
    g.appendChild(el('rect', { x: 141, y: 52, width: 12, height: 12, rx: 2, fill: '#475568' }));

    // Content area — sidebar
    g.appendChild(el('rect', { x: 62, y: 84, width: 70, height: 228, rx: 4, fill: '#252b30' }));

    // Sidebar nav items
    for (let i = 0; i < 5; i++) {
      g.appendChild(el('rect', { x: 70, y: 96 + i * 28, width: 50, height: 8, rx: 3, fill: '#3a4049' }));
    }

    // Main content lines
    for (let i = 0; i < 7; i++) {
      const lineW = 180 - (i % 3) * 30;
      g.appendChild(el('rect', { x: 145, y: 96 + i * 28, width: lineW, height: 8, rx: 3, fill: '#3a4049', class: 'content-line-' + i }));
    }

    // Header bar in content
    g.appendChild(el('rect', { x: 145, y: 84, width: 100, height: 6, rx: 3, fill: '#475568' }));

    return g;
  }

  // =====================================================
  // STAGE 1: INFECTED
  // =====================================================
  const stage1 = el('g', { id: 'stage-1', opacity: 0 });
  const browser1 = createBrowserMockup('#ff4444', 'glow-red');
  stage1.appendChild(browser1);

  // Infected content lines (some red)
  const infectedLines = browser1.querySelectorAll('[class^="content-line-"]');
  [1, 3, 5].forEach(i => {
    const line = infectedLines[i];
    if (line) { line.setAttribute('fill', '#ff4444'); line.setAttribute('opacity', '0.7'); }
  });

  // Warning icon
  const warn1 = el('text', { x: 260, y: 220, 'text-anchor': 'middle', 'font-size': 40, class: 'shake-anim' });
  warn1.textContent = '\u26A0\uFE0F';
  stage1.appendChild(warn1);

  // Malware particles — varying sizes & orbits
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const radius = 140 + (i % 3) * 20;
    const size = 3 + (i % 4) * 1.5;
    const p = el('circle', {
      cx: 225 + Math.cos(angle) * radius,
      cy: 200 + Math.sin(angle) * radius,
      r: size,
      fill: '#ff4444',
      class: 'malware-particle-' + (i % 3)
    });
    stage1.appendChild(p);
  }

  // Virus skull icons floating
  const virusPositions = [[80, 160], [370, 140], [90, 310], [380, 280]];
  virusPositions.forEach(([vx, vy], idx) => {
    const v = el('text', { x: vx, y: vy, 'font-size': 18, opacity: 0.6, class: 'virus-float-' + (idx % 2) });
    v.textContent = '\uD83E\uDDA0';
    stage1.appendChild(v);
  });

  // Label
  const label1 = el('text', { x: 225, y: 358, 'text-anchor': 'middle', fill: '#ff4444', 'font-size': 18, 'font-weight': 'bold', 'font-family': 'Noto Sans, sans-serif', class: 'blink-anim' });
  label1.textContent = 'INFECTED';
  stage1.appendChild(label1);

  // Status bar
  const statusBar1 = el('rect', { x: 145, y: 370, width: 160, height: 4, rx: 2, fill: '#ff4444', opacity: 0.5 });
  stage1.appendChild(statusBar1);

  // =====================================================
  // STAGE 2: TREATING
  // =====================================================
  const stage2 = el('g', { id: 'stage-2', opacity: 0 });
  const browser2 = createBrowserMockup('#e6b802', '');
  stage2.appendChild(browser2);

  // Scan line (horizontal, animated top to bottom)
  const scanLine = el('rect', { x: 62, y: 84, width: 326, height: 2, fill: '#e6b802', opacity: 0.9, class: 'scan-line-anim' });
  stage2.appendChild(scanLine);

  // Syringe icon
  const syringe2 = el('text', { x: 260, y: 195, 'text-anchor': 'middle', 'font-size': 32 });
  syringe2.textContent = '\uD83D\uDC89';
  stage2.appendChild(syringe2);

  // Progress bar background
  g2progressBg = el('rect', { x: 145, y: 270, width: 200, height: 12, rx: 6, fill: '#323841' });
  stage2.appendChild(g2progressBg);

  // Progress bar fill (animated)
  const progressFill = el('rect', { x: 145, y: 270, width: 0, height: 12, rx: 6, fill: '#e6b802', class: 'progress-fill-anim' });
  stage2.appendChild(progressFill);

  // Progress percentage text
  const progressText = el('text', { x: 245, y: 300, 'text-anchor': 'middle', fill: '#e6b802', 'font-size': 12, 'font-family': 'Noto Sans, sans-serif', class: 'progress-text-anim' });
  progressText.textContent = 'Scanning...';
  stage2.appendChild(progressText);

  // Particles fading out (fewer than stage 1)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const p = el('circle', {
      cx: 225 + Math.cos(angle) * 150,
      cy: 200 + Math.sin(angle) * 150,
      r: 3,
      fill: '#ff4444',
      opacity: 0.4,
      class: 'particle-fade-out'
    });
    stage2.appendChild(p);
  }

  // Label
  const label2 = el('text', { x: 225, y: 358, 'text-anchor': 'middle', fill: '#e6b802', 'font-size': 18, 'font-weight': 'bold', 'font-family': 'Noto Sans, sans-serif' });
  label2.textContent = 'TREATING...';
  stage2.appendChild(label2);

  // =====================================================
  // STAGE 3: CLEANED
  // =====================================================
  const stage3 = el('g', { id: 'stage-3', opacity: 0 });
  const browser3 = createBrowserMockup('#899e2e', '');
  stage3.appendChild(browser3);

  // All content lines restored to clean color
  browser3.querySelectorAll('[class^="content-line-"]').forEach(line => {
    line.setAttribute('fill', '#4a5260');
  });

  // Checkmark (SVG path with stroke-dasharray animation)
  const checkG = el('g', { transform: 'translate(210, 175)' });
  const checkCircle = el('circle', { cx: 0, cy: 0, r: 28, fill: 'none', stroke: '#899e2e', 'stroke-width': 3, class: 'check-circle-draw' });
  checkG.appendChild(checkCircle);
  const checkPath = el('path', { d: 'M-12,2 L-4,10 L14,-8', fill: 'none', stroke: '#899e2e', 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'check-draw' });
  checkG.appendChild(checkPath);
  stage3.appendChild(checkG);

  // Sparkle particles
  const sparklePositions = [[100, 130], [350, 120], [80, 280], [370, 260], [180, 100], [300, 100], [120, 200], [340, 200]];
  sparklePositions.forEach(([sx, sy], idx) => {
    const sp = el('text', { x: sx, y: sy, 'font-size': 14, opacity: 0, class: 'sparkle-anim-' + (idx % 3) });
    sp.textContent = '\u2728';
    stage3.appendChild(sp);
  });

  // Label
  const label3 = el('text', { x: 225, y: 358, 'text-anchor': 'middle', fill: '#899e2e', 'font-size': 18, 'font-weight': 'bold', 'font-family': 'Noto Sans, sans-serif' });
  label3.textContent = 'CLEANED';
  stage3.appendChild(label3);

  // Green status bar
  stage3.appendChild(el('rect', { x: 145, y: 370, width: 160, height: 4, rx: 2, fill: '#899e2e', opacity: 0.6 }));

  // =====================================================
  // STAGE 4: SECURED
  // =====================================================
  const stage4 = el('g', { id: 'stage-4', opacity: 0 });
  const browser4 = createBrowserMockup('#899e2e', '');
  stage4.appendChild(browser4);

  // Shield icon (center of browser content)
  const shield4 = el('text', { x: 225, y: 210, 'text-anchor': 'middle', 'font-size': 44 });
  shield4.textContent = '\uD83D\uDEE1\uFE0F';
  stage4.appendChild(shield4);

  // Shield pulse rings
  for (let i = 0; i < 3; i++) {
    const ring = el('circle', { cx: 225, cy: 195, r: 40 + i * 25, fill: 'none', stroke: '#899e2e', 'stroke-width': 1.5, opacity: 0, class: 'shield-pulse-' + i });
    stage4.appendChild(ring);
  }

  // Protection dashed circle
  const protCircle = el('circle', { cx: 225, cy: 195, r: 130, fill: 'none', stroke: '#899e2e', 'stroke-width': 1.5, 'stroke-dasharray': '8,6', opacity: 0.4, class: 'rotate-slow' });
  stage4.appendChild(protCircle);

  // Lock icon (top-left of browser)
  const lock4 = el('text', { x: 48, y: 38, 'font-size': 16, opacity: 0.8 });
  lock4.textContent = '\uD83D\uDD12';
  stage4.appendChild(lock4);

  // Heartbeat / monitoring line
  const hbLine = el('polyline', {
    points: '60,385 90,385 105,375 115,395 130,370 140,385 160,385 190,385 205,375 215,395 230,370 240,385 260,385 290,385 305,375 315,395 330,370 340,385 390,385',
    fill: 'none', stroke: '#899e2e', 'stroke-width': 2, opacity: 0.6, class: 'heartbeat-draw'
  });
  stage4.appendChild(hbLine);

  // Label
  const label4 = el('text', { x: 225, y: 358, 'text-anchor': 'middle', fill: '#899e2e', 'font-size': 18, 'font-weight': 'bold', 'font-family': 'Noto Sans, sans-serif' });
  label4.textContent = 'SECURED';
  stage4.appendChild(label4);

  // Active monitoring text
  const monText = el('text', { x: 225, y: 412, 'text-anchor': 'middle', fill: '#616161', 'font-size': 11, 'font-family': 'Noto Sans, sans-serif' });
  monText.textContent = 'Active Monitoring';
  stage4.appendChild(monText);

  // =====================================================
  // Assemble SVG
  // =====================================================
  svg.appendChild(stage1);
  svg.appendChild(stage2);
  svg.appendChild(stage3);
  svg.appendChild(stage4);
  container.appendChild(svg);

  // =====================================================
  // Animation sequence (12 second loop)
  // =====================================================
  let animTimer = null;
  function animate() {
    const timers = [];
    timers.push(setTimeout(() => { stage1.setAttribute('opacity', '1'); }, 0));
    timers.push(setTimeout(() => { stage1.setAttribute('opacity', '0'); stage2.setAttribute('opacity', '1'); }, 2500));
    timers.push(setTimeout(() => { stage2.setAttribute('opacity', '0'); stage3.setAttribute('opacity', '1'); }, 5000));
    timers.push(setTimeout(() => { stage3.setAttribute('opacity', '0'); stage4.setAttribute('opacity', '1'); }, 7500));
    timers.push(setTimeout(() => { stage4.setAttribute('opacity', '0'); animate(); }, 12000));
  }
  animate();

  // =====================================================
  // Inject CSS keyframe animations
  // =====================================================
  const style = document.createElement('style');
  style.textContent = `
    #malware-animation g {
      transition: opacity 0.6s ease;
    }

    /* Stage 1: Red glow pulse */
    .glow-red {
      animation: pulse-glow-red 1s ease-in-out infinite alternate;
    }
    @keyframes pulse-glow-red {
      0% { filter: drop-shadow(0 0 4px rgba(255,68,68,0.3)); }
      100% { filter: drop-shadow(0 0 12px rgba(255,68,68,0.7)); }
    }

    /* Shake animation */
    .shake-anim {
      animation: shake 0.4s ease-in-out infinite;
      transform-origin: center;
    }
    @keyframes shake {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      25% { transform: translate(-3px, 0) rotate(-3deg); }
      75% { transform: translate(3px, 0) rotate(3deg); }
    }

    /* Blink label */
    .blink-anim {
      animation: blink-text 1.2s ease-in-out infinite;
    }
    @keyframes blink-text {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* Malware particles — 3 speed variants */
    .malware-particle-0 {
      animation: particle-orbit-0 2.5s ease-in-out infinite;
    }
    .malware-particle-1 {
      animation: particle-orbit-1 3s ease-in-out infinite;
    }
    .malware-particle-2 {
      animation: particle-orbit-2 2s ease-in-out infinite;
    }
    @keyframes particle-orbit-0 {
      0%, 100% { transform: translate(0, 0); opacity: 0.5; }
      50% { transform: translate(12px, -8px); opacity: 1; }
    }
    @keyframes particle-orbit-1 {
      0%, 100% { transform: translate(0, 0); opacity: 0.4; }
      50% { transform: translate(-10px, 12px); opacity: 0.9; }
    }
    @keyframes particle-orbit-2 {
      0%, 100% { transform: translate(0, 0); opacity: 0.6; }
      50% { transform: translate(8px, 10px); opacity: 1; }
    }

    /* Virus floating */
    .virus-float-0 {
      animation: virus-bob-0 2.2s ease-in-out infinite;
    }
    .virus-float-1 {
      animation: virus-bob-1 2.8s ease-in-out infinite;
    }
    @keyframes virus-bob-0 {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    @keyframes virus-bob-1 {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(6px); }
    }

    /* Stage 2: Scan line */
    .scan-line-anim {
      animation: scan-sweep 2.5s linear infinite;
    }
    @keyframes scan-sweep {
      0% { transform: translateY(0); opacity: 0.9; }
      90% { transform: translateY(220px); opacity: 0.9; }
      100% { transform: translateY(0); opacity: 0; }
    }

    /* Progress bar fill */
    .progress-fill-anim {
      animation: progress-grow 2.5s ease-in-out infinite;
    }
    @keyframes progress-grow {
      0% { width: 0; }
      80% { width: 200px; }
      100% { width: 200px; }
    }

    /* Particles fading out */
    .particle-fade-out {
      animation: fade-shrink 2.5s ease-out infinite;
    }
    @keyframes fade-shrink {
      0% { opacity: 0.4; r: 3; }
      50% { opacity: 0.2; r: 2; }
      100% { opacity: 0; r: 0; }
    }

    /* Stage 3: Check draw */
    .check-draw {
      stroke-dasharray: 50;
      stroke-dashoffset: 50;
      animation: draw-check 1s ease-out 0.3s forwards;
    }
    .check-circle-draw {
      stroke-dasharray: 180;
      stroke-dashoffset: 180;
      animation: draw-circle 0.8s ease-out forwards;
    }
    @keyframes draw-check {
      to { stroke-dashoffset: 0; }
    }
    @keyframes draw-circle {
      to { stroke-dashoffset: 0; }
    }

    /* Sparkle animations — 3 delay variants */
    .sparkle-anim-0 { animation: sparkle-pop 2s ease-in-out 0.2s infinite; }
    .sparkle-anim-1 { animation: sparkle-pop 2s ease-in-out 0.7s infinite; }
    .sparkle-anim-2 { animation: sparkle-pop 2s ease-in-out 1.2s infinite; }
    @keyframes sparkle-pop {
      0%, 100% { opacity: 0; transform: scale(0.5); }
      30% { opacity: 1; transform: scale(1.2); }
      60% { opacity: 0.8; transform: scale(1); }
    }

    /* Stage 4: Shield pulse rings */
    .shield-pulse-0 { animation: shield-ring 2.5s ease-out 0s infinite; }
    .shield-pulse-1 { animation: shield-ring 2.5s ease-out 0.8s infinite; }
    .shield-pulse-2 { animation: shield-ring 2.5s ease-out 1.6s infinite; }
    @keyframes shield-ring {
      0% { opacity: 0.6; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.8); }
    }

    /* Rotating dashed protection circle */
    .rotate-slow {
      animation: slow-rotate 20s linear infinite;
      transform-origin: 225px 195px;
    }
    @keyframes slow-rotate {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Heartbeat line draw */
    .heartbeat-draw {
      stroke-dasharray: 600;
      stroke-dashoffset: 600;
      animation: draw-heartbeat 3s linear infinite;
    }
    @keyframes draw-heartbeat {
      0% { stroke-dashoffset: 600; }
      80% { stroke-dashoffset: 0; }
      100% { stroke-dashoffset: 0; }
    }
  `;
  document.head.appendChild(style);
}

// External redirect with transition overlay
function externalRedirect(url, siteName) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(28,34,40,0.92);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.25s ease';
  overlay.innerHTML = '<div style="text-align:center;color:#fff;font-family:Noto Sans,sans-serif"><div style="font-size:14px;color:#C2CBD7;margin-bottom:8px">' + siteName + '</div><div style="font-size:18px;font-weight:600">Redirecting...</div></div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });
  setTimeout(() => { window.open(url, '_blank'); overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 300); }, 1000);
}
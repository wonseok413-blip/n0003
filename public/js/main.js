// Noteracker Ltd. - Main JavaScript

// Initialize everything after DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
  await loadComponents();
  initFadeInAnimations();
  initSmoothScrolling();
  initLottieWidgets();
  initCounterAnimation();
  initFAQAccordion();
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
        if (entry.target.classList.contains('slide-left-init') || entry.target.classList.contains('slide-right-init')) {
          entry.target.classList.add('slide-visible');
        }
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  // Enhanced selectors for all new design elements
  document.querySelectorAll('.card, .stat-card, .section-header, .abt-timeline-item, .abt-why-card, .prod-card, .prod-faq, .svc-process-card, .warning-card, .faq-item').forEach(el => {
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

// Lottie-style Widget Auto-Rotation
function initLottieWidgets() {
  document.querySelectorAll('.lottie-wrap').forEach(function(wrap) {
    var steps = wrap.querySelectorAll('.lstep');
    var navBtns = wrap.querySelectorAll('.lnav-btn');
    if (steps.length === 0) return;

    var current = 0;
    var timer = null;
    var INTERVAL = 4000;

    function showStep(idx) {
      steps.forEach(function(s, i) {
        s.classList.toggle('lstep-active', i === idx);
      });
      navBtns.forEach(function(b, i) {
        b.classList.toggle('active', i === idx);
      });
      current = idx;
    }

    function next() {
      showStep((current + 1) % steps.length);
    }

    function startAuto() {
      clearInterval(timer);
      timer = setInterval(next, INTERVAL);
    }

    navBtns.forEach(function(btn, i) {
      btn.addEventListener('click', function() {
        showStep(i);
        startAuto();
      });
    });

    startAuto();
  });
}

// FAQ Accordion
function initFAQAccordion() {
  document.querySelectorAll('.faq-question').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var item = btn.closest('.faq-item');
      var isActive = item.classList.contains('active');

      // Close all other items in the same list
      var list = item.closest('.faq-list');
      if (list) {
        list.querySelectorAll('.faq-item.active').forEach(function(other) {
          if (other !== item) {
            other.classList.remove('active');
            other.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
          }
        });
      }

      // Toggle current item
      item.classList.toggle('active', !isActive);
      btn.setAttribute('aria-expanded', String(!isActive));
    });
  });
}

// External redirect with transition overlay
function externalRedirect(url, siteName) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(28,34,40,0.92);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.25s ease';
  overlay.innerHTML = '<div style="text-align:center;color:#fff;font-family:Noto Sans,sans-serif"><div style="font-size:14px;color:#a0aec0;margin-bottom:8px">' + siteName + '</div><div style="font-size:18px;font-weight:600">Redirecting...</div></div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });
  setTimeout(() => { window.open(url, '_blank'); overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 300); }, 1000);
}

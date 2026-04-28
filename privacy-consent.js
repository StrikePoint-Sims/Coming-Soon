// ─────────────────────────────────────────────────────────────────
//  StrikePoint Sims — Privacy & Cookie Consent
//
//  ▶ REPLACE THESE TWO IDs BEFORE GOING LIVE:
// ─────────────────────────────────────────────────────────────────
var SP_GA_ID   = 'G-5W403ZJ1GL';
var SP_META_ID = '1890255115025836';
// ─────────────────────────────────────────────────────────────────

(function () {
  var KEY = 'sp_consent';

  // ── Load GA4 (only after consent) ──
  function loadGA4() {
    if (!SP_GA_ID || SP_GA_ID.indexOf('REPLACE') === 0) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + SP_GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', SP_GA_ID);
  }

  // ── Load Meta Pixel (only after consent) ──
  function loadMetaPixel() {
    if (!SP_META_ID || SP_META_ID.indexOf('REPLACE') === 0) return;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', SP_META_ID);
    window.fbq('track', 'PageView');
  }

  function applyConsent(c) {
    if (c.analytics) loadGA4();
    if (c.ads) loadMetaPixel();
  }

  function saveConsent(analytics, ads) {
    var c = { analytics: analytics, ads: ads, timestamp: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(c));
    return c;
  }

  function getConsent() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }

  // ── Banner ──
  function hideBanner() {
    var b = document.getElementById('sp-banner');
    if (!b) return;
    b.classList.remove('sp-banner--in');
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 420);
  }

  function showBanner() {
    if (document.getElementById('sp-banner')) return;
    var b = document.createElement('div');
    b.id = 'sp-banner';
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', 'Cookie consent');
    b.innerHTML =
      '<div class="sp-banner-inner">' +
        '<p class="sp-banner-copy">We use cookies to improve the site and measure ads. This helps us understand what\'s working as we build StrikePoint. ' +
        '<a href="/privacy-policy.html" class="sp-banner-policy">Privacy Policy</a></p>' +
        '<div class="sp-banner-actions">' +
          '<button class="sp-btn sp-btn--accept" id="sp-accept">Accept</button>' +
          '<button class="sp-btn sp-btn--decline" id="sp-decline">Decline tracking</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(b);
    setTimeout(function () { b.classList.add('sp-banner--in'); }, 30);

    document.getElementById('sp-accept').addEventListener('click', function () {
      applyConsent(saveConsent(true, true));
      hideBanner();
    });
    document.getElementById('sp-decline').addEventListener('click', function () {
      saveConsent(false, false);
      hideBanner();
    });
  }

  // ── Public: "Privacy Settings" footer button calls this ──
  window.updatePrivacyPreferences = function () {
    localStorage.removeItem(KEY);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  };

  // ── Email reveal (replaces .sp-obf placeholders; defeats address harvesters) ──
  function revealEmails() {
    var els = document.querySelectorAll('.sp-obf');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var addr = el.getAttribute('data-p1') + '@' + el.getAttribute('data-p2') + '.' + el.getAttribute('data-p3');
      var a = document.createElement('a');
      a.href = 'mai' + 'lto:' + addr;
      a.textContent = addr;
      el.parentNode.replaceChild(a, el);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', revealEmails);
  } else {
    revealEmails();
  }

  // ── Init ──
  var stored = getConsent();
  if (stored) {
    applyConsent(stored);
  } else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }
})();

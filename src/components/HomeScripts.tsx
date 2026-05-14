'use client';

import { useEffect } from 'react';

export default function HomeScripts() {
  useEffect((): (() => void) => {
    // Footer email obfuscation
    const a = document.getElementById('footer-email') as HTMLAnchorElement | null;
    if (a) {
      const u = 'info';
      const d = 'strikepointsims.com';
      a.href = 'mai' + 'lto:' + u + '@' + d;
    }

    // Scroll animations
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) e.target.classList.add('in-view');
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
      );
      document.querySelectorAll('[data-anim]').forEach((el) => io.observe(el));
    } else {
      document.querySelectorAll('[data-anim]').forEach((el) => el.classList.add('in-view'));
    }

    // Mobile side tab CTA: hide while scrolling, then reappear after 3 seconds.
    const mobileSideUpdates = document.getElementById('mobileSideUpdates') as HTMLElement | null;
    let mobileSideTimer: number | null = null;

    function shouldShowMobileSideCta() {
      return (
        mobileSideUpdates !== null &&
        window.matchMedia('(max-width: 639px)').matches &&
        window.scrollY > 220
      );
    }

    function hideMobileSideCta() {
      if (!mobileSideUpdates) return;
      mobileSideUpdates.classList.remove('is-visible');
    }

    function showMobileSideCta() {
      if (!mobileSideUpdates) return;
      mobileSideUpdates.classList.toggle('is-visible', shouldShowMobileSideCta());
    }

    function scheduleMobileSideCta() {
      if (!mobileSideUpdates) return;
      if (mobileSideTimer !== null) window.clearTimeout(mobileSideTimer);
      hideMobileSideCta();
      if (shouldShowMobileSideCta()) {
        mobileSideTimer = window.setTimeout(showMobileSideCta, 3000);
      }
    }

    showMobileSideCta();
    window.addEventListener('scroll', scheduleMobileSideCta, { passive: true });
    window.addEventListener('resize', scheduleMobileSideCta);

    // Nav active link on scroll
    const sections = ['home', 'experience', 'founder-20', 'faq'];
    const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-links a');
    const sectionEls = sections.map((id) => document.getElementById(id));

    if ('IntersectionObserver' in window) {
      const navObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              const id = (e.target as HTMLElement).id;
              navLinks.forEach((link) => {
                link.classList.toggle('active', link.getAttribute('href') === '#' + id);
              });
            }
          });
        },
        { threshold: 0.4 }
      );
      sectionEls.forEach((el) => {
        if (el) navObs.observe(el);
      });
    }

    // GA4 events (no-ops until ID is set)
    const heroCta = document.getElementById('hero-cta');
    const founderCta = document.getElementById('founder-cta');
    if (heroCta) {
      heroCta.addEventListener('click', () => {
        if (typeof (window as Window & { gtag?: Function }).gtag === 'function') {
          (window as Window & { gtag?: Function }).gtag!('event', 'cta_click_hero');
        }
      });
    }
    if (founderCta) {
      founderCta.addEventListener('click', () => {
        if (typeof (window as Window & { gtag?: Function }).gtag === 'function') {
          (window as Window & { gtag?: Function }).gtag!('event', 'cta_click_founder_section');
        }
      });
    }

    // FAQ expand tracking
    document.querySelectorAll<HTMLDetailsElement>('.faq-item').forEach((el) => {
      el.addEventListener('toggle', () => {
        if (el.open && typeof (window as Window & { gtag?: Function }).gtag === 'function') {
          const q = el.querySelector('.faq-q');
          (window as Window & { gtag?: Function }).gtag!('event', 'faq_expand', {
            faq_question: q ? q.textContent?.trim() ?? '' : '',
          });
        }
      });
    });

    // Cleanup
    return () => {
      window.removeEventListener('scroll', scheduleMobileSideCta);
      window.removeEventListener('resize', scheduleMobileSideCta);
      if (mobileSideTimer !== null) window.clearTimeout(mobileSideTimer);
    };
  }, []);

  return null;
}

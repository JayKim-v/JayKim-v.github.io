/* =============================================================
   김재희 — interactive portfolio
   Lenis smooth scroll + GSAP/ScrollTrigger reveal & pinning
   ============================================================= */

(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;

  // --------- Word splitting helpers (avoids dep on SplitText) ---------
  function splitWords(el) {
    if (!el || el.dataset.split === '1') return;
    const text = el.textContent;
    el.textContent = '';

    // Split keeping inline tags intact would need a real parser; here the source
    // uses simple text + <br> + <strong>/<em>/<span>. We re-use innerHTML and
    // wrap each text-node word with the .word/.word-inner pair.
    const tmp = document.createElement('div');
    tmp.innerHTML = el.dataset.html || text;
    walk(tmp);
    el.appendChild(tmp);
    while (tmp.firstChild) el.appendChild(tmp.firstChild);
    tmp.remove();
    el.dataset.split = '1';

    function walk(node) {
      const children = Array.from(node.childNodes);
      for (const c of children) {
        if (c.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          const parts = c.nodeValue.split(/(\s+)/);
          for (const p of parts) {
            if (p.match(/^\s+$/)) {
              frag.appendChild(document.createTextNode(p));
            } else if (p.length) {
              const w = document.createElement('span');
              w.className = 'word';
              const inner = document.createElement('span');
              inner.className = 'word-inner';
              inner.textContent = p;
              w.appendChild(inner);
              frag.appendChild(w);
            }
          }
          node.replaceChild(frag, c);
        } else if (c.nodeType === Node.ELEMENT_NODE) {
          walk(c);
        }
      }
    }
  }

  // --------- Lenis smooth scroll ---------
  let lenis;
  if (window.Lenis && !prefersReduced) {
    lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false,
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  // --------- GSAP ---------
  if (!window.gsap) return;
  const { gsap } = window;

  if (window.ScrollTrigger) {
    gsap.registerPlugin(window.ScrollTrigger);
    if (lenis) {
      lenis.on('scroll', window.ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }

  // Hero scroll indicator hide — fires from ScrollTrigger which is synced
  // with Lenis (above), and falls back to native scroll otherwise.
  const heroIndicator = document.querySelector('.hero__scroll');
  function updateIndicator() {
    if (!heroIndicator) return;
    if (window.scrollY > 80) heroIndicator.classList.add('is-hidden');
    else heroIndicator.classList.remove('is-hidden');
  }
  window.addEventListener('scroll', updateIndicator, { passive: true });
  if (window.ScrollTrigger) {
    window.ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: updateIndicator,
    });
  }
  updateIndicator();

  // --------- Cursor follower ---------
  if (!isTouch && !prefersReduced) {
    const cursor = document.querySelector('.cursor');
    const dot = cursor.querySelector('.cursor__dot');
    const ring = cursor.querySelector('.cursor__ring');

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let dx = mx, dy = my, rx = mx, ry = my;

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
    }, { passive: true });

    function tick() {
      dx += (mx - dx) * 0.65;
      dy += (my - dy) * 0.65;
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      dot.style.transform = `translate(${dx}px, ${dy}px) translate(-50%,-50%)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(tick);
    }
    tick();

    document.querySelectorAll('a, button, [data-magnetic]').forEach((el) => {
      el.addEventListener('mouseenter', () => cursor.classList.add('is-hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('is-hover'));
    });
  }

  // --------- Magnetic hover ---------
  if (!isTouch && !prefersReduced) {
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const strength = 18;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const x = ((e.clientX - cx) / r.width) * strength;
        const y = ((e.clientY - cy) / r.height) * strength;
        gsap.to(el, { x, y, duration: 0.35, ease: 'power3.out' });
      });
      el.addEventListener('mouseleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }

  // --------- Scroll progress bar ---------
  const progress = document.querySelector('.scroll-progress');
  if (progress && window.ScrollTrigger) {
    window.ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        progress.style.width = (self.progress * 100).toFixed(2) + '%';
      },
    });
  }

  // --------- Sticky nav state ---------
  const nav = document.querySelector('.nav');
  if (nav && window.ScrollTrigger) {
    window.ScrollTrigger.create({
      start: 80,
      end: 'max',
      onUpdate: (self) => {
        if (self.progress > 0.0001) nav.classList.add('is-scrolled');
        else nav.classList.remove('is-scrolled');
      },
      onEnter: () => nav.classList.add('is-scrolled'),
      onLeaveBack: () => nav.classList.remove('is-scrolled'),
    });
  }

  // --------- Hero — letter-by-letter rise ---------
  if (!prefersReduced) {
    const heroChars = document.querySelectorAll('.hero__title .char');
    gsap.to(heroChars, {
      y: 0,
      stagger: 0.018,
      duration: 1.0,
      ease: 'expo.out',
      delay: 0.15,
    });

    gsap.to('.hero__sub > p', {
      y: 0,
      opacity: 1,
      stagger: 0.12,
      duration: 1.1,
      ease: 'expo.out',
      delay: 0.6,
    });
  } else {
    document.querySelectorAll('.hero__title .char').forEach((c) => (c.style.transform = 'none'));
    document.querySelectorAll('.hero__sub > p').forEach((c) => (c.style.opacity = 1));
  }

  // --------- Word reveal (data-reveal-words) ---------
  document.querySelectorAll('[data-reveal-words]').forEach((el) => {
    splitWords(el);
  });

  if (window.ScrollTrigger && !prefersReduced) {
    document.querySelectorAll('[data-reveal-words]').forEach((el) => {
      const inners = el.querySelectorAll('.word-inner');
      gsap.set(inners, { y: '110%' });
      gsap.to(inners, {
        y: '0%',
        stagger: 0.022,
        duration: 0.9,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 82%',
          once: true,
        },
      });
    });
  } else {
    document.querySelectorAll('[data-reveal-words] .word-inner').forEach((el) => (el.style.transform = 'none'));
  }

  // --------- Generic reveal (data-reveal) ---------
  if (window.ScrollTrigger && !prefersReduced) {
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      window.ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () => el.classList.add('is-revealed'),
      });
    });
  } else {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-revealed'));
  }

  // --------- Project min-height: fit to copy column ---------
  // Each project section uses position: sticky for the visual + copy. The
  // copy column on Claude Widget became long enough to overlap with the next
  // pinned section. Compute min-height per project so the sticky stays alive
  // until the user has scrolled past the entire copy column.
  function fitProjectHeights() {
    const isMobile = window.matchMedia('(max-width: 1000px)').matches;
    const vh = window.innerHeight;
    document.querySelectorAll('.project').forEach((proj) => {
      // Mobile: no sticky pin, let content drive height naturally
      if (isMobile) {
        proj.style.minHeight = '';
        return;
      }
      const copy = proj.querySelector('.project__copy');
      const visual = proj.querySelector('.project__visual');
      if (!copy) return;
      proj.style.minHeight = '';
      const copyH = copy.getBoundingClientRect().height;
      const visualH = visual ? visual.getBoundingClientRect().height : 0;
      const tallest = Math.max(copyH, visualH);
      const baseline = vh * 2.2;
      const needed = tallest + vh * 1.0;
      proj.style.minHeight = Math.max(baseline, needed) + 'px';
    });
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }
  // Wait for layout, fonts, images
  window.addEventListener('load', fitProjectHeights);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitProjectHeights);
  // Also after images load (project visuals)
  document.querySelectorAll('.project img').forEach((img) => {
    if (img.complete) return;
    img.addEventListener('load', fitProjectHeights, { once: true });
  });
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitProjectHeights, 150);
  });

  // --------- Project visuals — scrub-driven motion inside the pin ---------
  // Only runs on desktop where the sticky pin is alive. On mobile the layout
  // collapses to a normal stack and scrub-driven displacement just pushes
  // mockups out of the column (overflow → cut-off).
  const isMobileLayout = window.matchMedia('(max-width: 1000px)').matches;
  if (window.ScrollTrigger && !prefersReduced && !isMobileLayout) {
    document.querySelectorAll('.project').forEach((proj) => {
      const which = proj.dataset.project;
      const sticky = proj.querySelector('.project__sticky');
      if (!sticky) return;

      // Per-project scroll-scrubbed mini-timeline
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: proj,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6,
        },
      });

      // VISUAL TIMELINE — scrub-driven
      // Important: keep opacity = 1 throughout so the visual stays visible at all
      // scroll positions (scrub progress 0 = "from" state). Only animate transforms.
      if (which === 'apple') {
        tl.fromTo(
          proj.querySelector('.phone--a'),
          { x: 30, y: 16, rotate: -4, scale: 0.92 },
          { x: -10, y: 8, rotate: -10, scale: 1 },
          0
        )
          .fromTo(
            proj.querySelector('.phone--b'),
            { y: 6, rotate: 2, scale: 0.96 },
            { y: -10, rotate: 0, scale: 1.04 },
            0
          )
          .fromTo(
            proj.querySelector('.phone--c'),
            { x: -30, y: 16, rotate: 4, scale: 0.92 },
            { x: 10, y: 8, rotate: 10, scale: 1 },
            0
          );
      } else if (which === 'precision') {
        // ──────────────────────────────────────────────────────────────
        // Precision fan + 3D tilt parallax
        //   start: 3 cards tightly stacked, mostly hidden behind front
        //   mid:   back/mid begin to fan out with subtle 3D tilt
        //   end:   cards fully fanned, layered depth visible
        // 3D angles intentionally small (≤8°) so cards never clip each
        // other or the visual column. Mobile reduces angles further.
        // ──────────────────────────────────────────────────────────────
        const back = proj.querySelector('.precision-stack__back');
        const mid = proj.querySelector('.precision-stack__mid');
        const front = proj.querySelector('.precision-stack__front');
        const isMobile = window.matchMedia('(max-width: 1000px)').matches;
        const k = isMobile ? 0.5 : 1; // tone down on mobile

        // Back card — fans up + RIGHT (gently into copy column on desktop)
        if (back) {
          tl.fromTo(back,
            { xPercent: 0,  y: 0,    rotate: 0,        rotationX: 0,         rotationY: 0,         scale: 0.94, opacity: 0.85, filter: 'blur(1px)' },
            { xPercent: 28 * k, y: -34 * k, rotate: 6 * k, rotationX: 6 * k, rotationY: -8 * k, scale: 1.0, opacity: 1, filter: 'blur(0px)' },
            0);
        }

        // Middle card — fans up + LEFT (stays inside the visual column)
        if (mid) {
          tl.fromTo(mid,
            { xPercent: 0,    y: 0,    rotate: 0,         rotationX: 0,        rotationY: 0,        scale: 0.96, opacity: 0.92, filter: 'blur(0.6px)' },
            { xPercent: -14 * k, y: -16 * k, rotate: -4 * k, rotationX: 3 * k, rotationY: 6 * k, scale: 1.0, opacity: 1, filter: 'blur(0px)' },
            0);
        }

        // Front card — anchor, subtle drop + scale (no horizontal drift)
        if (front) {
          tl.fromTo(front,
            { y: 6,  rotationX: 0,         rotationY: 0,        scale: 0.99 },
            { y: 18, rotationX: -2 * k, rotationY: -1 * k, scale: 1.03 },
            0);
        }
      } else if (which === 'claude') {
        tl.fromTo(
          proj.querySelector('.cw-stage'),
          { y: 30, scale: 0.95 },
          { y: -20, scale: 1.02 },
          0
        );
        tl.fromTo(
          proj.querySelector('.cw-pop'),
          { y: 8 },
          { y: -2 },
          0
        );
      } else if (which === 'dsat') {
        // Figma cards fan out as the user scrolls — back tilts up-left,
        // mid tilts up-right, front anchors down-center. CSS no longer
        // pre-applies a rotate, so GSAP scrub controls everything cleanly.
        const figs = proj.querySelectorAll('.dsat-fig');
        if (figs[0]) {
          tl.fromTo(figs[0],
            { xPercent: 0,   y: 0,   rotate: -2, scale: 0.96, opacity: 0.92 },
            { xPercent: -14, y: -28, rotate: -8, scale: 1.0,  opacity: 1 },
            0);
        }
        if (figs[1]) {
          tl.fromTo(figs[1],
            { xPercent: 0,  y: 0,   rotate: 1, scale: 0.96, opacity: 0.94 },
            { xPercent: 14, y: -14, rotate: 6, scale: 1.0,  opacity: 1 },
            0);
        }
        if (figs[2]) {
          tl.fromTo(figs[2],
            { xPercent: 0, y: 4,  rotate: -1, scale: 0.99 },
            { xPercent: 0, y: 22, rotate: -3, scale: 1.03 },
            0);
        }
      } else if (which === 'mentoring') {
        const a = proj.querySelector('.ment-stack__a');
        const b = proj.querySelector('.ment-stack__b');
        if (a) tl.fromTo(a, { y: 12, x: 0, rotate: -1 }, { y: -8, x: -10, rotate: -5 }, 0);
        if (b) tl.fromTo(b, { y: -8, x: 0, rotate: 1 }, { y: 8,  x: 10, rotate: 4 }, 0);
      }

      // COPY COLUMN — discrete reveals (NOT scrub).
      // Use fromTo + immediateRender:false to avoid the from-state being
      // applied before the trigger fires (which can leave items invisible if
      // the trigger never re-evaluates inside the sticky section).
      const copy = proj.querySelector('.project__copy');
      if (copy) {
        const reveal = (sel, opts = {}) => {
          const el = typeof sel === 'string' ? copy.querySelector(sel) : sel;
          if (!el) return;
          gsap.fromTo(
            el,
            { y: opts.y ?? 22, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: opts.duration ?? 0.85,
              ease: 'expo.out',
              delay: opts.delay ?? 0,
              immediateRender: false,
              scrollTrigger: {
                trigger: proj,
                start: 'top 60%',
                once: true,
              },
            }
          );
        };

        reveal('.project__index', { y: 14, delay: 0 });
        reveal('.project__role', { y: 14, delay: 0.06 });
        reveal('.project__name', { y: 28, delay: 0.12 });
        reveal('.project__tag', { y: 18, delay: 0.2 });

        const pts = copy.querySelectorAll('.project__points li');
        pts.forEach((li, i) => reveal(li, { y: 20, delay: 0.28 + i * 0.07 }));

        const why = copy.querySelector('.project__why');
        if (why) reveal(why, { y: 18, delay: 0.32 });

        const tags = copy.querySelectorAll('.project__stack span');
        tags.forEach((s, i) => reveal(s, { y: 10, duration: 0.5, delay: 0.4 + i * 0.04 }));

        const link = copy.querySelector('.project__link');
        if (link) reveal(link, { y: 12, delay: 0.5 });
      }
    });
  }

  // --------- Anchor smooth jump (Lenis-aware) ---------
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) {
        lenis.scrollTo(target, { offset: -20, duration: 1.2 });
      } else {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Ensure ScrollTrigger recalculates after fonts load
  document.fonts && document.fonts.ready && document.fonts.ready.then(() => {
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  });
  window.addEventListener('load', () => {
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  });
})();

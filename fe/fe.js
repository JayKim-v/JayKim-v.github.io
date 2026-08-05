/**
 * /fe 의 인터랙션 레이어.
 *
 * 원칙 세 가지로 짰습니다.
 *
 *  1. 없어도 읽힌다.  초기 숨김 상태는 CSS 의 `.js` 아래에만 있습니다. 이 파일이
 *     로드되지 않으면 `.js` 가 붙지 않고, 모든 내용이 처음부터 보입니다.
 *  2. 레이아웃을 건드리지 않는다.  transform · opacity 만 씁니다. CLS 0 을
 *     문서에서 근거로 내세우고 있으므로 애니메이션이 그걸 깨면 안 됩니다.
 *  3. 인쇄와 무관하다.  화면 전용 규칙이라 PDF 조판에는 아무 영향이 없습니다.
 *
 * 외부 라이브러리를 쓰지 않은 이유: 이 문서가 "스크립트 무게를 재고 정했다"를
 * 근거로 쓰고 있어서, 스크롤 하나에 CDN 90KB 를 얹으면 그 근거가 무너집니다.
 */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // 초기 숨김 규칙은 `.js` 아래에만 있습니다. 이 줄에 도달하지 못하면
  // (파일 미로드 · 문법 오류 · 구형 브라우저) 아무것도 숨겨지지 않습니다.
  root.classList.add('js');

  /* ── 1. 스크롤 진행 막대 ──────────────────────────────────────────
     scaleX 만 바꿉니다. width 를 바꾸면 매 프레임 레이아웃이 다시 계산됩니다. */
  const bar = document.createElement('div');
  bar.className = 'progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(scrollY / max, 1) : 0})`;
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ── 2. 스크롤 진입 시 나타내기 ───────────────────────────────────
     대상 선택을 JS 가 합니다. HTML 에 클래스를 박아두면 JS 가 죽었을 때
     숨김 상태가 남을 위험이 있는데, 이렇게 하면 그 경로 자체가 없습니다. */
  const TARGETS = [
    '.sec > .wrap > h2',
    '.sec__lead',
    '.entry',
    '.stack-sum > div',
    '.band .item',
    '.tbl-wrap, table',
    '.diagram',
    '.shot',
    '.subhead',
    '.t-after',
    '.closing blockquote',
    '.closing__end',
  ].join(',');

  const items = [...document.querySelectorAll(TARGETS)]
    // 히어로는 첫 화면이라 관찰 대상에서 뺍니다 — 로드 직후 바로 올립니다.
    .filter((el) => !el.closest('.hero'));

  if (!reduced.matches && 'IntersectionObserver' in window) {
    items.forEach((el) => el.classList.add('reveal'));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          // 같은 부모 안에서 순차로 뜨게 살짝 시차를 줍니다.
          const sibs = [...(e.target.parentElement?.children ?? [])].filter((n) =>
            n.classList.contains('reveal'),
          );
          const i = Math.min(sibs.indexOf(e.target), 5);
          e.target.style.transitionDelay = `${i > 0 ? i * 70 : 0}ms`;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.06 },
    );
    items.forEach((el) => io.observe(el));

    /* 표식으로 건너뛰거나 빠르게 스크롤하면 화면에 한 번도 걸리지 않고
       지나가는 요소가 생긴다. 그대로 두면 되돌아오기 전까지 안 보인다.
       이미 위로 지나간 것은 애니메이션 없이 즉시 켠다. */
    addEventListener('scroll', () => {
      items.forEach((el) => {
        if (el.classList.contains('is-in')) return;
        if (el.getBoundingClientRect().bottom < 0) {
          el.style.transitionDelay = '0ms';
          el.classList.add('is-in');
          io.unobserve(el);
        }
      });
    }, { passive: true });
  }

  /* ── 3. 히어로 ────────────────────────────────────────────────── */
  if (!reduced.matches) {
    const hero = [...document.querySelectorAll(
      '.for-application, .hero h1, .hero__lead, .hero__links, .badges > span, .stack-sum',
    )];
    hero.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${60 + i * 55}ms`;
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      hero.forEach((el) => el.classList.add('is-in'));
    }));
  }

  /* ── 4. 섹션 표식 ─────────────────────────────────────────────────
     8 개 섹션짜리 문서라 지금 어디를 보고 있는지 알 수 있어야 합니다. */
  const secs = [...document.querySelectorAll('.sec[id]')].filter(
    (s) => !s.classList.contains('web-only') || getComputedStyle(s).display !== 'none',
  );

  if (secs.length > 2) {
    const nav = document.createElement('nav');
    nav.className = 'dots';
    nav.setAttribute('aria-label', '섹션 바로가기');

    const links = secs.map((s) => {
      // h2 안에는 "01 / 주요 프로젝트" 라벨 span 과 제목이 같이 들어있다.
      // textContent 를 그대로 쓰면 "주요 프로젝트주요 프로젝트" 가 된다.
      const h2 = s.querySelector('h2');
      let label = s.id;
      if (h2) {
        const clone = h2.cloneNode(true);
        clone.querySelector('.sec__label')?.remove();
        label = clone.textContent.trim() || label;
      }
      const a = document.createElement('a');
      a.href = `#${s.id}`;
      // 보이는 이름과 접근 이름이 같아야 하므로 aria-label 을 따로 주지 않는다.
      a.append(Object.assign(document.createElement('i'), { ariaHidden: 'true' }));
      a.append(Object.assign(document.createElement('span'), { textContent: label }));
      nav.appendChild(a);
      return a;
    });
    document.body.appendChild(nav);

    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const i = secs.indexOf(e.target);
          if (i < 0) return;
          links[i].classList.toggle('is-on', e.isIntersecting);
        });
        // 여러 섹션이 동시에 걸릴 때는 맨 위 하나만 켭니다.
        const on = links.filter((a) => a.classList.contains('is-on'));
        on.slice(1).forEach((a) => a.classList.remove('is-on'));
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    secs.forEach((s) => spy.observe(s));
  }

  root.classList.add('js-ready');
})();

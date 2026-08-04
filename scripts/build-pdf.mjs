/**
 * /fe 페이지를 A4 PDF로 뽑는다.
 *
 *   node scripts/build-pdf.mjs [출력경로]
 *
 * Chrome CLI의 --print-to-pdf 로는 페이지 번호를 넣을 수 없어 CDP 를 쓴다.
 * 정적 서버는 이 스크립트가 직접 띄웠다 내린다 — 서버를 따로 켜둘 필요가 없다.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] ?? join(ROOT, 'assets/cv/jay-portfolio-fe.pdf');

/** 설치 위치가 OS마다 달라 실제로 존재하는 경로를 고른다. */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

async function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try { await stat(p); return p; } catch { /* 다음 후보 */ }
  }
  throw new Error(
    'Chrome 실행 파일을 찾지 못했습니다. CHROME_PATH 환경변수로 지정하세요.',
  );
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
};

/** 임의 포트로 띄운다. 고정 포트를 쓰면 다른 프로세스와 부딪힌다. */
function serve() {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = join(ROOT, p);
      // 루트 밖으로 나가는 경로는 거부한다.
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

const FOOTER = `
<div style="width:100%;font-family:-apple-system,'Helvetica Neue',sans-serif;
            font-size:7.5pt;color:#7A7263;padding:0 15mm;
            display:flex;justify-content:space-between;align-items:center;">
  <span>김재희 · 프론트엔드 포트폴리오</span>
  <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`;

const server = await serve();
const { port } = server.address();
const browser = await puppeteer.launch({
  executablePath: await findChrome(),
  headless: 'new',
  args: ['--no-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/fe/`, { waitUntil: 'networkidle0' });
  // loading="lazy" 는 화면 밖 이미지를 로드하지 않는다. 인쇄에서는 전 지면이
  // 한꺼번에 나가야 하므로 eager 로 바꾸고 디코딩까지 기다린다.
  await page.evaluate(async () => {
    const imgs = [...document.images];
    imgs.forEach((i) => { i.loading = 'eager'; });
    await Promise.all(imgs.map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((ok) => {
      i.addEventListener('load', ok, { once: true });
      i.addEventListener('error', ok, { once: true });
    }))));
  });
  // 웹폰트가 올라오기 전에 찍으면 폴백 서체로 조판돼 줄 수가 달라진다.
  await page.evaluateHandle('document.fonts.ready');

  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: FOOTER,
    margin: { top: '15mm', bottom: '16mm', left: '20mm', right: '20mm' },
  });
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
  server.close();
}

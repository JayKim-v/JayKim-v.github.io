/**
 * /fe 가 실제로 쓰는 글자만 남긴 웹폰트를 만든다.
 *
 *   node scripts/build-fonts.mjs
 *
 * 문서를 고치면 반드시 다시 돌려야 한다. 안 돌리면 새로 쓴 글자가 서브셋에
 * 없어서 폴백 서체로 떨어지고, 한 단어 안에서 서체가 갈린다. 실제로
 * "완주" · "총 4년" · "핵심" 같은 말이 그렇게 섞여 나간 적이 있다.
 *
 * 원본은 pretendard 패키지에 있다. 이 저장소에 원본을 두지 않는 이유는
 * 2MB 짜리 두 벌을 커밋할 이유가 없어서다.
 */
import { readFile, writeFile, stat, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = new URL('..', import.meta.url).pathname;
const SRC_DIR = process.env.PRETENDARD_DIR
  ?? '/Users/jay/Projects/gvStone/node_modules/pretendard/dist/web/static/woff2';

const HTML = ['fe/index.html', 'fe/jyp.html', 'fe/bg.html'];
const FACES = [
  { src: 'Pretendard-Regular.woff2', out: 'fe/fonts/Pretendard-Regular.subset.woff2' },
  { src: 'Pretendard-Bold.woff2',    out: 'fe/fonts/Pretendard-Bold.subset.woff2' },
];

/** 태그·주석·스크립트를 걷어내고 눈에 보이는 글자만 남긴다. */
function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    // alt · title · aria-label 은 화면에 안 보여도 보조기술이 읽는다. 남긴다.
    .replace(/<[^>]+?(alt|title|aria-label)="([^"]*)"[^>]*>/g, ' $2 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

const chars = new Set();
for (const f of HTML) {
  // 지원처별 변형본은 저장소에 올리지 않으므로 없을 수 있다. 있으면 넣는다.
  let html;
  try { html = await readFile(ROOT + f, 'utf8'); } catch { continue; }
  for (const c of visibleText(html)) chars.add(c);
}
// 라틴 · 숫자 · 기본 문장부호는 통째로. 비용이 작고 빠지면 바로 티가 난다.
for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
for (const c of '　·—–…“”‘’※→←↑↓✓×÷°′″₩$€£¥©®™±≤≥≠∙') chars.add(c);

const text = [...chars].filter((c) => c === ' ' || c.trim()).sort().join('');
const listFile = ROOT + '.font-chars.txt';
await writeFile(listFile, text, 'utf8');

for (const { src, out } of FACES) {
  const origin = `${SRC_DIR}/${src}`;
  try { await access(origin); } catch {
    console.error(`원본을 찾지 못했습니다: ${origin}\nPRETENDARD_DIR 로 지정하세요.`);
    process.exit(1);
  }
  await run('python3', [
    '-m', 'fontTools.subset', origin,
    `--text-file=${listFile}`,
    '--flavor=woff2', '--layout-features=*', '--no-hinting', '--desubroutinize',
    `--output-file=${ROOT + out}`,
  ]);
  const b = (await stat(origin)).size, a = (await stat(ROOT + out)).size;
  console.log(`  ${src.padEnd(24)} ${(b / 1024).toFixed(0)}KB → ${(a / 1024).toFixed(0)}KB`);
}
console.log(`  글자 ${text.length}자`);

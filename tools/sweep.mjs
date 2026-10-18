#!/usr/bin/env node
/**
 * يفتح كل شاشة ويصوّرها، ويتحقق من كل أيقونة.
 *
 * يلتقط الحالات التي تمرّ صامتة: أيقونة لم تُحمَّل، صورة مكسورة، شاشة فارغة.
 * ويعمل على خادم التطوير مباشرة.
 *
 *   node tools/sweep.mjs [منفذ]
 */
import { chromium } from '/home/deploy/pro/e2e/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const PORT = process.argv[2] || '5180';
const BASE = `http://127.0.0.1:${PORT}/`;
const OUT = '/tmp/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1680, height: 1160 }, deviceScaleFactor: 1 });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

await page.click('button:has-text("Screens")');
await page.waitForTimeout(300);

const labels = await page.$$eval('button', (bs) =>
  bs.map((x) => x.textContent.trim()).filter((t) => /nodes$/.test(t)),
);
console.log('screens: ' + labels.length);

let bad = 0;
for (const label of labels) {
  const name = label.replace(/\d+ nodes$/, '').trim();
  await page.click(`button:has-text("${name}")`);
  await page.waitForTimeout(420);
  await page.evaluate(() => {
    const f = document.getElementById('screen-frame');
    f.style.transform = 'none';
    f.style.boxShadow = 'none';
    f.parentElement.style.cssText = 'position:absolute;left:0;top:0;transform:none';
  });
  await page.waitForTimeout(160);

  const stats = await page.evaluate(() => {
    const f = document.getElementById('screen-frame');
    const imgs = [...f.querySelectorAll('img')];
    const broken = imgs.filter((i) => !i.complete || i.naturalWidth === 0);
    /* نصوص بلا لون؟ تكرار؟ نتحقق من التغطية داخل الإطار */
    return {
      w: f.offsetWidth,
      h: f.offsetHeight,
      imgs: imgs.length,
      broken: broken.length,
      text: (f.innerText || '').length,
    };
  });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  await (await page.$('#screen-frame')).screenshot({ path: `${OUT}/${slug}.png` });

  const ok = stats.broken === 0 && (stats.imgs > 0 || stats.text > 0);
  if (!ok) bad++;
  console.log(
    '  ' + name.padEnd(32) +
    String(stats.w + 'x' + stats.h).padEnd(11) +
    'imgs=' + String(stats.imgs).padStart(3) +
    '  broken=' + stats.broken +
    '  ' + (ok ? '✓' : '✗'),
  );
}

if (errors.length) {
  console.log('\npage errors:');
  for (const e of errors.slice(0, 6)) console.log('  ' + e);
}

console.log(bad ? `\n${bad} screen(s) need attention` : '\nall screens render');
await browser.close();
process.exit(bad ? 1 : 0);

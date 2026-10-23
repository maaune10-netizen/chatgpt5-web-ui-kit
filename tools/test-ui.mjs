#!/usr/bin/env node
/**
 * test-ui.mjs — اختبار الواجهة بعد كل تعديل.
 *
 *   node tools/test-ui.mjs
 *
 * والمراد: لا تعديل بلا اختبار. الأنواع الثلاثة من الأعطال التي وقعت فعلًا:
 *   ١ تعليق CSS داخل JSX يُرسم نصًّا على الشاشة
 *   ٢ نصّ تلميح مأخوذ من سطح آخر
 *   ٣ موضع عنصر ينزاح بلا أن يلاحظه أحد
 */
import { chromium } from '/home/deploy/pro/e2e/node_modules/playwright/index.mjs';

let pass = 0, fail = 0;
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n} ${d}`); } };

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1912, height: 922 } })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });

await p.goto('https://bahr-vps.tail18374c.ts.net:8446/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);
await p.evaluate(() => { localStorage.setItem('gpt5.signedIn', '1'); localStorage.setItem('gpt5.theme', 'dark'); });
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(2600);

/* ١ · لا تسريب نصوص من تعليقات أو رموز */
const text = await p.evaluate(() => document.body.innerText);
ok('لا تعليق مسرَّب', !text.includes('مقيس:') && !text.includes('مقيس '), text.match(/.{0,30}مقيس.{0,30}/)?.[0] || '');
ok('لا شرطة تعليق ظاهرة', !/\/\*|\*\//.test(text), text.match(/.{0,20}\/\*.{0,20}/)?.[0] || '');

/* ٢ · التلميحات — النصّ والمقاس */
const tips = [
  ['Temporary chat', '[aria-label="Temporary chat"]'],
  ['Search', '[aria-label="Search chats"]'],
  ['Hide sidebar', '[aria-label="Hide sidebar"]'],
];
for (const [expected, sel] of tips) {
  await p.hover(sel).catch(() => {});
  await p.waitForTimeout(1000);
  const t = await p.evaluate(() => {
    const n = [...document.querySelectorAll('[role="tooltip"]')].find((e) => getComputedStyle(e).opacity === '1');
    if (!n) return null;
    const cs = getComputedStyle(n);
    return { text: n.textContent.trim(), fs: cs.fontSize, fw: cs.fontWeight, bg: cs.backgroundColor };
  });
  ok(`تلميح «${expected}»`, t?.text?.startsWith(expected), t ? `(${t.text})` : '(لا تلميح)');
  if (t) ok(`  مقاس «${expected}»`, t.fs === '14px' && t.fw === '600' && t.bg === 'rgb(48, 48, 48)', `${t.fs}/${t.fw}/${t.bg}`);
  await p.mouse.move(5, 400);
  await p.waitForTimeout(250);
}

/* ٣ · مواضع مثبّتة — مقيسة من الالتقاط */
const pos = await p.evaluate(() => {
  const g = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  return {
    hide: g('[aria-label="Hide sidebar"]'),
    search: g('[aria-label="Search chats"]'),
    profile: g('[aria-label="Open profile menu"]'),
    segment: g('[aria-label="Composer mode"]'),
    h1: g('h1'),
    aside: g('aside'),
  };
});
ok('Hide sidebar 196,8 36×36', JSON.stringify(pos.hide) === '[196,8,36,36]', JSON.stringify(pos.hide));
ok('Search 152,8 36×36', JSON.stringify(pos.search) === '[152,8,36,36]', JSON.stringify(pos.search));
ok('البروفايل 6,866 151×48', JSON.stringify(pos.profile) === '[6,866,151,48]', JSON.stringify(pos.profile));
ok('Composer mode 964,8 224×36', JSON.stringify(pos.segment) === '[964,8,224,36]', JSON.stringify(pos.segment));
ok('العنوان عند 321', pos.h1?.[1] === 321, JSON.stringify(pos.h1));
ok('الشريط 240', pos.aside?.[2] === 240, JSON.stringify(pos.aside));

/* ٤ · لا أخطاء */
ok('لا أخطاء صفحة', errs.length === 0, errs[0] || '');

await b.close();
console.log(`\n══ الواجهة: ${pass} ناجح · ${fail} فاشل ══\n`);
process.exit(fail ? 1 : 0);

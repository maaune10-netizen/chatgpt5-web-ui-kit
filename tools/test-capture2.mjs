#!/usr/bin/env node
/**
 * test-capture2.mjs — اختبار آليّ للسكربت على أكثر من موقع.
 *
 *   node tools/test-capture2.mjs [url…]
 *
 * يتحقّق من المراحل الخمس على صفحة حقيقيّة:
 *   ١ كائنات · ٢ ألوان · ٣ حركة · ٤ علاقات · ٥ سبب وأثر
 */
import { chromium } from '/home/deploy/pro/e2e/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('/home/deploy/gpt5-kit/tools/capture2.js', 'utf8');
const urls = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['https://bahr-vps.tail18374c.ts.net:8446/'];

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
};

const b = await chromium.launch();

for (const url of urls) {
  console.log(`\n══ ${url} ══`);
  const p = await (await b.newContext({ viewport: { width: 1530, height: 800 }, acceptDownloads: true })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));

  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { localStorage.setItem('gpt5.signedIn', '1'); localStorage.setItem('gpt5.theme', 'dark'); });
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(2600);

  await p.evaluate(SRC);
  await p.waitForTimeout(700);

  /* تفاعل: تحويم، ضغط، كتابة */
  await p.hover('[aria-label="Temporary chat"]').catch(() => {});
  await p.waitForTimeout(1300);
  await p.click('[aria-label="Dictate"]').catch(() => {});
  await p.waitForTimeout(1500);

  const [dl] = await Promise.all([
    p.waitForEvent('download', { timeout: 25000 }).catch(() => null),
    p.click('#__c2_d'),
  ]);
  if (!dl) { fail++; console.log('  ✗ لا ملفّ نزل'); await p.close(); continue; }
  await dl.saveAs('/tmp/t.json');
  const j = JSON.parse(readFileSync('/tmp/t.json', 'utf8'));
  const m = j.meta;

  ok('١ · كائنات موجودة', m.objects > 20, `(${m.objects})`);
  ok('١ · لكل كائن اسم ومنطقة', j.objects.every((o) => o.name && o.region));
  ok('٢ · لوحة ألوان فيها نصّ', (m.palette?.text?.length || 0) > 0, `(${m.palette?.text?.length})`);
  ok('٢ · لوحة ألوان فيها خلفيات', (m.palette?.bg?.length || 0) > 0);
  ok('٣ · تغيّرات مسجّلة', j.objects.some((o) => o.changes?.length), `(${j.objects.filter((o) => o.changes?.length).length})`);
  ok('٣ · حركة واحدة على الأقلّ', (m.motion || 0) > 0, `(${m.motion})`);
  ok('٤ · علاقة الأب', j.objects.filter((o) => o.relation?.parent).length > 10);
  ok('٤ · فراغ عن الشقيق', j.objects.some((o) => o.relation?.gap));
  ok('٤ · محاذاة محسوبة', j.objects.some((o) => o.relation?.align));
  ok('٥ · نقرة مع أثر', (j.clicks || []).some((c) => (c.effects || []).length), `(${(j.clicks || []).map((c) => (c.effects || []).length).join(',')})`);
  ok('٠ · لا أخطاء صفحة', errs.length === 0, errs[0] || '');

  /* إعادة الاستعمال: نفس السكربت على صفحة أخرى */
  const p2 = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await p2.goto(url, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(2000);
  await p2.evaluate(SRC);
  await p2.waitForTimeout(900);
  const o2 = await p2.evaluate(() => ({ objects: window.__cap2.objects.size }));
  ok('٦ · يعمل على صفحة أخرى', o2.objects > 10, `(${o2.objects})`);
  await p2.close();
  await p.close();
}

await b.close();
console.log(`\n══ النتيجة: ${pass} ناجح · ${fail} فاشل ══\n`);
process.exit(fail ? 1 : 0);

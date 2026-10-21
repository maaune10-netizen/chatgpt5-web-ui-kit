#!/usr/bin/env node
/**
 * capture-report.mjs — يقرأ ملفّ capture.js ويُخرج كل ما فيه كأرقام.
 *
 *   node tools/capture-report.mjs <capture.json> [--icons <dir>] [--page <substr>]
 *
 * ويُخرج:
 *   • ملخّص: الحالات · العروض · المدد · الصفحات.
 *   • لكل صفحة: عناصرها · ألوانها · خطوطها.
 *   • **التباين**: أسوأ عشرة، وأفضلها — للتحقّق من «باهت».
 *   • **الأيقونات**: مفكوكة إلى ملفّات (--icons)، مع viewBox والسماكة.
 *   • **الظهور**: ما يوجد عند عرض ويغيب عند آخر.
 *   • **الفروق**: ما أُضيف/حُذف/تحرّك بين الحالات.
 *   • قواعد :hover/:focus المستخرجة.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: capture-report.mjs <capture.json> [--icons <dir>] [--page <substr>]');
  process.exit(1);
}
const flag = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const ICONS = flag('--icons');
const PAGE = flag('--page');

const j = JSON.parse(readFileSync(file, 'utf8'));
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
const pathOf = (u) => {
  try {
    return new URL(u).pathname;
  } catch {
    return u;
  }
};

/* ————— ملخّص ————— */
console.log('\n══ الملفّ ══');
console.log(`  ${basename(file)}  ${mb(readFileSync(file).length)}`);
const m = j.meta;
console.log(`  الحالات ${m.states} · المدد ${(m.durationMs / 1000).toFixed(0)}s · المسجَّل ${m.styleTableSize} نمطًا · ${m.cssRuleCount} قاعدة CSS`);
console.log(`  العروض: ${m.viewports.join(' · ')}`);
console.log(`  الأصول: ${m.assetCount} (${mb(m.assetBytes)}) · نقاط الانكسار: ${m.breakpoints.length}`);
if (m.cssSkipped?.length) console.log(`  ⚠ أوراق ممنوعة (CORS): ${m.cssSkipped.length}`);

/* ————— الصفحات ————— */
const byUrl = new Map();
for (const s of j.states) {
  const k = pathOf(s.url);
  if (!byUrl.has(k)) byUrl.set(k, []);
  byUrl.get(k).push(s);
}
console.log('\n══ الصفحات ══');
for (const [k, list] of [...byUrl].sort((a, b) => b[1].length - a[1].length)) {
  const last = list[list.length - 1];
  console.log(`  ${pad(k, 44)} ${String(list.length).padStart(2)} حالة · ${pad(last.viewport.w + 'px', 6)} · ${last.counts.elements} عنصرًا · «${last.title.slice(0, 30)}»`);
}

/* ————— الفلترة ————— */
let states = j.states;
if (PAGE) states = states.filter((s) => s.url.includes(PAGE));

/* ————— الألوان والخطوط ————— */
const tally = (arr, fn) => {
  const m = new Map();
  for (const x of arr) {
    const v = fn(x);
    if (v) m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1]);
};
const allEl = states.flatMap((s) => s.elements);
const colorOf = (el, prop) => j.styles[el.s]?.[prop];

console.log('\n══ ألوان النصّ (بعددها) ══');
for (const [v, n] of tally(allEl, (e) => (e.text ? colorOf(e, 'color') : null)).slice(0, 10)) console.log(`  ${pad(v, 34)} ×${n}`);

console.log('\n══ الخلفيات ══');
for (const [v, n] of tally(allEl, (e) => {
  const b = colorOf(e, 'background-color');
  return b && b !== 'rgba(0, 0, 0, 0)' ? b : null;
}).slice(0, 10)) console.log(`  ${pad(v, 44)} ×${n}`);

console.log('\n══ الخطوط ══');
for (const [v, n] of tally(allEl, (e) => {
  const f = j.styles[e.s];
  return f ? `${f['font-size']}/${f['line-height']} w${f['font-weight']}` : null;
}).slice(0, 12)) console.log(`  ${pad(v, 30)} ×${n}`);

/* ————— التباين ————— */
const contrasts = allEl.filter((e) => e.contrast && e.text);
console.log('\n══ التباين — الأسوأ ══');
for (const e of [...contrasts].sort((a, b) => a.contrast.ratio - b.contrast.ratio).slice(0, 10)) {
  const c = e.contrast;
  console.log(`  ${String(c.ratio).padStart(6)} ${pad('«' + e.text.slice(0, 26) + '»', 30)} ${c.fg} على ${c.bg}`);
}
console.log('  — الأفضل —');
for (const e of [...contrasts].sort((a, b) => b.contrast.ratio - a.contrast.ratio).slice(0, 3)) {
  console.log(`  ${String(e.contrast.ratio).padStart(6)} «${e.text.slice(0, 26)}»`);
}

/* ————— الأيقونات ————— */
const svgs = new Map();
for (const s of states) for (const v of s.svgs) if (!svgs.has(v.html)) svgs.set(v.html, { ...v, seen: 0 });
for (const s of states) for (const v of s.svgs) if (svgs.has(v.html)) svgs.get(v.html).seen++;

console.log(`\n══ الأيقونات (${svgs.size} فريد) ══`);
for (const v of [...svgs.values()].sort((a, b) => b.seen - a.seen).slice(0, 14)) {
  console.log(`  ${pad(v.box.w + '×' + v.box.h, 10)} vb=${pad(v.viewBox || '-', 16)} sw=${pad(v.strokeWidth, 5)} widths=${JSON.stringify(v.widths).slice(0, 14)}`);
}

const uses = states.flatMap((s) => s.uses || []).filter((u) => u.resolved);
if (uses.length) {
  const uq = new Map(uses.map((u) => [u.id, u]));
  console.log(`  <use> محلولة: ${uq.size} → ${[...uq.keys()].slice(0, 8).join(', ')}`);
}

/* استخراج الأيقونات إلى ملفّات */
if (ICONS) {
  mkdirSync(ICONS, { recursive: true });
  let n = 0;
  for (const [url, a] of Object.entries(j.assets || {})) {
    if (!a?.dataUrl || !/svg/.test(a.mime || '')) continue;
    const name = (pathOf(url).split('/').pop() || 'icon').replace(/[^\w.-]/g, '-');
    writeFileSync(join(ICONS, name), Buffer.from(a.dataUrl.split(',')[1], 'base64'));
    n++;
  }
  for (const [html, v] of svgs) {
    writeFileSync(join(ICONS, `inline-${(html.length + 'x' + v.box.w).slice(0, 12)}-${createHash('sha1').update(html).digest('hex').slice(0, 8)}.svg`), html);
    n++;
  }
  console.log(`  ⤓ كُتب ${n} ملفًّا في ${ICONS}`);
}

/* ————— pseudo ————— */
const pseudo = states.flatMap((s) => s.pseudo || []);
if (pseudo.length) {
  console.log(`\n══ ::before / ::after (${pseudo.length}) ══`);
  for (const p of pseudo.slice(0, 8)) console.log(`  ${p.pe} ${pad(p.size, 12)} content=${p.content.slice(0, 24)} ${p.maskImage !== 'none' ? 'mask✓' : ''}`);
}

/* ————— الظهور ————— */
const widths = [...new Set(states.map((s) => s.viewport.w))].sort((a, b) => a - b);
console.log(`\n══ الظهور عبر ${widths.join('/')} ══`);
const vanished = j.appearance.filter((a) => a.missingAt.length && a.widths.length);
for (const a of vanished.slice(0, 12)) {
  const label = a.key.split('|').slice(1).filter(Boolean).join(' ') || a.key.split('|')[0];
  console.log(`  ${pad('«' + label.slice(0, 30) + '»', 34)} موجود ${a.widths.join(',')} · غائب ${a.missingAt.join(',')}`);
}
console.log(`  (${vanished.length} عنصرًا يغيب عند عرض ما)`);

/* ————— الفروق ————— */
console.log('\n══ الفروق بين الحالات ══');
for (const s of states.filter((x) => x.diff).slice(-6)) {
  const d = s.diff;
  console.log(`  #${s.id} ${pad(s.trigger, 9)} ${pad(s.viewport.w + 'px', 6)} +${d.added.length} −${d.removed.length} ↗${d.moved.length} ⇔${d.resized.length} ✎${d.restyled.length}`);
  for (const x of d.added.slice(0, 2)) console.log(`      + ${x.slice(0, 60)}`);
  for (const x of d.removed.slice(0, 2)) console.log(`      − ${x.slice(0, 60)}`);
}

/* ————— CSS ————— */
const hover = (j.css || []).filter((r) => /:hover|:focus|:active/.test(r.css));
console.log(`\n══ CSS التفاعل (${hover.length} من ${j.css.length}) ══`);
for (const r of hover.slice(0, 6)) console.log(`  ${(r.media ? r.media + ' ' : '') + r.css.slice(0, 88)}`);

/* ————— الروابط ————— */
if (j.links?.length) {
  console.log(`\n══ الروابط (${j.links.length}) ══`);
  for (const l of j.links.slice(0, 14)) console.log(`  ×${pad(l.count, 3)} ${pathOf(l.url).slice(0, 70)}`);
}

console.log('');

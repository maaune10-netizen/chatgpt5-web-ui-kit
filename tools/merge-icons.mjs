#!/usr/bin/env node
/**
 * ادمج خريطة أيقونات مُصدَّرة حديثًا في تصدير سابق.
 *
 * تصدير الملف كله يستغرق دقائق، معظمها في تصدير SVG. ووضع «الأيقونات وحدها»
 * في الإضافة يعيد خريطة الأيقونات فقط في ثوانٍ. فهذه الأداة تدمج الجديد في
 * القديم — بلا إعادة تصدير العقد.
 *
 *   node tools/merge-icons.mjs <icons.json> [dump.json]
 *
 * مع dump.json اختياري: يأخذ الأحدث في مجلد المراجع.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const REFS = '/home/deploy/refs/chatgpt';

const args = process.argv.slice(2);
const iconsPath = args[0];
if (!iconsPath) {
  console.error('usage: node tools/merge-icons.mjs <icons.json> [dump.json]');
  process.exit(1);
}

function newestDump() {
  const files = readdirSync(REFS)
    .filter((f) => /^figma-dump-.*\.json$/.test(f))
    .map((f) => ({ f, t: statSync(join(REFS, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) throw new Error('no dump found in ' + REFS);
  return join(REFS, files[0].f);
}

const dumpPath = args[1] || newestDump();
const dump = JSON.parse(readFileSync(dumpPath, 'utf8'));
const icons = JSON.parse(readFileSync(iconsPath, 'utf8'));

if (!icons.svgs || typeof icons.svgs !== 'object') {
  console.error('the icons file has no svgs map — is it an "Icons only" export?');
  process.exit(1);
}

const before = Object.keys(dump.svgs || {}).length;
const added = [];
const replaced = [];

for (const [id, svg] of Object.entries(icons.svgs)) {
  if (!svg) continue;
  if (!dump.svgs) dump.svgs = {};
  if (dump.svgs[id] === undefined) added.push(id);
  else if (dump.svgs[id] !== svg) replaced.push(id);
  dump.svgs[id] = svg;
}

const after = Object.keys(dump.svgs).length;

/* الصور تُدمج بالطريقة نفسها */
let imgAdded = 0;
for (const [hash, url] of Object.entries(icons.images || {})) {
  if (!url) continue;
  if (!dump.images) dump.images = {};
  if (dump.images[hash] === undefined) imgAdded++;
  dump.images[hash] = url;
}
if (imgAdded) console.log('images added ' + imgAdded);

/* سجّل ما بقي فاشلًا في التشخيص كي لا يضيع */
if (icons.meta && icons.meta.svgFailures) {
  dump.diagnostics = dump.diagnostics || {};
  dump.diagnostics.svgFailures = icons.meta.svgFailures;
}

const out = dumpPath.replace(/\.json$/, '') + '-merged.json';
writeFileSync(out, JSON.stringify(dump));

console.log('dump        ' + basename(dumpPath));
console.log('icons file  ' + basename(iconsPath));
console.log('svgs before ' + before);
console.log('  added     ' + added.length);
console.log('  changed   ' + replaced.length);
console.log('svgs after  ' + after);
if (icons.meta && icons.meta.svgFailures && icons.meta.svgFailures.length) {
  console.log('still failing ' + icons.meta.svgFailures.length + ':');
  for (const f of icons.meta.svgFailures) console.log('    ' + f.name + '  (' + f.key + ')  ' + f.reason);
}
console.log('written     ' + out);

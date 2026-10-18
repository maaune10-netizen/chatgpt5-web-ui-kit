#!/usr/bin/env node
/**
 * يولّد خريطة الأيقونات لأسماء الطبقات في Figma.
 *
 * ولا يخترع اسم ملف واحدًا: كل مدخل مقروء من خريطة `icons` في التصدير،
 * ومفتاحه هو اسم الطبقة نفسه (`General / Copy` ← `copy`).
 * والمفاتيح غير الموجودة تُذكر صراحةً كي لا يظهر رمز مفقود بلا سبب معروف.
 *
 *   node tools/build-icon-map.mjs [ملف التصدير]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REFS = '/home/deploy/refs/chatgpt';

function pickDump() {
  if (process.argv[2]) return resolve(process.argv[2]);
  const files = readdirSync(REFS)
    .filter((f) => /^figma-dump-.*\.json$/.test(f))
    .map((f) => ({ f, t: statSync(join(REFS, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return join(REFS, files[0].f);
}

const dump = JSON.parse(readFileSync(pickDump(), 'utf8'));
const st = [];
for (const x of dump.nodes) {
  while (st.length && st[st.length - 1].depth >= x.depth) st.pop();
  x._p = st[st.length - 1] || null;
  st.push(x);
}

/*
 * الاسم المنطقي للأيقونة موجود في **الأب**، لا في المتجه نفسه.
 * فالمتجه اسمه «Vector» دائمًا، وأبوه هو «General / Copy».
 * فأصعد حتى أقرب سلف يحمل شرطة مائلة.
 */
function logicalOf(node) {
  let p = node;
  let guard = 0;
  while (p && guard++ < 12) {
    const nm = String(p.name || '');
    if (nm.includes('/')) return nm;
    p = p._p;
  }
  return String(node.name || '');
}

const camel = (s) =>
  s
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('');

const out = {};
const byName = {};
for (const n of dump.nodes) {
  if (!n.vector) continue;
  const rec = dump.icons && dump.icons[String(n.id).split(';').pop()];
  if (!rec) continue;
  /* نأخذ أول عقدة تحمل الاسم، وهي عقدة المكوّن الأساسي */
  const key = logicalOf(n);
  if (byName[key]) continue;
  byName[key] = rec.file;
}

for (const [k, v] of Object.entries(byName)) {
  const name = camel(k.includes('/') ? k.split('/').pop() : k);
  if (name && !out[name]) out[name] = v;
}

/* الأسماء المطلوبة صراحةً — نتحقق من وجودها ونعلن الناقص */
const WANT = [
  'Copy', 'Thumbs Up', 'Thumbs Down', 'Share', 'Upload', 'Retry', 'Overflow',
  'Add', 'Microphone', 'Voice', 'Arrow Up', 'Stop', 'Stop Alt', 'Sidebar',
  'Search', 'Library', 'Create', 'Explore', 'Folder', 'Folder Add', 'Folder Open',
  'Settings', 'Settings Alt', 'Logout', 'Personalization', 'Group', 'Check',
  'Close', 'Chevron Down', 'Chevron Up', 'Chevron Left', 'Chevron Right',
  'Account', 'Help', 'Star', 'Upgrade Sparkle', 'Upgrade Sparkle Solid',
  'Arrow Down', 'Arrow Left', 'Arrow Right', 'Chat Bubble', 'Image', 'Images',
  'Document', 'Download', 'Link', 'Edit', 'Attach', 'Model', 'User', 'ChatGPT',
  'Email', 'Privacy', 'Security', 'Billing', 'Connected Apps', 'Tasks', 'Code',
];

const missing = [];
for (const w of WANT) {
  const name = camel(w);
  if (!out[name]) missing.push(w);
}

const lines = [
  '/**',
  ' * أسماء ملفات الأيقونات — مولَّد آليًا من تصدير Figma.',
  ' * لا تُحرّره بيدك: شغّل `node tools/build-icon-map.mjs` بعد كل تصدير.',
  ' *',
  ' * المجموع: ' + Object.keys(out).length + ' أيقونة.',
  ' */',
  '',
  'export const ICONS: Record<string, string> = {',
  ...Object.entries(out)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`),
  '};',
  '',
  '/** يسقط إلى undefined بدل أن يرسم شيئًا خطأً */',
  'export function icon(name: string): string | undefined {',
  '  return ICONS[name];',
  '}',
  '',
];

/* أيقونتان مرسومتان هنا لأن الحزم لا تحويهما — لا تُمسحان مع التوليد */
/*
 * المرسوم يدويًا يُشار إليه بمسار كامل، لا باسم ملف داخل مجلد المولَّد.
 * ومجلد `app-icons` لا يمسّه المولّد إطلاقًا.
 */
lines.splice(lines.indexOf('};'), 0,
  '  "pin": "app-icons/pin",',
  '  "pinFilled": "app-icons/pin-filled",',
);

writeFileSync(join(ROOT, 'src/lib/icon-map.ts'), lines.join('\n'));

console.log('icon map: ' + Object.keys(out).length + ' entries');
if (missing.length) console.log('  requested but absent: ' + missing.join(', '));
console.log('  written: src/lib/icon-map.ts');

#!/usr/bin/env node
/**
 * مستكشف الروابط — يحوّل ملفًّا فيه روابط إلى **جرد مسارات**.
 *
 * ولا يزحف الموقع: chatgpt.com تُعيد 403 من Cloudflare، وتجاوزها مرفوض. فالملفّ
 * يأتي من المستخدم (تصدير سجلّ، إشارات مرجعية، أو قائمة يدويّة)، وهذا يحوّله
 * إلى جدول: أي مسار، كم مرّة، ومثال.
 *
 *   node tools/links.mjs <ملف>            # جدول في الطرفية
 *   node tools/links.mjs <ملف> --json     # JSON للتوثيق
 *   node tools/links.mjs <ملف> --md       # جدول Markdown جاهز للّصق
 *
 * ويقبل أي نصّ: سطر لكل رابط، أو JSON، أو HTML — يستخرج كل `http(s)://…`.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
const wantJson = process.argv.includes('--json');
const wantMd = process.argv.includes('--md');

if (!file) {
  console.error('الاستعمال: node tools/links.mjs <ملف> [--json|--md]');
  process.exit(1);
}

const raw = readFileSync(file, 'utf8');

/* ————— استخراج ————— */
const urls = new Set();
for (const m of raw.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)) urls.add(m[0].replace(/[.,;:]+$/, ''));
/* روابط نسبية في تصدير HTML */
for (const m of raw.matchAll(/(?:href|url)="(\/[^"]{2,})"/g)) urls.add('https://chatgpt.com' + m[1]);

if (!urls.size) {
  console.error('لا روابط في الملفّ. تأكّد أنّه نصّ أو JSON أو HTML فيه عناوين كاملة.');
  process.exit(1);
}

/* ————— تطبيع ————— */
/** مقطع يبدو معرّفًا: uuid · hex طويل · رقم · slug عشوائي طويل */
const isId = (seg) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) ||
  /^[0-9a-f]{16,}$/i.test(seg) ||
  /^\d+$/.test(seg) ||
  /^(c|g|conv|chat|file|assistant)[_-][A-Za-z0-9]{5,}$/.test(seg) ||
  /^[A-Za-z0-9_-]{24,}$/.test(seg);

const rows = new Map();
for (const u of urls) {
  let url;
  try {
    url = new URL(u);
  } catch {
    continue;
  }
  const segs = url.pathname.split('/').filter(Boolean);
  const shape = '/' + segs.map((s) => (isId(s) ? ':id' : s)).join('/');
  const key = `${url.host}${shape === '/' ? '/' : shape}`;
  const row = rows.get(key) || { key, host: url.host, shape, count: 0, example: u, idSegments: 0 };
  row.count++;
  row.idSegments = Math.max(row.idSegments, segs.filter(isId).length);
  rows.set(key, row);
}

const list = [...rows.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
const hosts = [...new Set(list.map((r) => r.host))];

/* ————— إخراج ————— */
if (wantJson) {
  const out = {
    at: new Date().toISOString(),
    source: file,
    totalUrls: urls.size,
    routes: list.length,
    hosts,
    rows: list,
  };
  const dest = file.replace(/\.[^.]+$/, '') + '-routes.json';
  writeFileSync(dest, JSON.stringify(out, null, 1));
  console.log(`  ${dest}  — ${list.length} مسارًا من ${urls.size} رابطًا`);
  process.exit(0);
}

if (wantMd) {
  console.log('| المسار | عدد الروابط | فيه معرّف؟ | مثال |');
  console.log('|---|---|---|---|');
  for (const r of list) console.log(`| \`${r.key}\` | ${r.count} | ${r.idSegments ? 'نعم' : '—'} | ${r.example} |`);
  process.exit(0);
}

console.log(`\n  الملفّ: ${file}`);
console.log(`  روابط: ${urls.size} · مسارات مختلفة: ${list.length}`);
console.log(`  نطاقات: ${hosts.join(' · ')}\n`);
console.log('  ' + 'المسار'.padEnd(46) + 'عدد   معرّف');
console.log('  ' + '─'.repeat(70));
for (const r of list) {
  console.log('  ' + r.key.slice(0, 45).padEnd(46) + String(r.count).padStart(4) + '   ' + (r.idSegments ? 'نعم' : '—'));
}
console.log('  ' + '─'.repeat(70));
console.log('\n  --md لجدول Markdown · --json لملفّ للتوثيق\n');

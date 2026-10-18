#!/usr/bin/env node
/**
 * قائمة الحساب — تركيب، لا استخراج. وهذا مصرّح به في كل سطر.
 *
 * حزمة GPT-5 تحمل هيكل القائمة بلا محتوى: كل عنصر في `Context Menu` مكتوب
 * «Menu Item» و«Secondary text». وحزمة GPT-4o تحمل المحتوى الحقيقي بمقاسات
 * أخرى (شريطها 198 مقابل 260، ونصها 10.87 مقابل 14).
 *
 * فهذا الملف يجمع الاثنين:
 *   المقاسات والألوان والظل والأيقونات   ← GPT-5   (مقروءة من 61:13896)
 *   النصوص وترتيب العناصر والألوان        ← GPT-4o  (مقروءة من قائمة الحساب)
 *
 * ولا يخترع شيئًا: كل رقم هنا مأخوذ من أحد الملفين، ومصدره مذكور بجانبه.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const G5 = '/home/deploy/refs/chatgpt/figma-dump-v3-2026-10-17T08-41-45.json';
const G4 = '/home/deploy/refs/chatgpt/4o.json';

/* ---------- مقاسات GPT-5: من Context Menu 61:13896 ---------- */
const T = {
  menuW: 260,             // عرض الشريط الجانبي في GPT-5 (Sidebar 260x800)
  pad: 6,                 // pad=4/6/4/6
  padV: 4,
  radius: 16,             // r=16
  bg: '#353535',          // bg=#353535
  // ثلاثة ظلال، مقروءة من العقدة نفسها
  fx: 'inset 0 0 1px 1px rgba(255,255,255,0.13), 0 6px 8px 0 rgba(0,0,0,0.10), 0 0 1.5px 0 rgba(0,0,0,0.45)',
  itemH: 36,              // 228x36
  itemRadius: 10,         // r=10
  itemPadX: 10,           // pad=6/10/6/10
  icon: 20,               // General / * 20x20
  gap: 8,                 // gap=8
  labelSize: 14,          // Inter 14/400
  labelLh: 19.74,
  labelColor: '#ffffff',
  subSize: 12,            // Inter 12/400
  subLh: 15.6,
  subColor: '#afafaf',    // #afafaf
  dividerH: 8,            // Divider 228x8، pad=4/0/4/0
  dividerColor: 'rgba(255,255,255,0.26)', // LINE stroke=#ffffff o=0.26
};

/* ---------- محتوى GPT-4o ---------- */
const ORGS = [
  { name: 'Interaction Faction', color: '#3d47ff', initials: 'IF' },
  { name: 'Personal account', color: '#287fb8', initials: 'JO', active: true },
];
const ITEMS = [
  { label: 'Manage workspace', icon: 'Group' },
  { label: 'My GPTs', icon: 'Folder' },
  { label: 'Customize ChatGPT', icon: 'Personalization' },
  { label: 'Settings', icon: 'Settings' },
];
const LAST = { label: 'Log out', icon: 'Logout' };
const EMAIL = 'hello@interactionfaction.com';

/* ---------- الأيقونات: اسم الطبقة → ملفها ---------- */
function iconFiles() {
  const j = JSON.parse(readFileSync(G5, 'utf8'));
  const st = [];
  for (const x of j.nodes) { while (st.length && st[st.length - 1].depth >= x.depth) st.pop(); x._p = st[st.length - 1] || null; st.push(x); }
  const out = {};
  for (const n of j.nodes) {
    if (!n.vector) continue;
    let p = n, host = null;
    while (p) { if (/^General \//.test(p.name || '')) { host = p.name.replace('General / ', ''); break; } p = p._p; }
    if (!host || out[host]) continue;
    const rec = j.icons[String(n.id).split(';').pop()];
    if (rec) out[host] = rec.file;
  }
  return out;
}

const ICON = iconFiles();

/* ---------- البناء ---------- */
const nodes = [];
const push = (o) => nodes.push(o);

/* الأرقام: كل إزاحة مشتقة من مقاسات GPT-5 أعلاه، لا مُقدَّرة */
const innerW = T.menuW - T.pad * 2;                 // 248
const labelX = T.itemPadX + T.icon + T.gap;         // 38 داخل العنصر
const trailX = innerW - T.itemPadX - T.icon;        // 218 داخل العنصر

let y = T.padV;

/* الرأس: البريد + أيقونة النسخ */
const headerY = y;
push({ n: 'Header', t: 'FRAME', d: 1, x: T.pad, y: headerY, w: innerW, h: T.itemH });
push({
  n: 'Email', t: 'TEXT', d: 2, x: T.itemPadX, y: (T.itemH - T.labelLh) / 2,
  w: trailX - T.itemPadX - T.gap, h: T.labelLh,
  tx: EMAIL, ff: 'Inter', fs: T.labelSize, fw: 400, lh: T.labelLh,
  color: T.subColor, ar: 'WIDTH_AND_HEIGHT',
});
if (ICON.Copy) {
  push({ n: 'Copy', t: 'VECTOR', d: 2, x: trailX, y: (T.itemH - T.icon) / 2, w: T.icon, h: T.icon, ic: ICON.Copy });
}
y += T.itemH;

push({ n: 'Divider', t: 'FRAME', d: 1, x: T.pad, y, w: innerW, h: T.dividerH });
push({ n: 'Line', t: 'RECTANGLE', d: 2, x: 0, y: T.dividerH / 2, w: innerW, h: 1, bg: T.dividerColor });
y += T.dividerH;

/* المنظمات: مربّع ملوّن بحرفين بدل شعار — وهي ألوان 4o نفسها */
for (const org of ORGS) {
  push({ n: org.name, t: 'INSTANCE', d: 1, x: T.pad, y, w: innerW, h: T.itemH, r: T.itemRadius });
  const ix = T.itemPadX;
  push({ n: 'Logo', t: 'RECTANGLE', d: 2, x: ix, y: (T.itemH - T.icon) / 2, w: T.icon, h: T.icon, bg: org.color, r: 6 });
  push({
    n: 'Initials', t: 'TEXT', d: 3, x: 0, y: (T.icon - 10) / 2, w: T.icon, h: 10,
    tx: org.initials, ff: 'Inter', fs: 9, fw: 600, lh: 10, color: '#ffffff', ta: 'c', ar: 'WIDTH_AND_HEIGHT',
  });
  push({
    n: 'Label', t: 'TEXT', d: 2, x: labelX, y: (T.itemH - T.labelLh) / 2, w: trailX - labelX - T.gap, h: T.labelLh,
    tx: org.name, ff: 'Inter', fs: T.labelSize, fw: 400, lh: T.labelLh, color: T.labelColor, ar: 'WIDTH_AND_HEIGHT',
  });
  /* 4o تضع علامة صح على كل منظمة؛ وأبقيتها على النشطة فقط لأنها في الحقيقة
     تعني «المحدَّدة». وهذا الفرق الوحيد بين المحتوى وما بنيته. */
  if (org.active && ICON.Check) {
    push({ n: 'Check', t: 'VECTOR', d: 2, x: trailX, y: (T.itemH - T.icon) / 2, w: T.icon, h: T.icon, ic: ICON.Check });
  }
  y += T.itemH;
}

push({ n: 'Divider', t: 'FRAME', d: 1, x: T.pad, y, w: innerW, h: T.dividerH });
push({ n: 'Line', t: 'RECTANGLE', d: 2, x: 0, y: T.dividerH / 2, w: innerW, h: 1, bg: T.dividerColor });
y += T.dividerH;

/* العناصر */
for (const it of ITEMS) {
  push({ n: it.label, t: 'INSTANCE', d: 1, x: T.pad, y, w: innerW, h: T.itemH, r: T.itemRadius });
  if (ICON[it.icon]) {
    push({ n: it.icon, t: 'VECTOR', d: 2, x: T.itemPadX, y: (T.itemH - T.icon) / 2, w: T.icon, h: T.icon, ic: ICON[it.icon] });
  }
  push({
    n: 'Label', t: 'TEXT', d: 2, x: labelX, y: (T.itemH - T.labelLh) / 2, w: trailX - labelX - T.gap, h: T.labelLh,
    tx: it.label, ff: 'Inter', fs: T.labelSize, fw: 400, lh: T.labelLh, color: T.labelColor, ar: 'WIDTH_AND_HEIGHT',
  });
  y += T.itemH;
}

push({ n: 'Divider', t: 'FRAME', d: 1, x: T.pad, y, w: innerW, h: T.dividerH });
push({ n: 'Line', t: 'RECTANGLE', d: 2, x: 0, y: T.dividerH / 2, w: innerW, h: 1, bg: T.dividerColor });
y += T.dividerH;

push({ n: LAST.label, t: 'INSTANCE', d: 1, x: T.pad, y, w: innerW, h: T.itemH, r: T.itemRadius });
if (ICON[LAST.icon]) {
  push({ n: LAST.icon, t: 'VECTOR', d: 2, x: T.itemPadX, y: (T.itemH - T.icon) / 2, w: T.icon, h: T.icon, ic: ICON[LAST.icon] });
}
push({
  n: 'Label', t: 'TEXT', d: 2, x: labelX, y: (T.itemH - T.labelLh) / 2, w: trailX - labelX - T.gap, h: T.labelLh,
  tx: LAST.label, ff: 'Inter', fs: T.labelSize, fw: 400, lh: T.labelLh, color: T.labelColor, ar: 'WIDTH_AND_HEIGHT',
});
y += T.itemH + T.padV;

const totalH = Math.round(y);

/* جذر الشاشة */
const screen = {
  slug: 'account-menu',
  name: 'Account Menu (composed)',
  w: T.menuW,
  h: totalH,
  bg: T.bg,
  nodes: [
    { n: 'Account Menu', t: 'FRAME', d: 0, x: 0, y: 0, w: T.menuW, h: totalH, bg: T.bg, r: T.radius, fx: T.fx },
    ...nodes.map((n) => ({ ...n })),
  ],
};

/*
 * الإحداثيات تبقى نسبية للعنصر الأب — والعارض ينصّب الأبناء داخل الآباء
 * فيضيف الإزاحة بنفسه. وجمعها هنا كان يجعلها تُضاف مرّتين: الشعار ظهر عند
 * y=104 بدل 56، والحروف عند y=165 بدل 61.
 */

const out = join(ROOT, 'public/screens/account-menu.json');
writeFileSync(out, JSON.stringify(screen));

const idxPath = join(ROOT, 'public/screens/index.json');
try {
  const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
  const without = idx.filter((e) => e.slug !== 'account-menu');
  /* الوسم مهم: يميّزها عن الشاشات المُستخرجة كي لا يمحوها المولّد */
  without.push({ slug: 'account-menu', name: screen.name, node: 'composed', count: screen.nodes.length, composed: true });
  without.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(idxPath, JSON.stringify(without, null, 2));
} catch (e) {
  console.error('could not update index.json:', e.message);
}

console.log('account menu: ' + screen.w + 'x' + screen.h + ', ' + screen.nodes.length + ' nodes');
console.log('  icons: ' + Object.keys(ICON).length + ' known');
console.log('  written: public/screens/account-menu.json');

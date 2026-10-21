#!/usr/bin/env node
/**
 * يحوّل `chatgpt-icons.json` (من سكربت الـConsole) إلى أيقونات في المشروع.
 *
 *   node tools/icons-from-capture.mjs <ملفّ.json>
 *
 * والفكرة: **الاسم الحقيقي يُطابَق باسمنا**، فلا نعدّل أي مكوّن. فحين يصل
 * `New chat` من الموقع يُكتب باسم `create`، فتأخذه كل مواضعه تلقائيًا.
 *
 * والمكتوب في `public/app-icons/chatgpt/` — لا في `generated-icons`، لأنّ ذلك
 * يُمسَح عند كل توليد من Figma.
 *
 * والملفّات تُسمّى بالمحتوى (hash) فلا تتضارب النسخ.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'app-icons', 'chatgpt');
const MAP_FILE = join(ROOT, 'src', 'lib', 'icon-capture.ts');

const file = process.argv[2];
if (!file) {
  console.error('الاستعمال: node tools/icons-from-capture.mjs <chatgpt-icons.json>');
  process.exit(1);
}
const data = JSON.parse(readFileSync(file, 'utf8'));

/**
 * اسم الموقع ← اسمنا. والقيمة `null` تعني «لا تُركَّب» (زخرفية أو مكرّرة).
 */
const ALIAS = {
  'New chat': 'create',
  Search: 'search',
  Library: 'book',
  'Hide sidebar': 'sidebar',
  'Show sidebar': 'sidebar',
  'Chat actions': 'overflow',
  'Pin chat': 'pin',
  'Unpin chat': 'pinFilled',
  'Add new project': 'add',
  Upgrade: 'upgradeSparkleSolid',
  'Temporary chat': 'temporaryChat',
  Think: 'think',
  Dictate: 'microphone',
  'Start Voice': 'voice',
  'Add files and more': 'add',
  'Dismiss suggestion': 'close',
  'Composer mode': 'chevronDown',
  'Filter chats and work': 'filter',
  'Chat history': 'chatThread',
};

/** اختيار الأفضل عند التكرار: مقاس ٢٠ ثم الأكبر */
function better(a, b) {
  const s = (i) => (i.size?.startsWith('20') ? 1000 : 0) + (i.html?.length || 0);
  return s(a) >= s(b) ? a : b;
}

/* ————— رموز الـsprite ————— *
 * كثير من الأيقونات ليست مسارات، بل `<use href="#books-light-20"/>` يشير إلى
 * ملفّ sprite. وملفّ مستقلّ فيه `<use>` **لا يرسم شيئًا** — وهذا ما جعل
 * أيقونة Library والطيّ تختفي. فحين يكون نصّ الـsprite عندنا نستبدل الـ`use`
 * بمحتوى الرمز؛ وحين لا يكون، **نتخطّى الأيقونة** بدل أن نكتب فراغًا.
 */
const symbols = new Map();
for (const f of data.spriteFiles || []) {
  if (!f.text) continue;
  for (const m of f.text.matchAll(/<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g)) {
    const id = /\bid="([^"]+)"/.exec(m[1])?.[1];
    if (!id) continue;
    symbols.set(id, { viewBox: /\bviewBox="([^"]+)"/.exec(m[1])?.[1], inner: m[2] });
  }
}

/** يستبدل `<use>` بمحتوى الرمز. ويعيد null إن تعذّر. */
function resolveUse(svg) {
  const m = /<use\b[^>]*href="[^"#]*#([^"]+)"[^>]*\/?>/.exec(svg) || /<use\b[^>]*xlink:href="[^"#]*#([^"]+)"[^>]*\/?>/.exec(svg);
  if (!m) return svg;
  const sym = symbols.get(m[1]);
  if (!sym) return null;
  const vb = sym.viewBox ? `viewBox="${sym.viewBox}"` : (svg.match(/viewBox="([^"]+)"/)?.[0] || '');
  return `<svg xmlns="http://www.w3.org/2000/svg" ${vb} fill="none">${sym.inner}</svg>`;
}

const chosen = new Map();
for (const icon of data.icons || []) {
  const raw = (icon.name || '').trim();
  if (!raw) continue;
  const mine = ALIAS[raw] ?? (ALIAS[raw] === null ? null : 'cc-' + raw.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  if (!mine) continue;
  const entry = { ...icon, _raw: raw };
  chosen.set(mine, chosen.has(mine) ? better(chosen.get(mine), entry) : entry);
}

/* امسح القديم: الملفّات تُسمّى بالهاش فتبقى نسخ ميتة */
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const map = {};
const skipped = [];
for (const [name, icon] of chosen) {
  let svg = resolveUse(icon.html);
  if (!svg) {
    skipped.push(`${name} (${icon._raw}) — <use> بلا sprite`);
    continue;
  }
  /* ضمان viewBox: القناع يحتاج مساحة إحداثيات */
  if (!/viewBox=/.test(svg) && icon.viewBox) svg = svg.replace('<svg', `<svg viewBox="${icon.viewBox}"`);

  /*
   * **المشكلة الحقيقية:** أيقونات الموقع تأخذ لونها من CSS في الصفحة
   * (`stroke: currentColor` في ورقة أنماط)، و`outerHTML` لا يحمل الأنماط.
   * فالملفّ المستقلّ يخرج بلا `stroke` ولا `fill` — أي **لا يُرسم**، وهو ما
   * جعل «New chat» و«Search» فراغًا.
   *
   * فنتحقّق: هل هي أيقونة خطوط (فيها stroke-width أو fill="none") أم مسارات
   * معبّأة؟ ونضع الخاصية على الجذر ليرثها الأبناء.
   */
  const isStroke = /stroke-width|stroke-linecap|stroke-linejoin|fill="none"/.test(svg);
  svg = svg
    .replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"')
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"');
  if (!/\bfill=/.test(svg.split('>')[0])) {
    svg = svg.replace('<svg', `<svg fill="${isStroke ? 'none' : 'currentColor'}"`);
  }
  if (isStroke && !/\bstroke=/.test(svg.split('>')[0])) {
    svg = svg.replace('<svg', '<svg stroke="currentColor"');
  }
  const hash = createHash('sha1').update(svg).digest('hex').slice(0, 8);
  const slug = name.replace(/^cc-/, 'cc-');
  writeFileSync(join(OUT_DIR, `${slug}-${hash}.svg`), svg);
  map[name] = `app-icons/chatgpt/${slug}-${hash}`;
}

const header = `/**
 * أيقونات مأخوذة من chatgpt.com نفسه — مولَّدة بـ\`tools/icons-from-capture.mjs\`.
 * لا تُحرّرها بيدك. وهي **تتقدّم على** \`icon-map.ts\` في \`Icon\`.
 *
 * المصدر: ${data.url || 'chatgpt.com'}
 * وقت السحب: ${data.at || '—'}
 * المجموع: ${Object.keys(map).length}
 */

export const CAPTURE_ICONS: Record<string, string> = `;
writeFileSync(MAP_FILE, header + JSON.stringify(map, null, 2) + ';\n');

console.log(`  كُتب ${Object.keys(map).length} أيقونة في ${OUT_DIR.replace(ROOT + '/', '')}`);
if (skipped.length) {
  console.log(`  تُخطّيت ${skipped.length} (تحتاج ملفّ الـsprite):`);
  for (const s of skipped) console.log('     · ' + s);
}
console.log(`  و ${MAP_FILE.replace(ROOT + '/', '')}`);
for (const [n] of chosen) console.log(`    ${n}`);

#!/usr/bin/env node
/**
 * أيقونات chatgpt.com → ملفّات في المشروع.
 *
 *   node tools/icons-from-capture.mjs <chatgpt-icons.json>
 *
 * ويأخذها من مصدرين، بالأولوية:
 *
 *   ١) **ملفّ الـsprite** — ٩٠٥ رموز في ملفّ واحد (`/cdn/assets/icons-*.svg`).
 *      وهذا هو الأصل: كل أيقونات الموقع فيه بأسمائها (`books-light-20`
 *      هي Library، و`brain-regular-20` هي Think).
 *   ٢) **الـSVG المضمَّن** — للأيقونات التي ليست في الـsprite (شعار ChatGPT مثلًا).
 *
 * ولماذا لا يكفي «انسخ HTML العنصر»: الأيقونة = الشكل + الأنماط + الـsprite.
 * ولون الأيقونة يأتي من ورقة أنماط الصفحة، فـ`outerHTML` بلا `stroke` ولا
 * `fill` = **لا شيء يُرسم**. فالمولّد يضع اللون صريحًا على الجذر.
 *
 * والمكتوب في `public/app-icons/chatgpt/` — لا في `generated-icons`، لأنّ ذلك
 * يُمسَح عند كل توليد من Figma.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
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
 * اسمنا ← رمز الـsprite. كل رمز هنا **متحقَّق من وجوده** في الملفّ؛
 * وما لا يوجد يُطبع في التقرير ولا يُكتب.
 */
const SPRITE_MAP = {
  images: 'photo-light-20',
  time: 'clock-light-20',
  book: 'books-light-20',
  integration: 'plugin-light-20',
  connectedApps: 'plugin-light-20',
  image: 'photo-light-20',
  settings: 'gear-light-20',
  codexAgentUpgraded: 'codex-light-20',
  explore: 'ellipsis-horizontal-light-20',
  sidebar: 'sidebar-light-20',
  upgradeSparkleSolid: 'sparkle-fill-light-20',
  add: 'plus-lg-regular-20',
  plus: 'plus-lg-regular-16',
  think: 'brain-regular-20',
  microphone: 'microphone-light-20',
  voice: 'voice-regular-20',
  close: 'xmark-md-light-20',
  chevronDown: 'chevron-down-md-light-16',
  overflow: 'ellipsis-horizontal-light-16',
  pin: 'pin-light-16',
  pinFilled: 'pin-fill-light-16',
  filter: 'filter-light-16',
  temporaryChat: 'chat-bubble-dashed-light-20',
  archive: 'archive-light-20',
  folder: 'folder-light-16',
  document: 'document-light-20',
  delete: 'trash-light-20',
  stop: 'stop-fill-light-20',
  edit: 'pencil-light-20',
  help: 'circle-questionmark-light-16',
  billing: 'credit-card-light-20',
  research: 'flask-light-20',
  globe: 'globe-light-20',
  link: 'link-light-20',
};

/** اسم الموقع ← اسمنا، للأيقونات المضمَّنة (غير الموجودة في الـsprite). */
const INLINE_ALIAS = {
  'New chat': 'create',
  Search: 'search',
  'Chat history': 'chatThread',
  ChatGPT: 'cc-chatgpt',
  Pinned: 'cc-pinned',
  Recents: 'cc-recents',
};

/**
 * تجاوزات يدويّة: أيقونات يعطيها المستخدم نصًّا (لأنّها ليست في الـsprite).
 * اسم الملفّ هو اسمنا: `explore.svg` ← `explore`. وهي **أعلى أولوية**.
 */
const OVERRIDES_DIR = join(ROOT, 'tools', 'icon-overrides');
const overrides = new Map();
if (existsSync(OVERRIDES_DIR)) {
  for (const f of readdirSync(OVERRIDES_DIR)) {
    if (!f.endsWith('.svg')) continue;
    overrides.set(f.slice(0, -4), readFileSync(join(OVERRIDES_DIR, f), 'utf8'));
  }
}

/* ————— الـsprite ————— */
const symbols = new Map();
for (const f of data.spriteFiles || []) {
  if (!f.text) continue;
  for (const m of f.text.matchAll(/<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g)) {
    const id = /\bid="([^"]+)"/.exec(m[1])?.[1];
    if (!id) continue;
    symbols.set(id, { viewBox: /\bviewBox="([^"]+)"/.exec(m[1])?.[1] || '0 0 20 20', inner: m[2] });
  }
}

/** يبني ملفّ SVG من رمز. واللون صريح لأنّ ورقة أنماط الصفحة لا ترافقنا. */
function symbolToSvg(id, sym) {
  /*
   * أيقونة الخطوط تُعلن `stroke-width` دائمًا. وكان الشرط يعتمد على `-fill`
   * في الاسم وعلى وجود `fill="none"` — فخرجت أيقونة مساراتها بلا `fill` ولا
   * `stroke` (لأنّ لونها من CSS) **بلا لون**. فصار الحكم من المحتوى لا من الاسم.
   */
  const filled = !/stroke-width/.test(sym.inner);
  const inner = sym.inner
    .replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"')
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sym.viewBox}" fill="${filled ? 'currentColor' : 'none'}"${
    filled ? '' : ' stroke="currentColor"'
  }>${inner}</svg>`;
}

/* امسح القديم: الملفّات تُسمّى بالهاش فتبقى نسخ ميتة */
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const map = {};
const report = { override: [], sprite: [], inline: [], missing: [] };

function write(name, svg) {
  const clean = svg.replace(/<symbol\b[^>]*>|<\/symbol>/g, '');
  const hash = createHash('sha1').update(clean).digest('hex').slice(0, 8);
  const slug = name.replace(/[^a-zA-Z0-9-]/g, '-');
  writeFileSync(join(OUT_DIR, `${slug}-${hash}.svg`), clean);
  map[name] = `app-icons/chatgpt/${slug}-${hash}`;
}

/* ٠) التجاوزات اليدويّة — أعلى أولوية */
for (const [name, svg] of overrides) {
  write(name, svg);
  report.override.push(name);
}

/* ١) من الـsprite */
for (const [name, id] of Object.entries(SPRITE_MAP)) {
  if (overrides.has(name)) continue; // التجاوز أعلى أولوية
  const sym = symbols.get(id);
  if (!sym) {
    report.missing.push(`${name} ← ${id}`);
    continue;
  }
  write(name, symbolToSvg(id, sym));
  report.sprite.push(name);
}

/* ٢) المضمَّنة — لما ليس في الـsprite */
const picked = new Map();
for (const icon of data.icons || []) {
  const mine = INLINE_ALIAS[(icon.name || '').trim()];
  if (!mine) continue;
  if (picked.has(mine)) continue;
  let svg = icon.html;
  if (/<use[\s>]/i.test(svg)) {
    report.missing.push(`${mine} (${icon.name}) — <use> بلا رمز`);
    continue;
  }
  if (!/viewBox=/.test(svg) && icon.viewBox) svg = svg.replace('<svg', `<svg viewBox="${icon.viewBox}"`);
  const isStroke = /stroke-width|stroke-linecap|stroke-linejoin|fill="none"/.test(svg);
  svg = svg.replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"').replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"');
  const root = svg.slice(0, svg.indexOf('>'));
  if (!/\bfill=/.test(root)) svg = svg.replace('<svg', `<svg fill="${isStroke ? 'none' : 'currentColor'}"`);
  if (isStroke && !/\bstroke=/.test(root)) svg = svg.replace('<svg', '<svg stroke="currentColor"');
  picked.set(mine, svg);
}
for (const [name, svg] of picked) {
  write(name, svg);
  report.inline.push(name);
}

const header = `/**
 * أيقونات مأخوذة من chatgpt.com — مولَّدة بـ\`tools/icons-from-capture.mjs\`.
 * لا تُحرّرها بيدك. وهي **تتقدّم على** \`icon-map.ts\` في \`Icon\`.
 *
 * المصدر: ${data.url || 'chatgpt.com'}
 * وقت السحب: ${data.at || '—'}
 * من الـsprite: ${report.sprite.length} · مضمَّنة: ${report.inline.length}
 */

export const CAPTURE_ICONS: Record<string, string> = `;
writeFileSync(MAP_FILE, header + JSON.stringify(map, null, 1) + ';\n');

console.log(`\n  رموز الـsprite المتاحة: ${symbols.size}`);
console.log(`  كُتب ${Object.keys(map).length} أيقونة (${report.sprite.length} من الـsprite · ${report.inline.length} مضمَّنة)`);
if (report.missing.length) {
  console.log(`  لم تُوجد (${report.missing.length}):`);
  for (const m of report.missing) console.log('     · ' + m);
}
console.log('');

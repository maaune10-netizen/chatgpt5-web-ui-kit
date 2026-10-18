import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync, unlinkSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REFS = '/home/deploy/refs/chatgpt';

/** أحدث تصدير، أو المسار المعطى كوسيط */
function pickDump() {
  if (process.argv[2]) return resolve(process.argv[2]);
  const files = readdirSync(REFS)
    .filter((f) => /^figma-dump-.*\.json$/.test(f))
    .map((f) => ({ f, t: statSync(join(REFS, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) throw new Error('no dump in ' + REFS);
  return join(REFS, files[0].f);
}

const SRC = pickDump();
console.log('dump: ' + SRC);
const j = JSON.parse(readFileSync(SRC, 'utf8'));

/* ============ 1) شجرة ============ */
const roots = [];
const stack = [];
for (const n of j.nodes) {
  const d = n.depth || 0;
  while (stack.length > d) stack.pop();
  const parent = stack[d - 1] || null;
  n._parent = parent;
  n._children = [];
  if (parent) parent._children.push(n); else roots.push(n);
  stack[d] = n;
}
const byId = {};
for (const n of j.nodes) byId[n.id] = n;

/* ============ 2) الأيقونات: nodeId → ملف ============ */
/*
 * تُكتب في public/ لأنها تُقدَّم ساكنة وتُقرأ وقت التشغيل.
 * ولو كُتبت في src/ لاحتاجت قائمة Vite إلى إعادة بناء بعد كل تسمية جديدة.
 */
const ICON_DIR = join(ROOT, 'public/generated-icons');
/*
 * احذف المحتوى لا المجلد.
 *
 * كان يحذف المجلد وي recreatesه، فتفقد Vite فهرسه للحظة — وخلالها يخدم
 * index.html مكان catalog.json، فيقرأ المتصفح HTML على أنه JSON ويفشل بلا
 * سبب ظاهر. وإبقاء المجلد قائمًا يزيل تلك اللحظة تمامًا.
 */
mkdirSync(ICON_DIR, { recursive: true });
/* المرسوم يدويًا في public/app-icons ولا يمرّ من هنا إطلاقًا */
for (const f of readdirSync(ICON_DIR)) {
  if (f === 'catalog.json') continue;
  unlinkSync(join(ICON_DIR, f));
}

/** يزيل خلفية الإطار والحدود التي يضيفها Figma عند التصدير */
function cleanSvg(svg) {
  return svg
    .replace(/<rect[^>]*fill="white"[^>]*\/>/gi, '')
    .replace(/<rect[^>]*fill="#fff(fff)?"[^>]*\/>/gi, '')
    .replace(/<rect[^>]*stroke-opacity="0?\.\d+"[^>]*\/>/gi, '')
    .replace(/\n\s*\n/g, '\n');
}

const slugify = (s) => String(s || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 40);
const GENERIC = /^(vector|shape|union|path|line|group|rectangle|ellipse|icon|subtract|intersect|exclude|mask|fill)$/;

/*
 * حُذف هذا القبض.
 * كان يمحو كل SVG في المجلد، فيأكل الأيقونات المرسومة يدويًا (pin) —
 * وهي ليست في أي حزمة فلا يمكن تعويضها بالتوليد. والحذف صار في الأعلى
 * مرة واحدة، مع استثناء المرسوم.
 */

const iconOf = {};        // nodeId -> filename (بدون svg)
const seenHash = new Map();
let dupes = 0;

/* خريطة واحدة بمفتاح المصدر: تُملأ من الأداة، أو تُشتقّ من svgs في تصدير قديم */
const iconBySource = {};

/*
 * أداة التصدير هي التي تسمّي الملفات وتبصم محتواها.
 *
 * كان المولّد يشتقّ الأسماء بنفسه، فمرّ الخطأ مرّتين: مرة حين كانت الأسماء
 * رقمية فتجاوزها التخزين، ومرة حين فشلت أيقونة من غير أن يعلم أحد.
 * والأداة تملك الطبقات والأحجام، فهي أولى بالاسم وبالبصمة. ونحن نكتب فقط.
 */
if (j.icons && Object.keys(j.icons).length) {
  for (const [key, rec] of Object.entries(j.icons)) {
    if (!rec || !rec.file) continue;
    /*
     * سجّل كل مفتاح — حتى الذي يشير إلى ملف أيقونة أخرى.
     * المحتوى المتطابق يُكتب مرة واحدة، فيأتي المكرّر بلا svg لكن بملف صالح.
     * وتجاهله كان يُسقط ١٥ أيقونة لمجرد أن شكلها مكرّر.
     */
    if (rec.svg) writeFileSync(join(ICON_DIR, rec.file + '.svg'), cleanSvg(rec.svg));
    iconBySource[key] = rec.file;
    seenHash.set(key, rec.file);
  }
  if (j.meta && j.meta.iconAudit) {
    const a = j.meta.iconAudit;
    console.log('icons: ' + a.resolved + ' of ' + a.vectorsInScope + ' named by the plugin' +
      (a.unresolved.length ? ' | ' + a.unresolved.length + ' UNRESOLVED: ' +
        a.unresolved.map((u) => u.name + '(' + u.key + ')').join(', ') : ' | none unresolved'));
  }
} else {
  /* مسار قديم: تصدير لا يحمل خريطة icons */
  for (const [nodeId, svg] of Object.entries(j.svgs || {})) {
    if (!svg) continue;
    const hash = createHash('sha1').update(svg.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 12);
    if (seenHash.has(hash)) { iconOf[nodeId] = seenHash.get(hash); dupes++; continue; }

    const node = byId[nodeId];
    let base = slugify(node && node.name);
    if (!base || GENERIC.test(base)) base = 'icon';

    /* الاسم يحمل بصمة المحتوى — فلا يمكن أن يخدّم أحد نسخة قديمة */
    const name = base + '-' + hash.slice(0, 8);
    writeFileSync(join(ICON_DIR, name + '.svg'), cleanSvg(svg));
    seenHash.set(hash, name);
    iconOf[nodeId] = name;
  }
}

/*
 * إكمال ما نقص: أي مفتاح مُشتق لم تُسمّه الأداة.
 */
for (const [nodeId, name] of Object.entries(iconOf)) {
  if (!name) continue;
  const key = String(nodeId).split(';').pop();
  if (!iconBySource[key]) iconBySource[key] = name;
}

/* بعض المتجهات بلا SVG مُصدَّر: أعطها اسماً من كتالوج مسبقًا */
let iconFallback = 0;
for (const n of j.nodes) {
  if (!n.vector) continue;
  if (iconOf[n.id]) continue;
  iconOf[n.id] = null;
  iconFallback++;
}

/* خريطة بسيطة: اسم → ملف، لاستخدامها في الكود */
const catalog = {};
for (const [, name] of Object.entries(iconBySource)) {
  if (name) catalog[name] = 'generated-icons/' + name + '.svg';
}
writeFileSync(join(ICON_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2));
writeFileSync('/tmp/icon-map.json', JSON.stringify(iconOf));

console.log('icons:', Object.keys(iconBySource).length, '| files:', Object.keys(catalog).length, '| dupes:', dupes, '| vectors without svg:', iconFallback);

/* ============ 3) سلّم الطباعة (من قسم Typography في نفس الملف) ============ */
/* قِيَم معروفة من التحليل: lh → size */
const SCALE = [
  [15.6, 12], [18.46, 13], [19.74, 14], [24, 16], [27.9, 18], [31.2, 24], [36, 30], [42, 36], [48, 40],
];
function inferSize(h) {
  if (!h) return 14;
  // جرّب أن h يمثّل عددًا صحيحًا من الأسطر من سلّم معروف
  for (let lines = 1; lines <= 8; lines++) {
    const lh = h / lines;
    let bestD = Infinity;
    let bestSize = null;
    for (const [slh, size] of SCALE) {
      const d = Math.abs(slh - lh);
      if (d < bestD) { bestD = d; bestSize = size; }
    }
    if (bestD <= 1.5) return bestSize;
  }
  return Math.max(11, Math.round(h * 0.72));
}

function lineHeightFor(size, h) {
  const s = SCALE.find(([, sz]) => sz === size);
  return s ? s[0] : h;
}

/* ============ 4) بيانات الشاشات ============ */
/*
 * تُكتب في public/ لأنها تُقرأ وقت التشغيل.
 * وحين كانت في src/ كان خادم التطوير يخزّن وحدات JSON، فيبقى على نسخة
 * قديمة بعد كل إعادة توليد — وقد حدث ثلاث مرات، وفي كل مرة بدا الخلل
 * في العارض أو في المولّد.
 */
const OUT = join(ROOT, 'public/screens');
/*
 * لا تمحُ الشاشات المُركّبة.
 * كانت هذه الأسطر تحذف المجلد كاملًا، فتمسح account-menu.json — ثم يبحث
 * الدمج في الفهرس عن ملف لم يعد موجودًا، فيختفي من المنتقي بلا إنذار.
 * والوسم `composed` هو ما يميّز ما كتبته أداة أخرى عمّا نولّده هنا.
 */
mkdirSync(OUT, { recursive: true });
const keepComposed = [];
try {
  const prevIdx = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8'));
  for (const e of prevIdx) {
    if (e.composed && existsSync(join(OUT, e.slug + '.json'))) keepComposed.push(e);
  }
} catch (e) { /* أول تشغيل */ }
for (const f of readdirSync(OUT)) {
  if (!f.endsWith('.json') || f === 'index.json') continue;
  const slug = f.replace(/\.json$/, '');
  if (keepComposed.some((e) => e.slug === slug)) continue;
  unlinkSync(join(OUT, f));
}

/*
 * كل شاشة في قسم «Example Prototype - Dark Mode».
 *
 * ثلاثة معرّفات كانت خاطئة (126:9142 و136:8892 و386:46967 لا وجود لها)،
 * فكانت تُطبع «missing» وتُتخطّى بصمت — ولهذا ظننت الشاشات غائبة عن الملف.
 * والأسماء هنا هي أسماء الطبقات نفسها، فيسهل التحقق منها.
 */
const SCREENS = [
  ['133:6239', 'new-chat-logged-in'],
  ['6:1288', 'new-chat-logged-out'],
  ['152:6699', 'thread-logged-in'],
  ['126:9298', 'thread-citations-logged-in'],
  ['149:17484', 'thread-logged-out'],
  ['6:1101', 'thread-citations-logged-out'],
  ['133:5657', 'temporary-chat'],
  ['133:4503', 'project-page'],
  ['146:14919', 'project-chat'],
  ['100:5759', 'library'],
  ['334:17500', 'gpt-chat'],
  ['334:17503', 'explore-gpts'],
  ['386:48216', 'explore-gpt-details'],
  ['84:6697', 'image-viewer-chat'],
  ['84:6681', 'image-viewer-library'],
  ['324:18961', 'image-viewer-web'],
  ['328:17456', 'thread-response-types'],
  ['328:18370', 'thread-loading-animations'],

  /* النوافذ والقوائم — حالات تفاعلية لا شاشات كاملة */
  ['386:51165', 'search-chats-modal'],
  ['386:51166', 'share-modal'],
  ['386:51167', 'share-modal-compact'],
  ['334:34539', 'overflow-menu'],
  ['334:34542', 'login-modal'],
];

/*
 * الأسماء المساعدة: كل ما عداها اسم طبقة من Figma، والاسم يصل من الملف.
 * وعند التعارض (نافذتان اسمهما Share Modal) يُلحق التمييز في القائمة أعلاه.
 */
const SCREEN_TITLES = {
  'search-chats-modal': 'Search Chats Modal',
  'share-modal': 'Share Modal',
  'share-modal-compact': 'Share Modal — Compact',
  'overflow-menu': 'Overflow Menu',
  'login-modal': 'Login / Upsell Modal',
};

const solid = (fills) => {
  if (!fills || !fills.length) return undefined;
  const f = fills.find((x) => x.t === 'solid' && (x.o === undefined || x.o > 0));
  return f ? { c: f.c, o: f.o } : undefined;
};
const grad = (fills) => {
  if (!fills) return undefined;
  const g = fills.find((x) => x.t === 'gradient');
  if (!g) return undefined;
  const dir = (g.kind || '').includes('LINEAR') ? 'linear' : 'radial';
  return dir + '(' + (g.stops || []).map((s) => s.c + ' ' + Math.round(s.pos * 100) + '%').join(', ') + ')';
};
const hexToRgba = (hexColor, a) => {
  if (!hexColor || a === undefined || a >= 1) return hexColor;
  const h = String(hexColor).replace('#', '');
  if (h.length < 6) return hexColor;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 100) / 100})`;
};

const shadowCss = (fx) => {
  if (!fx || !fx.length) return undefined;
  const parts = [];
  for (const e of fx) {
    if (e.visible === false) continue;
    const a = e.a === undefined ? 1 : e.a;
    const col = e.c ? hexToRgba(e.c, a) : 'rgba(0,0,0,0.2)';
    if (e.type === 'DROP_SHADOW') parts.push(`${e.x}px ${e.y}px ${e.blur}px ${e.spread}px ${col}`);
    else if (e.type === 'INNER_SHADOW') parts.push(`inset ${e.x}px ${e.y}px ${e.blur}px ${e.spread}px ${col}`);
  }
  return parts.length ? parts.join(', ') : undefined;
};

const rgba = hexToRgba;

/*
 * الصور تُكتب ملفات ويُشار إليها بمسار.
 * وحقنها كـdata URL كان سيضخّم بيانات الشاشة بميغابايتات.
 */
const IMG_DIR = join(ROOT, 'public/generated-images');
/* احذف المحتوى لا المجلد — للسبب نفسه في الأيقونات */
mkdirSync(IMG_DIR, { recursive: true });
for (const f of readdirSync(IMG_DIR)) unlinkSync(join(IMG_DIR, f));

const extOf = (url) => {
  const m = /^data:(image\/[a-z+]+);base64,/.exec(url);
  if (!m) return 'png';
  return m[1] === 'image/jpeg' ? 'jpg' : m[1].split('/')[1];
};
const imageUrl = {};
let imageBytes = 0;
for (const [hash, url] of Object.entries(j.images || {})) {
  if (!url) continue;
  const ext = extOf(url);
  const file = String(hash).replace(/[^A-Za-z0-9_-]/g, '') + '.' + ext;
  const b64 = url.slice(url.indexOf(',') + 1);
  writeFileSync(join(IMG_DIR, file), Buffer.from(b64, 'base64'));
  imageUrl[hash] = 'generated-images/' + file;
  imageBytes += Math.floor(b64.length * 0.75);
}
if (Object.keys(imageUrl).length) {
  console.log('images: ' + Object.keys(imageUrl).length + ' written, ' +
    Math.round(imageBytes / 1024) + ' KB');
}

const FILL_OF = { FILL: 'cover', FIT: 'contain', CROP: 'cover', TILE: 'auto' };

const written = [];
for (const [id, slug] of SCREENS) {
  const screen = byId[id];
  if (!screen) { console.log('  missing', id); continue; }
  const R = screen.rect;
  const nodes = [];

  const emit = (n, px, py, depth) => {
    if (n.visible === false) return;
    const r = n.rect || {};
    const o = {
      n: n.name,
      t: n.type,
      d: depth,
      x: Math.round((r.x - px) * 10) / 10,
      y: Math.round((r.y - py) * 10) / 10,
      w: Math.round(r.w * 10) / 10,
      h: Math.round(r.h * 10) / 10,
    };

    const isVector = !!n.vector;
    const hasIcon = isVector && (iconOf[n.id] || iconBySource[String(n.id).split(';').pop()]);
    /*
     * المتجهات ليست مستطيلات: تعبئتها لون الشكل لا خلفية صندوق.
     * فرسمها كمربع مصمت يعطي «مربعات بيضاء» — والأصح ألّا نرسمها
     * حتى تتوفر أيقونتها، مع تسجيلها في تقرير الناقص.
     */
    if (isVector && !hasIcon) {
      o.missingIcon = 1;
    }
    if (n.type !== 'TEXT' && !isVector && !hasIcon) {
      const s = solid(n.fills);
      if (s && s.c) o.bg = rgba(s.c, s.o);
      const g = grad(n.fills);
      if (g) o.bgi = g;
      const im = (n.fills || []).find((f) => f.t === 'image' && f.imageHash && imageUrl[f.imageHash]);
      if (im && !g) {
        o.bgi = `url(${JSON.stringify(imageUrl[im.imageHash])})`;
        o.bgs = FILL_OF[im.scaleMode] || 'cover';
      }
    }

    if (n.strokes && n.strokes.length) {
      const sc = solid(n.strokes);
      if (sc) { o.bd = rgba(sc.c, sc.o); o.bw = n.strokeWeight || 1; }
    }
    if (n.radius !== undefined) {
      o.r = Array.isArray(n.radius)
        ? (n.radius.every((v) => v === n.radius[0]) ? n.radius[0] : n.radius.join(' '))
        : n.radius;
    }
    if (n.effects && n.effects.length) {
      const fx = shadowCss(n.effects);
      if (fx) o.fx = fx;
    }
    if (n.opacity !== undefined && n.opacity < 1) o.op = n.opacity;
    if (n.clips) o.cl = 1;

    if (n.layout) {
      o.lay = n.layout === 'HORIZONTAL' ? 'h' : 'v';
      if (n.gap) o.gap = n.gap;
      if (n.pad && n.pad.some((v) => v)) o.pad = n.pad.map((v) => Math.round(v * 10) / 10);
      if (n.justify) o.jc = n.justify;
      if (n.align) o.ai = n.align;
    }

    if (n.type === 'TEXT') {
      o.tx = n.characters;
      o.ff = n.fontFamily || 'Inter';
      const size = n.size || inferSize(r.h);
      o.fs = size;
      o.fw = n.weight || 400;
      o.lh = n.lineHeightPx || lineHeightFor(size, r.h);
      if (n.letterSpacing) {
        // التصدير القديم لا يحمل الوحدة: القيم الكبيرة نسبة مئوية
        const ls = n.letterSpacing;
        const isPercent = Math.abs(ls) > size * 0.1;
        o.ls = isPercent ? Math.round((size * ls / 100) * 100) / 100 : ls;
      }
      if (n.alignH && n.alignH !== 'LEFT') o.ta = n.alignH === 'CENTER' ? 'c' : 'r';
      /*
       * سلوك الالتفاف من التصميم نفسه.
       * WIDTH_AND_HEIGHT تعني أن الصندوق هو امتداد النص — فلا يلتفّ أبدًا.
       * وإغفالها كان يجعل «Log In» سطرين حين يزيد النص بكسلًا واحدًا
       * عن مقاس Figma (وهو فرق متوقع بين نسخ الخط).
       */
      if (n.autoResize) o.ar = n.autoResize;
      const tc = solid(n.fills);
      if (tc && tc.c) o.color = rgba(tc.c, tc.o);
      o._inferred = !n.size ? 1 : 0;
    }

    if (n.vector) {
      const ic = iconOf[n.id] || iconBySource[String(n.id).split(';').pop()];
      if (ic) o.ic = ic;
    }

    nodes.push(o);
    for (const c of n._children) emit(c, r.x, r.y, depth + 1);
  };

  emit(screen, R.x, R.y, 0);

  writeFileSync(join(OUT, slug + '.json'), JSON.stringify({
    slug,
    name: SCREEN_TITLES[slug] || screen.name,
    w: Math.round(R.w),
    h: Math.round(R.h),
    /* لون خلفية الشاشة من التصميم — لا مثبّتًا في الكود */
    bg: (solid(screen.fills) || {}).c || null,
    nodes,
  }));

  const inferred = nodes.filter((n) => n._inferred).length;
  const missing = nodes.filter((n) => n.missingIcon).length;
  written.push({ id, slug, name: SCREEN_TITLES[slug] || screen.name, nodes: nodes.length, inferred, missing });
}

/*
 * الفهرس يُدمج لا يُستبدل.
 * الشاشات المُركّبة — كقائمة الحساب — تُكتب بأدوات أخرى، وكان المولّد
 * يمحو مُدخلها من الفهرس فيختفي من المنتقي بعد كل إعادة توليد.
 */
const generated = written.map((w) => ({ slug: w.slug, name: w.name, node: w.id, count: w.nodes }));
const generatedSlugs = new Set(generated.map((g) => g.slug));
const extra = keepComposed.filter((e) => !generatedSlugs.has(e.slug));
const index = [...generated, ...extra].sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2));
if (extra.length) console.log('kept ' + extra.length + ' composed screen(s): ' + extra.map((e) => e.slug).join(', '));

console.log('\nscreens:', written.length);
for (const w of written) console.log('  ' + w.slug.padEnd(30) + String(w.nodes).padStart(5) + ' nodes, ' + String(w.inferred).padStart(4) + ' fonts inferred');

/*
 * حارس: أي متجه مرئي بلا أيقونة خلل، لا تفصيل.
 * كان يمرّ صامتًا فيظهر صفّ الأزرار ناقصًا بلا أن يعلم أحد.
 */
const missing = written.reduce((a, w) => a + (w.missing || 0), 0);
if (missing) {
  console.log('\n⚠  ' + missing + ' visible vector(s) have no icon:');
  for (const w of written) if (w.missing) console.log('     ' + w.slug + '  ' + w.missing);
  console.log('   Re-export with plugin v3.7 or newer.');
  process.exitCode = 1;
} else {
  console.log('\nno visible vector is missing an icon');
}

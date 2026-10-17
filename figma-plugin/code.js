/* ===========================================================================
 * Design Dump — v3
 *
 * تصدير شجرة عقد Figma إلى JSON، مع:
 *   • تتبّع مراحل: كل مرحلة باسمها ووقتها المنقضي
 *   • تتبّع أخطاء: رسالة + stack + العقدة + المرحلة، مع الاستمرار بدل الانهيار
 *   • تسامح: عقدة فاشلة لا تُسقط التصدير — تُسجّل ويُكمَل
 *
 * متوافق مع محركات Figma القديمة: بلا flatMap / optional chaining / ??.
 * راجع test/ — الاختبارات تشغّل هذا الملف مقابل محاكي Figma API.
 * ======================================================================== */

var VERSION = 3;
var REVISION = 8;

figma.showUI(__html__, { width: 460, height: 620, title: 'Design Dump v3' });

/* ---------- حالة ---------- */

var startedAt = Date.now();
var stages = [];     // { name, t }
var errors = [];     // { t, step, nodeId, nodeName, message, stack }
var warnings = [];   // { t, step, nodeId, nodeName, message }
var currentStep = 'init';
var cancelled = false;

function elapsed() { return Date.now() - startedAt; }

/**
 * كل الرسائل تُرسل كـ JSON نصي.
 * Figma ترمّز postMessage بطريقتها، وأي Symbol داخل الكائن يُسقط الرسالة
 * بخطأ "cannot unwrap symbol". النص لا يحمل symbols أبدًا — فلا يمكن أن يفشل.
 */
function send(type, payload) {
  var json;
  try {
    json = JSON.stringify(payload);
  } catch (e) {
    json = JSON.stringify({ message: 'JSON.stringify failed: ' + String(e && e.message ? e.message : e) });
  }
  try {
    figma.ui.postMessage({ type: type, json: json });
  } catch (e) {
    try {
      figma.ui.postMessage({ type: 'fatal', json: JSON.stringify({ message: String(e && e.message ? e.message : e) }) });
    } catch (e2) { /* لا شيء بعد ذلك */ }
  }
}

function mark(name) {
  currentStep = name;
  stages.push({ name: name, t: elapsed() });
  pushStatus();
}

function pushStatus() {
  send('status', {
    version: VERSION,
    step: currentStep,
    elapsed: elapsed(),
    stages: stages,
    errors: errors.length,
    warnings: warnings.length,
    skipped: skipped.length,
    revision: REVISION,
  });
}

function recordError(e, node) {
  var entry = {
    t: elapsed(),
    step: currentStep,
    nodeId: node && node.id ? node.id : null,
    nodeName: node && node.name ? node.name : null,
    message: String(e && e.message ? e.message : e),
    stack: e && e.stack ? String(e.stack).split('\n').slice(0, 4).join(' | ') : null,
  };
  errors.push(entry);
  send('errlog', entry);
  return entry;
}

var skipped = [];   // ليست أخطاء: عقد مخفية أو بلا طبقات ظاهرة

function recordSkip(reason, node) {
  skipped.push({
    t: elapsed(),
    step: currentStep,
    nodeId: node && node.id ? node.id : null,
    nodeName: node && node.name ? node.name : null,
    reason: reason,
  });
}

/**
 * هل العقدة ظاهرة فعلًا؟ نفحص سلسلة الآباء كاملة —
 * لأن عقدة داخل حاوية مخفية تكون visible=true لكنها غير مرئية.
 */
function isVisible(node) {
  var n = node;
  var guard = 0;
  while (n && n.type !== 'PAGE' && guard++ < 200) {
    if (n.visible === false) return false;
    n = n.parent;
  }
  return true;
}

/**
 * مفتاح المصدر: نسخ المكوّنات تحمل معرّفًا مركّبًا مثل
 * "I386:51166;126:9872;3:311" — الجزء الأخير "3:311" هو العقدة الأساسية.
 * فكل نسخ نفس الأيقونة تتشارك المفتاح نفسه، ونصدّرها مرة واحدة.
 */
function sourceKey(node) {
  var id = node && node.id ? String(node.id) : '';
  var parts = id.split(';');
  return parts[parts.length - 1];
}

/**
 * بصمة محتوى — بلا مكتبات تشفير، فمحرّم الإضافة لا يوفّرها.
 * FNV-1a مزدوجة: ٤٨ بت تكفي ٢٥٨ أيقونة بهامش لا يُقاس.
 */
function hashString(s) {
  var h1 = 0x811c9dc5;
  var h2 = 0x01000193;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 2246822519) >>> 0;
  }
  return (h1.toString(16) + h2.toString(16)).slice(0, 12);
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/* أسماء طبقات لا تدلّ على شيء — الأفضل تسمية عامة */
var GENERIC_ICON = /^(vector(-\d+)?|shape|union|path|line|group|rectangle|ellipse|icon|subtract|intersect|exclude|mask|fill|frame|image)$/;

/**
 * أسماء ملفات الأيقونات — تحت مسؤولية الأداة لا المستهلك.
 *
 * كان الاسم رقمًا تسلسليًا، فتغيّر المحتوى تحت الاسم نفسه وبقي المتصفح
 * يعرض القديم. والاسم الآن يحمل بصمة محتواه، فلا يمكن أن يقدّم أحد نسخة
 * قديمة. ولا يبقى على المستهلك إلا الكتابة.
 */
function buildIcons(svgs, index, ids) {
  var icons = {};
  var keyOf = {};
  var order = [];

  for (var i = 0; i < ids.length; i++) {
    var n = index[ids[i]];
    if (!n || typeof n.exportAsync !== 'function') continue;
    if (!isVisible(n)) continue;
    var k = sourceKey(n);
    if (!keyOf[k]) { keyOf[k] = n; order.push(k); }
  }

  var unresolved = [];
  var byHash = {};

  for (var j = 0; j < order.length; j++) {
    var key = order[j];
    var node = keyOf[key];
    var svg = svgs[key];
    if (!svg) { unresolved.push({ key: key, name: node.name, parent: node.parent ? node.parent.name : null }); continue; }

    var hash = hashString(svg);

    /* محتوى واحد ← ملف واحد، وإن اختلفت أسماء الطبقات */
    if (byHash[hash]) { icons[key] = { file: byHash[hash], w: round(node.width) || null, h: round(node.height) || null, dup: true }; continue; }

    var base = slugify(node.name);
    if (!base || GENERIC_ICON.test(base)) base = 'icon';
    var file = base + '-' + hash;
    byHash[hash] = file;

    icons[key] = {
      file: file,
      w: round(node.width) || null,
      h: round(node.height) || null,
      svg: svg,
    };
  }

  return {
    icons: icons,
    audit: {
      vectorsInScope: order.length,
      resolved: Object.keys(icons).length,
      distinct: Object.keys(byHash).length,
      /* العدد الحقيقي منفصل عن القائمة: القائمة تُقتطع للعرض، والعدد لا يُقتطع */
      unresolvedCount: unresolved.length,
      unresolved: unresolved.slice(0, 80),
    },
  };
}

function recordWarning(msg, node) {
  warnings.push({
    t: elapsed(),
    step: currentStep,
    nodeId: node && node.id ? node.id : null,
    nodeName: node && node.name ? node.name : null,
    message: String(msg),
  });
}

/** ينفّذ دالة ويحفظ الخطأ بدل ما يرميه */
function safe(fn, node, fallback) {
  try {
    return fn();
  } catch (e) {
    recordError(e, node);
    return fallback;
  }
}

/* ---------- أدوات ---------- */

function round(n) { return typeof n === 'number' ? Math.round(n * 100) / 100 : n; }
function num(v, d) { return typeof v === 'number' ? v : d; }

function hex(c) {
  if (!c) return '';
  function h(v) { return Math.round(v * 255).toString(16).padStart(2, '0'); }
  return '#' + h(c.r) + h(c.g) + h(c.b);
}

/* ---------- التعبئات ---------- */

function serializePaint(p) {
  if (!p || p.visible === false) return null;
  if (p.type === 'SOLID') {
    var out = { t: 'solid', c: hex(p.color), o: round(num(p.opacity, 1)) };
    if (p.blendMode && p.blendMode !== 'NORMAL') out.blend = p.blendMode;
    return out;
  }
  if (p.type.indexOf('GRADIENT') === 0) {
    var stops = [];
    var gs = p.gradientStops || [];
    for (var i = 0; i < gs.length; i++) {
      stops.push({ pos: round(gs[i].position), c: hex(gs[i].color), a: round(num(gs[i].color && gs[i].color.a, 1)) });
    }
    var handles;
    if (p.gradientHandlePositions) {
      handles = [];
      for (var j = 0; j < p.gradientHandlePositions.length; j++) {
        var hp = p.gradientHandlePositions[j];
        handles.push({ x: round(hp.x), y: round(hp.y) });
      }
    }
    return { t: 'gradient', kind: p.type, o: round(num(p.opacity, 1)), stops: stops, handles: handles };
  }
  if (p.type === 'IMAGE') return { t: 'image', imageHash: p.imageHash || null, scaleMode: p.scaleMode, o: round(num(p.opacity, 1)) };
  return { t: String(p.type).toLowerCase(), o: round(num(p.opacity, 1)) };
}

function paints(arr) {
  if (!arr || !arr.length) return undefined;
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var s = null;
    try { s = serializePaint(arr[i]); } catch (e) { s = null; }
    if (s) out.push(s);
  }
  return out.length ? out : undefined;
}

function effects(arr) {
  if (!arr || !arr.length) return undefined;
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var e = arr[i];
    if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
      out.push({
        type: e.type,
        x: round(num(e.offset && e.offset.x, 0)),
        y: round(num(e.offset && e.offset.y, 0)),
        blur: round(e.radius),
        spread: round(num(e.spread, 0)),
        c: hex(e.color),
        a: round(num(e.color && e.color.a, 1)),
        visible: e.visible !== false,
      });
    } else {
      out.push({ type: e.type, blur: round(e.radius), visible: e.visible !== false });
    }
  }
  return out.length ? out : undefined;
}

/* ---------- عقدة ---------- */

var VECTOR_TYPES = { VECTOR: 1, BOOLEAN_OPERATION: 1, STAR: 1, POLYGON: 1, LINE: 1, ELLIPSE: 1 };

function serialize(n) {
  var o = { id: n.id, name: n.name, type: n.type, visible: n.visible !== false };

  try {
    if (n.type !== 'PAGE' && n.absoluteBoundingBox) {
      var b = n.absoluteBoundingBox;
      o.rect = { x: round(b.x), y: round(b.y), w: round(b.width), h: round(b.height) };
    }
  } catch (e) { recordWarning('absoluteBoundingBox unreadable', n); }

  try {
    if (n.relativeTransform && n.type !== 'PAGE') {
      o.x = round(n.relativeTransform[0][2]);
      o.y = round(n.relativeTransform[1][2]);
    }
  } catch (e) { /* اختياري */ }

  if (typeof n.opacity === 'number' && n.opacity < 1) o.opacity = round(n.opacity);
  if (n.blendMode && n.blendMode !== 'PASS_THROUGH' && n.blendMode !== 'NORMAL') o.blend = n.blendMode;
  if (typeof n.rotation === 'number' && n.rotation !== 0) o.rotation = round(n.rotation);

  if (n.layoutMode && n.layoutMode !== 'NONE') {
    o.layout = n.layoutMode;
    o.gap = round(n.itemSpacing);
    o.pad = [round(n.paddingTop), round(n.paddingRight), round(n.paddingBottom), round(n.paddingLeft)];
    o.justify = n.primaryAxisAlignItems;
    o.align = n.counterAxisAlignItems;
    if (n.primaryAxisSizingMode) o.primarySizing = n.primaryAxisSizingMode;
    if (n.counterAxisSizingMode) o.counterSizing = n.counterAxisSizingMode;
    if (n.layoutWrap && n.layoutWrap !== 'NO_WRAP') o.wrap = n.layoutWrap;
  }

  var f = paints(n.fills); if (f) o.fills = f;
  var st = paints(n.strokes);
  if (st) {
    o.strokes = st;
    o.strokeWeight = round(n.strokeWeight);
    if (n.strokeAlign) o.strokeAlign = n.strokeAlign;
    if (n.dashPattern && n.dashPattern.length) {
      var dp = [];
      for (var d = 0; d < n.dashPattern.length; d++) dp.push(round(n.dashPattern[d]));
      o.dash = dp;
    }
  }

  if (typeof n.cornerRadius === 'number' && n.cornerRadius) o.radius = round(n.cornerRadius);
  else if (n.rectangleCornerRadii) {
    var r = n.rectangleCornerRadii;
    o.radius = [round(r[0]), round(r[1]), round(r[2]), round(r[3])];
  }

  var fx = effects(n.effects);
  if (fx) o.effects = fx;
  if (typeof n.clipsContent === 'boolean') o.clips = n.clipsContent;

  if (n.type === 'TEXT') {
    /*
     * تنبيه: node.style مهجور في Figma الحديث ويعيد undefined.
     * الخصائص الفردية (fontName / fontSize / lineHeight / letterSpacing)
     * هي المصدر الصحيح. نقرأ الاثنين معًا للأمان.
     */
    var st = {};
    try { st = n.style || {}; } catch (e) { st = {}; }

    var fn = null; try { fn = n.fontName || null; } catch (e) { fn = null; }
    var sz = null; try { sz = n.fontSize; } catch (e) { sz = null; }
    var lh = null; try { lh = n.lineHeight; } catch (e) { lh = null; }
    var ls = null; try { ls = n.letterSpacing; } catch (e) { ls = null; }

    o.characters = n.characters;
    o.fontFamily = st.fontFamily || (fn && fn.family) || null;
    o.fontStyle = st.fontStyle || (fn && fn.style) || null;
    o.size = round(st.fontSize !== undefined ? st.fontSize : sz);

    // الوزن من اسم النمط لأن fontWeight مهجور أيضًا
    var weight = st.fontWeight;
    if (weight === undefined && o.fontStyle) {
      var fs = String(o.fontStyle).toLowerCase();
      if (fs.indexOf('black') !== -1 || fs.indexOf('heavy') !== -1) weight = 900;
      else if (fs.indexOf('extra bold') !== -1 || fs.indexOf('extrabold') !== -1) weight = 800;
      else if (fs.indexOf('semi bold') !== -1 || fs.indexOf('semibold') !== -1) weight = 600;
      else if (fs.indexOf('bold') !== -1) weight = 700;
      else if (fs.indexOf('medium') !== -1) weight = 500;
      else if (fs.indexOf('light') !== -1) weight = 300;
      else if (fs.indexOf('thin') !== -1) weight = 100;
      else weight = 400;
    }
    o.weight = weight;

    if (st.lineHeightPx !== undefined) o.lineHeightPx = round(st.lineHeightPx);
    else if (lh && lh.unit === 'PIXELS') o.lineHeightPx = round(lh.value);
    else if (lh && lh.unit === 'PERCENT' && o.size) o.lineHeightPx = round(o.size * lh.value / 100);
    else if (lh && lh.unit === 'AUTO' && o.size) o.lineHeightPx = round(o.size * 1.2);

    if (st.lineHeightPercentFontSize !== undefined) o.lineHeightPercent = round(st.lineHeightPercentFontSize);
    else if (lh && lh.unit === 'PERCENT') o.lineHeightPercent = round(lh.value);

    /*
     * letterSpacing رقم + وحدة (PIXELS أو PERCENT).
     * تصدير الرقم وحده يجعل -4% تُقرأ -4px — فرق ستة أضعاف.
     * نحوّلها دائمًا إلى بكسل.
     */
    if (st.letterSpacing !== undefined) {
      o.letterSpacing = round(st.letterSpacing);
    } else if (ls) {
      var lsUnit = ls.unit || 'PIXELS';
      o.letterSpacing = lsUnit === 'PERCENT' && o.size
        ? round(o.size * ls.value / 100)
        : round(ls.value);
      o.letterSpacingUnit = lsUnit;
    }

    o.alignH = st.textAlignHorizontal || n.textAlignHorizontal;
    o.alignV = st.textAlignVertical || n.textAlignVertical;
    o.autoResize = n.textAutoResize;
    if (st.textDecoration) o.decoration = st.textDecoration;

    // مراجع الأنماط — تربط بمكتبة الطباعة المنشورة
    try { if (n.textStyleId) o.textStyleId = n.textStyleId; } catch (e) {}
    try { if (n.fillStyleId && typeof n.fillStyleId === 'string') o.fillStyleId = n.fillStyleId; } catch (e) {}
  }

  if (VECTOR_TYPES[n.type]) o.vector = true;

  return o;
}

function componentProps(n) {
  if (n.type !== 'INSTANCE') return null;
  try {
    var props = n.componentProperties;
    if (!props) return null;
    var out = {};
    for (var k in props) {
      if (Object.prototype.hasOwnProperty.call(props, k)) out[k] = props[k].value;
    }
    return out;
  } catch (e) {
    recordWarning('componentProperties unreadable', n);
    return null;
  }
}

/* ---------- الاجتياز ---------- */

function childrenOf(node) {
  try {
    if (node && node.children) return node.children;
  } catch (e) {
    recordWarning('children unreadable (page not loaded?)', node);
  }
  return [];
}

function walk(node, depth, out, index) {
  var s = safe(function () { return serialize(node); }, node, null);

  if (s === null) {
    /* عقدة فاشلة: سجّلها بشكل أدنى وأكمل */
    s = { id: node && node.id ? node.id : 'unknown', name: node && node.name ? node.name : '?', type: node && node.type ? node.type : '?', failed: true };
  }
  s.depth = depth;
  out.push(s);
  if (node && node.id) index[node.id] = node;

  var kids = childrenOf(node);
  for (var i = 0; i < kids.length; i++) walk(kids[i], depth + 1, out, index);
}

/* ---------- الصور ---------- */

function base64(bytes) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var out = '';
  for (var i = 0; i < bytes.length; i += 3) {
    var b0 = bytes[i];
    var b1 = bytes[i + 1];
    var b2 = bytes[i + 2];
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4)];
    out += b1 === undefined ? '=' : chars[((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6)];
    out += b2 === undefined ? '=' : chars[b2 & 63];
  }
  return out;
}

/** Figma لا يعيد نوع الصورة — فنستنتجه من بايتاتها الأولى */
function sniffMime(b) {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b.length > 12 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return 'image/png';
}

/**
 * صدّر بايتات الصور المُعبّأة في اللوحة.
 *
 * كان التصدير يحفظ نوع التعبئة فقط («صورة») ويُسقط imageHash، فتُرسم كل
 * الصور فارغة — ٢٨٦ موضعًا، منها صورة نافذة الدخول وأغلفة المكتبة.
 */
function exportImages(flat, onDone) {
  var order = [];
  var seen = {};
  for (var i = 0; i < flat.length; i++) {
    var f = flat[i].fills;
    if (!f) continue;
    for (var j = 0; j < f.length; j++) {
      var h = f[j].imageHash;
      if (f[j].t === 'image' && h && !seen[h]) { seen[h] = 1; order.push(h); }
    }
  }

  var images = {};
  var skipped = [];
  var bytes = 0;
  var at = 0;

  function step() {
    if (cancelled) { onDone(images, skipped, bytes); return; }
    if (at >= order.length) { onDone(images, skipped, bytes); return; }

    var hash = order[at++];
    currentStep = 'Images ' + at + '/' + order.length;
    pushStatus();

    var image = null;
    try { image = figma.getImageByHash(hash); } catch (e) { image = null; }
    if (!image) { skipped.push({ hash: hash, reason: 'not found' }); return step(); }

    image.getBytesAsync()
      .then(function (b) {
        if (b && b.length) {
          var url = 'data:' + sniffMime(b) + ';base64,' + base64(b);
          images[hash] = url;
          bytes += b.length;
        } else {
          skipped.push({ hash: hash, reason: 'empty' });
        }
        step();
      })
      .catch(function (e) {
        skipped.push({ hash: hash, reason: String(e && e.message ? e.message : e).slice(0, 80) });
        step();
      });
  }

  if (!order.length) { onDone(images, skipped, 0); return; }
  step();
}

/* ---------- SVG ---------- */

/**
 * تصدير الأيقونات مرّة واحدة لكل شكل أساسي.
 *
 * الفخّ الذي كلّفنا Copy و Try Again و More Actions: كان مفتاح المصدر
 * يُحجز قبل نجاح التصدير. فإذا فشلت العقدة الأولى حملًا للمفتاح، استُهلكت
 * الأيقونة لكل نسخها في الملف — ١٢٢٣ نسخة من Overflow بلا أيقونة واحدة.
 *
 * فالآن نجمع لكل مفتاح عدّة مرشّحين، ونجرّبهم بالترتيب حتى ينجح أحدهم،
 * ثم نرجع إلى المكوّن الأساسي إن فشل الجميع. والفشل يُسجَّل صراحةً بلا سقف
 * كي لا يختفي في قائمة التخطّي المحدودة بـ٢٠٠.
 */
/**
 * احتياط أخير: ابنِ الأيقونة من مسار المتجه نفسه.
 *
 * `exportAsync` قد يفشل لأسباب لا علاقة لها بالشكل — عقدة داخل نسخة مكوّن،
 * أو طبقة يراها Figma فارغة. لكن `vectorPaths` يظل متاحًا، ويحمل مسار SVG
 * جاهزًا. فهذه الطريق تكفل ظهور الأيقونة بدل أن تختفي.
 */
function svgFromGeometry(node) {
  try {
    var paths = null;
    if (node.vectorPaths && node.vectorPaths.length) paths = node.vectorPaths;
    else if (node.fillGeometry && node.fillGeometry.length) paths = node.fillGeometry;
    if (!paths || !paths.length) return null;

    var d = '';
    var rule = 'nonzero';
    for (var i = 0; i < paths.length; i++) {
      if (!paths[i] || !paths[i].data) continue;
      d += paths[i].data + ' ';
      if (paths[i].windingRule === 'EVENODD') rule = 'evenodd';
    }
    if (!d.replace(/\s/g, '')) return null;

    var w = Math.max(1, round(node.width) || 1);
    var h = Math.max(1, round(node.height) || 1);

    var fill = 'none';
    var op = 1;
    var f = node.fills;
    if (f && f.length) {
      for (var j = 0; j < f.length; j++) {
        if (f[j].visible === false) continue;
        if (f[j].type === 'SOLID' && f[j].color) {
          fill = hex(f[j].color);
          op = typeof f[j].opacity === 'number' ? f[j].opacity : 1;
        }
        break;
      }
    }

    var stroke = '';
    var s = node.strokes;
    if (s && s.length) {
      for (var k = 0; k < s.length; k++) {
        if (s[k].visible === false) continue;
        if (s[k].type === 'SOLID' && s[k].color) {
          stroke = ' stroke="' + hex(s[k].color) + '" stroke-width="' + (num(node.strokeWeight, 1)) +
            '" stroke-linecap="round" stroke-linejoin="round"';
        }
        break;
      }
    }

    if (fill === 'none' && !stroke) return null;

    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
      '" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="' + d.trim() + '" fill="' + fill + '" fill-opacity="' + op +
      '" fill-rule="' + rule + '"' + stroke + '/></svg>';
  } catch (e) {
    return null;
  }
}

function exportVectors(ids, index, onDone) {
  var svgs = {};
  var byKey = {};
  var order = [];
  var fails = [];
  var triedMaster = {};
  var MAX_CANDIDATES = 8;

  for (var i = 0; i < ids.length; i++) {
    var n = index[ids[i]];
    if (!n) continue;
    if (typeof n.exportAsync !== 'function') continue;

    // تخطَّ غير المرئي — بدل ما يفشل ويُسجَّل كخطأ
    if (!isVisible(n)) { recordSkip('hidden', n); continue; }

    var key = sourceKey(n);
    if (!byKey[key]) { byKey[key] = []; order.push(key); }
    if (byKey[key].length < MAX_CANDIDATES) byKey[key].push(n);
  }

  var total = order.length;
  var keyAt = 0;
  var candAt = 0;
  var exported = 0;
  var fallbacks = 0;
  var lastReason = '';
  var startedAt = elapsed();
  var lastPushAt = 0;

  function report(force) {
    if (!force && elapsed() - lastPushAt < 150) return;
    lastPushAt = elapsed();
    var doneMs = elapsed() - startedAt;
    var eta = keyAt > 3 ? Math.round((doneMs / keyAt) * (total - keyAt) / 1000) : null;
    currentStep = 'SVG ' + keyAt + '/' + total + (eta !== null ? ' · ~' + eta + 's left' : '');
    pushStatus();
  }

  function step() {
    if (cancelled) {
      recordWarning('SVG export cancelled — kept ' + exported + ' of ' + total);
      onDone(svgs, exported, fails, fallbacks);
      return;
    }
    if (keyAt >= total) { onDone(svgs, exported, fails, fallbacks); return; }
    report(false);

    var key = order[keyAt];
    var pool = byKey[key];

    /* استُنفد المرشّحون — جرّب المكوّن الأساسي مرّة، ثم اعترف بالفشل */
    if (candAt >= pool.length && !triedMaster[key]) {
      triedMaster[key] = true;
      var master = null;
      try {
        var mc = pool[0] && pool[0].mainComponent;
        if (mc) master = mc;
      } catch (e) { master = null; }
      if (master) pool.push(master);
    }

    if (candAt >= pool.length) {
      var first = pool[0];
      fails.push({
        key: key,
        name: first ? first.name : '?',
        parent: first && first.parent ? first.parent.name : null,
        candidates: pool.length,
        reason: String(lastReason).slice(0, 140),
      });
      keyAt++;
      candAt = 0;
      return step();
    }

    var node = pool[candAt++];
    var nodeId = node.id;

    node.exportAsync({ format: 'SVG', svgOutlineText: true })
      .then(function (bytes) {
        var out = '';
        for (var k = 0; k < bytes.length; k++) out += String.fromCharCode(bytes[k]);
        if (!out || out.indexOf('<svg') === -1) { lastReason = 'empty svg'; return step(); }
        svgs[key] = out;
        exported++;
        keyAt++;
        candAt = 0;
        step();
      })
      .catch(function (e) {
        lastReason = String(e && e.message ? e.message : e);
        if (lastReason.indexOf('visible') === -1 && lastReason.indexOf('export') === -1) {
          recordError(e, node);
        }

        /* التصدير فشل — لكن المسار موجود. ابنِ الأيقونة بنفسك. */
        var fb = svgFromGeometry(node);
        if (fb) {
          svgs[key] = fb;
          fallbacks++;
          exported++;
          keyAt++;
          candAt = 0;
          return step();
        }

        step();
      });
  }

  if (!total) { onDone(svgs, 0, fails, 0); return; }
  step();
}

/* ---------- الاستقبال ---------- */

figma.ui.onmessage = function (msg) {
  if (!msg) return;

  if (msg.type === 'cancel') { cancelled = true; pushStatus(); return; }
  if (msg.type === 'close') { figma.closePlugin(); return; }
  if (msg.type === 'resize') { figma.ui.resize(msg.w, msg.h); return; }

  if (msg.type === 'count') {
    try {
      mark('Reading selection');
      var sel = figma.currentPage.selection || [];
      var n = 0;
      function count(x) {
        n++;
        var kids = childrenOf(x);
        for (var i = 0; i < kids.length; i++) count(kids[i]);
      }
      for (var i = 0; i < sel.length; i++) count(sel[i]);
      send('count', {
        selected: sel.length,
        nodes: n,
        page: figma.currentPage.name,
        api: String(figma.apiVersion || 'unknown'),
        editor: String(figma.editorType || 'unknown'),
        hasLoadAllPages: typeof figma.loadAllPagesAsync === 'function',
        version: VERSION,
      });
    } catch (e) { recordError(e, null); pushStatus(); }
    return;
  }

  /*
   * تصدير الأيقونات وحدها.
   *
   * تسلسل ٤٠ ألف عقدة ليس ما يبطئ — تصدير SVG هو ١٦٤ من ٣٠٠ ثانية.
   * فهذا الوضع يتخطّاه مباشرة ويعيد خريطة الأيقونات فقط، لتُدمج في تصدير
   * سابق بلا إعادة تصدير الملف كله.
   */
  if (msg.type === 'icons') {
    startedAt = Date.now();
    cancelled = false;
    stages = [];
    errors = [];
    warnings = [];
    skipped = [];

    mark('Preparing');

    var doIcons = function () {
      var flat = [];
      var index = {};
      var roots = safe(function () { return figma.root.children; }, null, []) || [];
      for (var r = 0; r < roots.length; r++) walk(roots[r], 0, flat, index);

      var vectorIds = [];
      for (var v = 0; v < flat.length; v++) if (flat[v].vector) vectorIds.push(flat[v].id);

      mark('Preparing ' + vectorIds.length + ' vectors');
      exportVectors(vectorIds, index, function (svgs, exported, fails, fallbacks) {
        var built = buildIcons(svgs, index, vectorIds);
        mark('Exporting images');
        exportImages(flat, function (images, imgSkipped, imgBytes) {
          mark('Exported ' + exported + ' icons · ' + Object.keys(built.icons).length + ' named' +
            (fallbacks ? ' (' + fallbacks + ' from paths)' : '') +
            (Object.keys(images).length ? ' · ' + Object.keys(images).length + ' images' : ''));
          send('icons', {
            iconsOnly: true,
            meta: {
              version: VERSION,
              revision: REVISION,
              exportedAt: new Date().toISOString(),
              elapsedMs: elapsed(),
              vectorCount: vectorIds.length,
              svgCount: Object.keys(svgs).length,
              svgFailures: fails || [],
              svgFallbacks: fallbacks || 0,
              iconAudit: built.audit,
              imageCount: Object.keys(images).length,
              imageBytes: imgBytes || 0,
              imageSkipped: imgSkipped || [],
            },
            icons: built.icons,
            svgs: svgs,
            images: images,
          });
        });
      });
    };

    if (typeof figma.loadAllPagesAsync === 'function') {
      figma.loadAllPagesAsync().then(doIcons, function (e) { recordError(e, null); doIcons(); });
    } else {
      doIcons();
    }
    return;
  }

  if (msg.type === 'dump') {
    startedAt = Date.now();
    cancelled = false;
    stages = [];
    errors = [];
    warnings = [];
    skipped = [];

    (function () {
      var roots;

      mark('Preparing');

      if (msg.scope === 'all') {
        if (typeof figma.loadAllPagesAsync === 'function') {
          mark('Loading all pages');
          return figma.loadAllPagesAsync().then(afterLoad, function (e) {
            recordError(e, null);
            return afterLoad();
          });
        }
        recordWarning('loadAllPagesAsync unavailable — reading pages directly');
        return Promise.resolve().then(afterLoad);
      }

      return Promise.resolve().then(function () {
        roots = safe(function () { return (figma.currentPage.selection || []).slice(); }, null, []);
        return afterRoots();
      });

      function afterLoad() {
        mark('Reading pages');
        roots = [];
        var pages = safe(function () { return figma.root.children || []; }, null, []);
        for (var p = 0; p < pages.length; p++) {
          var kids = childrenOf(pages[p]);
          for (var k = 0; k < kids.length; k++) roots.push(kids[k]);
        }
        return afterRoots();
      }

      function afterRoots() {
        if (!roots.length) {
          throw new Error('Nothing to export — nothing is selected.');
        }

        mark('Walking ' + roots.length + ' root node(s)');
        var flat = [];
        var index = {};
        for (var i = 0; i < roots.length; i++) {
          walk(roots[i], 0, flat, index);
          if (i % 3 === 0) {
            currentStep = 'Walking ' + (i + 1) + '/' + roots.length + ' (' + flat.length + ' nodes)';
            pushStatus();
          }
        }

        mark('Reading component properties');
        for (var j = 0; j < flat.length; j++) {
          var real = index[flat[j].id];
          if (real) {
            var props = componentProps(real);
            if (props) flat[j].props = props;
          }
        }

        var vectorIds = [];
        var uniqueKeys = {};
        var uniqueCount = 0;
        for (var v = 0; v < flat.length; v++) {
          if (!flat[v].vector) continue;
          vectorIds.push(flat[v].id);
          var real = index[flat[v].id];
          if (real && isVisible(real)) {
            var kk = sourceKey(real);
            if (!uniqueKeys[kk]) { uniqueKeys[kk] = 1; uniqueCount++; }
          }
        }

        function finish(svgs, svgFails, fallbacks) {
          /* بايتات الصور تُصدَّر بعد الأيقونات — فهي متسلسلة أيضًا */
          mark('Exporting images');
          exportImages(flat, function (images, imgSkipped, imgBytes) {
            packageAll(svgs, svgFails, fallbacks, images, imgSkipped, imgBytes);
          });
        }

        function packageAll(svgs, svgFails, fallbacks, images, imgSkipped, imgBytes) {
          mark('Packaging');
          var built = svgs ? buildIcons(svgs, index, vectorIds) : { icons: {}, audit: null };
          var payload = {
            meta: {
              version: VERSION,
              file: figma.root.name,
              page: figma.currentPage.name,
              scope: msg.scope,
              exportedAt: new Date().toISOString(),
              elapsedMs: elapsed(),
              nodeCount: flat.length,
              vectorCount: vectorIds.length,
              svgCount: svgs ? Object.keys(svgs).length : 0,
              errorCount: errors.length,
              warningCount: warnings.length,
              skippedCount: skipped.length,
              uniqueVectorCount: uniqueCount,
              svgFailures: svgFails || [],
              svgFallbacks: fallbacks || 0,
              iconCount: Object.keys(built.icons).length,
              imageCount: Object.keys(images).length,
              imageBytes: imgBytes || 0,
              imageSkipped: imgSkipped || [],
              iconAudit: built.audit,
              revision: REVISION,
              api: figma.apiVersion || 'unknown',
              editor: figma.editorType || 'unknown',
            },
            nodes: flat,
            icons: built.icons,
            svgs: svgs,
            images: images,
            diagnostics: { stages: stages, errors: errors, warnings: warnings, skipped: skipped.slice(0, 200) },
          };
          mark('Done');
          // ملخّص الخطوط — للتأكد من قراءتها
          var fontSummary = {};
          for (var fi = 0; fi < flat.length; fi++) {
            var fn2 = flat[fi].fontFamily;
            if (!fn2) continue;
            var k2 = fn2 + ' ' + flat[fi].size + '/' + flat[fi].weight + ' lh=' + flat[fi].lineHeightPx + ' ls=' + flat[fi].letterSpacing;
            fontSummary[k2] = (fontSummary[k2] || 0) + 1;
          }
          payload.meta.fonts = Object.keys(fontSummary).sort(function (a, b) { return fontSummary[b] - fontSummary[a]; }).slice(0, 40);
          payload.meta.fontsMissing = 0;
          for (var mi = 0; mi < flat.length; mi++) if (flat[mi].type === 'TEXT' && !flat[mi].fontFamily) payload.meta.fontsMissing++;

          send('done', payload);
        }

        if (msg.includeSvg && vectorIds.length) {
          mark('Preparing ' + vectorIds.length + ' vectors (deduping)');
          return exportVectors(vectorIds, index, function (svgs, exported, svgFails, fallbacks) {
            mark('Exported ' + exported + ' unique SVGs' + (fallbacks ? ' (' + fallbacks + ' from paths)' : ''));
            finish(svgs, svgFails, fallbacks);
          });
        }
        return finish(undefined);
      }
    })().catch(function (e) {
      recordError(e, null);
      mark('Failed');
      send('failed', { errors: errors, stages: stages });
    });
  }
};

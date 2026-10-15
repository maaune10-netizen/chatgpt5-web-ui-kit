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

figma.showUI(__html__, { width: 460, height: 620, title: 'Design Dump v3' });

/* ---------- حالة ---------- */

var startedAt = Date.now();
var stages = [];     // { name, t }
var errors = [];     // { t, step, nodeId, nodeName, message, stack }
var warnings = [];   // { t, step, nodeId, nodeName, message }
var currentStep = 'init';

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
  if (p.type === 'IMAGE') return { t: 'image', scaleMode: p.scaleMode, o: round(num(p.opacity, 1)) };
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
    var s = n.style || {};
    o.characters = n.characters;
    o.fontFamily = s.fontFamily;
    o.fontStyle = s.fontStyle;
    o.size = round(s.fontSize);
    o.weight = s.fontWeight;
    o.lineHeightPx = round(s.lineHeightPx);
    o.lineHeightPercent = round(s.lineHeightPercentFontSize);
    o.letterSpacing = round(s.letterSpacing);
    o.alignH = s.textAlignHorizontal;
    o.alignV = s.textAlignVertical;
    o.autoResize = n.textAutoResize;
    if (s.textDecoration) o.decoration = s.textDecoration;
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

/* ---------- SVG ---------- */

function exportVectors(ids, index) {
  return new Promise(function (resolve) {
    var svgs = {};
    var list = [];
    for (var i = 0; i < ids.length; i++) {
      var n = index[ids[i]];
      if (n && typeof n.exportAsync === 'function') list.push(n);
    }
    if (!list.length) { resolve(svgs); return; }

    var at = 0;
    var lastPush = 0;
    function next() {
      if (at >= list.length) { resolve(svgs); return; }
      var n = list[at++];
      if (elapsed() - lastPush > 120 || at === list.length) {
        lastPush = elapsed();
        currentStep = 'Exporting SVG ' + at + '/' + list.length;
        pushStatus();
      }
      n.exportAsync({ format: 'SVG', svgOutlineText: true })
        .then(function (bytes) {
          var s = '';
          for (var k = 0; k < bytes.length; k++) s += String.fromCharCode(bytes[k]);
          svgs[n.id] = s;
          next();
        })
        .catch(function (e) {
          svgs[n.id] = null;
          recordError(e, n);
          next();
        });
    }
    next();
  });
}

/* ---------- الاستقبال ---------- */

figma.ui.onmessage = function (msg) {
  if (!msg) return;

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

  if (msg.type === 'dump') {
    startedAt = Date.now();
    stages = [];
    errors = [];
    warnings = [];

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
        for (var v = 0; v < flat.length; v++) if (flat[v].vector) vectorIds.push(flat[v].id);

        function finish(svgs) {
          mark('Packaging');
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
              api: figma.apiVersion || 'unknown',
              editor: figma.editorType || 'unknown',
            },
            nodes: flat,
            svgs: svgs,
            diagnostics: { stages: stages, errors: errors, warnings: warnings },
          };
          mark('Done');
          send('done', payload);
        }

        if (msg.includeSvg && vectorIds.length) {
          mark('Exporting ' + vectorIds.length + ' SVG');
          return exportVectors(vectorIds, index).then(finish);
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

/* ===========================================================================
 * Design Dump — Figma plugin
 *
 * يصدّر شجرة العقد كاملة إلى JSON: الإحداثيات، auto-layout، الحشو، الفجوات،
 * التعبئات (مع الشفافية)، التدرّجات، الحدود، أنصاف الأقطار، الظلال، النصوص
 * بخطوطها، والمكوّنات. ويصدّر SVG لكل متجه.
 *
 * مكتوب بأسلوب متوافق مع أقدم محركات Figma:
 *  - بلا flatMap / optional chaining / nullish coalescing
 *  - كل واجهة خطرة محميّة بـ try/catch
 *  - كل مرحلة ترسل تقدّمًا باسمها، فأي خطأ يقول أين حدث
 * ======================================================================== */

figma.showUI(__html__, { width: 420, height: 480, title: 'Design Dump' });

var STEP = 'init';

function report(step) {
  STEP = step;
  figma.ui.postMessage({ type: 'progress', message: step });
}

function fail(e) {
  figma.ui.postMessage({
    type: 'error',
    message: '[' + STEP + '] ' + String(e && e.message ? e.message : e),
  });
}

/* ---------- أدوات ---------- */

function round(n) {
  return typeof n === 'number' ? Math.round(n * 100) / 100 : n;
}

function hex(c) {
  if (!c) return '';
  function h(v) { return Math.round(v * 255).toString(16).padStart(2, '0'); }
  return '#' + h(c.r) + h(c.g) + h(c.b);
}

function num(v, fallback) {
  return typeof v === 'number' ? v : fallback;
}

/* ---------- التعبئات ---------- */

function serializePaint(p) {
  if (!p || p.visible === false) return null;
  try {
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
  } catch (e) {
    return null;
  }
}

function paints(arr) {
  if (!arr || !arr.length) return undefined;
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var s = serializePaint(arr[i]);
    if (s) out.push(s);
  }
  return out.length ? out : undefined;
}

/* ---------- الظلال ---------- */

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

/* ---------- عقدة واحدة ---------- */

function serialize(n) {
  var o = { id: n.id, name: n.name, type: n.type, visible: n.visible !== false };

  try {
    if (n.type !== 'PAGE' && n.absoluteBoundingBox) {
      var b = n.absoluteBoundingBox;
      o.rect = { x: round(b.x), y: round(b.y), w: round(b.width), h: round(b.height) };
    }
  } catch (e) { /* تُتجاهل */ }

  try {
    if (n.relativeTransform && n.type !== 'PAGE') {
      o.x = round(n.relativeTransform[0][2]);
      o.y = round(n.relativeTransform[1][2]);
    }
  } catch (e) { /* تُتجاهل */ }

  if (typeof n.opacity === 'number' && n.opacity < 1) o.opacity = round(n.opacity);
  if (n.blendMode && n.blendMode !== 'PASS_THROUGH' && n.blendMode !== 'NORMAL') o.blend = n.blendMode;
  if (typeof n.rotation === 'number' && n.rotation !== 0) o.rotation = round(n.rotation);

  /* auto-layout */
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

  /* الشكل */
  try {
    var f = paints(n.fills);
    if (f) o.fills = f;
  } catch (e) { /* تُتجاهل */ }

  try {
    var st = paints(n.strokes);
    if (st) {
      o.strokes = st;
      o.strokeWeight = round(n.strokeWeight);
      if (n.strokeAlign) o.strokeAlign = n.strokeAlign;
      if (n.dashPattern && n.dashPattern.length) o.dash = n.dashPattern;
    }
  } catch (e) { /* تُتجاهل */ }

  if (typeof n.cornerRadius === 'number' && n.cornerRadius) o.radius = round(n.cornerRadius);
  else if (n.rectangleCornerRadii) o.radius = [round(n.rectangleCornerRadii[0]), round(n.rectangleCornerRadii[1]), round(n.rectangleCornerRadii[2]), round(n.rectangleCornerRadii[3])];

  var fx = effects(n.effects);
  if (fx) o.effects = fx;
  if (typeof n.clipsContent === 'boolean') o.clips = n.clipsContent;

  /* النص */
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

  /* المتجهات — علامة للتصدير لاحقًا */
  if (n.type === 'VECTOR' || n.type === 'BOOLEAN_OPERATION' || n.type === 'STAR' || n.type === 'POLYGON' || n.type === 'LINE') {
    o.vector = true;
  }

  return o;
}

/* ---------- المكوّنات (منفصلة لأنها تحتاج async في dynamic-page) ---------- */

function componentInfo(n) {
  var info = {};
  try {
    if (n.type === 'INSTANCE') {
      var props = n.componentProperties;
      if (props) {
        info.props = {};
        for (var k in props) {
          if (Object.prototype.hasOwnProperty.call(props, k)) info.props[k] = props[k].value;
        }
      }
    }
  } catch (e) { /* تُتجاهل */ }
  return info;
}

/* ---------- الاجتياز ---------- */

function collectChildren(node) {
  try {
    if (node && typeof node.children !== 'undefined' && node.children) return node.children;
  } catch (e) { /* صفحة غير محمّلة */ }
  return [];
}

function walk(node, depth, out, index) {
  var s = serialize(node);
  s.depth = depth;
  index[node.id] = node;
  out.push(s);
  var kids = collectChildren(node);
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
    function next() {
      if (at >= list.length) { resolve(svgs); return; }
      var n = list[at++];
      report('Exporting SVG ' + at + '/' + list.length);
      n.exportAsync({ format: 'SVG', svgOutlineText: true })
        .then(function (bytes) {
          var s = '';
          for (var k = 0; k < bytes.length; k++) s += String.fromCharCode(bytes[k]);
          svgs[n.id] = s;
          next();
        })
        .catch(function () {
          svgs[n.id] = null;
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
      report('Reading selection');
      var sel = figma.currentPage.selection || [];
      var n = 0;
      function count(x) {
        n++;
        var kids = collectChildren(x);
        for (var i = 0; i < kids.length; i++) count(kids[i]);
      }
      for (var i = 0; i < sel.length; i++) count(sel[i]);
      figma.ui.postMessage({
        type: 'count',
        selected: sel.length,
        nodes: n,
        page: figma.currentPage.name,
        api: figma.apiVersion || 'unknown',
        editor: figma.editorType || 'unknown',
        hasLoadAllPages: typeof figma.loadAllPagesAsync === 'function',
      });
    } catch (e) { fail(e); }
    return;
  }

  if (msg.type === 'dump') {
    /* كل شيء داخل دالة async واحدة، ومعالجة الأخطاء بأسماء المراحل */
    (function () {
      var roots;

      report('Preparing');
      if (msg.scope === 'all') {
        var load = figma.loadAllPagesAsync;
        if (typeof load === 'function') {
          report('Loading all pages');
          return load.call(figma).then(afterLoad, function () { return afterLoad(); });
        }
        return Promise.resolve().then(afterLoad);
      }
      return Promise.resolve().then(function () {
        roots = (figma.currentPage.selection || []).slice();
        return afterRoots();
      });

      function afterLoad() {
        report('Reading pages');
        roots = [];
        var pages = figma.root.children || [];
        for (var p = 0; p < pages.length; p++) {
          var kids = collectChildren(pages[p]);
          for (var k = 0; k < kids.length; k++) roots.push(kids[k]);
        }
        return afterRoots();
      }

      function afterRoots() {
        if (!roots.length) throw new Error('Nothing to export — nothing is selected.');

        report('Walking ' + roots.length + ' root node(s)');
        var flat = [];
        var index = {};
        for (var i = 0; i < roots.length; i++) walk(roots[i], 0, flat, index);

        report('Serializing ' + flat.length + ' nodes');

        /* أضف معلومات المكوّنات */
        for (var j = 0; j < flat.length; j++) {
          var real = index[flat[j].id];
          if (real) {
            var ci = componentInfo(real);
            if (ci.props) flat[j].props = ci.props;
          }
        }

        var vectorIds = [];
        for (var v = 0; v < flat.length; v++) if (flat[v].vector) vectorIds.push(flat[v].id);

        function finish(svgs) {
          report('Packaging');
          var payload = {
            meta: {
              file: figma.root.name,
              page: figma.currentPage.name,
              scope: msg.scope,
              exportedAt: new Date().toISOString(),
              nodeCount: flat.length,
              vectorCount: vectorIds.length,
              svgCount: svgs ? Object.keys(svgs).length : 0,
              api: figma.apiVersion || 'unknown',
              editor: figma.editorType || 'unknown',
            },
            nodes: flat,
            svgs: svgs,
          };
          figma.ui.postMessage({ type: 'done', payload: payload });
        }

        if (msg.includeSvg && vectorIds.length) {
          return exportVectors(vectorIds, index).then(finish);
        }
        return finish(undefined);
      }
    })().catch(fail);
  }
};

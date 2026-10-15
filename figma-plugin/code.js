/* ===========================================================================
 * Design Dump — Figma plugin
 *
 * يصدّر شجرة العقد كاملة إلى JSON، مع كل ما يحتاجه التحويل إلى كود:
 * الإحداثيات، auto-layout، الحشو، الفجوات، التعبئات (مع الشفافية)، الحدود،
 * أنصاف الأقطار، الظلال، نصوص الخطوط، والمكوّنات.
 *
 * ويعرض تصدير SVG للمسارات المتجهة (الأيقونات) — اختياريًا.
 *
 * لا يستخدم أي شبكة: كل شيء يحدث داخل Figma.
 * ======================================================================== */

figma.showUI(__html__, { width: 420, height: 460, title: 'Design Dump' });

const round = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : n);

/* ---------- الألوان والتعبئات ---------- */

function hex(c) {
  if (!c) return '';
  const h = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + h(c.r) + h(c.g) + h(c.b);
}

function serializePaint(p) {
  if (!p || p.visible === false) return null;
  if (p.type === 'SOLID') {
    const out = { t: 'solid', c: hex(p.color), o: round(p.opacity ?? 1) };
    if (p.blendMode && p.blendMode !== 'NORMAL') out.blend = p.blendMode;
    return out;
  }
  if (p.type.startsWith('GRADIENT')) {
    return {
      t: 'gradient',
      kind: p.type,
      o: round(p.opacity ?? 1),
      stops: (p.gradientStops || []).map((s) => ({ pos: round(s.position), c: hex(s.color), a: round(s.color.a ?? 1) })),
      handles: p.gradientHandlePositions ? p.gradientHandlePositions.map((h) => ({ x: round(h.x), y: round(h.y) })) : undefined,
    };
  }
  if (p.type === 'IMAGE') return { t: 'image', scaleMode: p.scaleMode, o: round(p.opacity ?? 1) };
  return { t: p.type.toLowerCase(), o: round(p.opacity ?? 1) };
}

const paints = (arr) => {
  const out = (arr || []).map(serializePaint).filter(Boolean);
  return out.length ? out : undefined;
};

/* ---------- الظلال ---------- */

const effects = (arr) => {
  const out = (arr || []).map((e) => {
    if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
      return {
        type: e.type,
        x: round(e.offset?.x ?? 0),
        y: round(e.offset?.y ?? 0),
        blur: round(e.radius),
        spread: round(e.spread ?? 0),
        c: hex(e.color),
        a: round(e.color?.a ?? 1),
        visible: e.visible !== false,
      };
    }
    return { type: e.type, blur: round(e.radius), visible: e.visible !== false };
  });
  return out.length ? out : undefined;
};

/* ---------- النصوص ---------- */

function textInfo(n) {
  const s = n.style || {};
  return {
    characters: n.characters,
    font: s.fontFamily ? `${s.fontFamily} ${s.fontStyle || ''}`.trim() : undefined,
    fontFamily: s.fontFamily,
    fontStyle: s.fontStyle,
    size: round(s.fontSize),
    weight: s.fontWeight,
    lineHeightPx: round(s.lineHeightPx),
    lineHeightPercent: round(s.lineHeightPercentFontSize),
    letterSpacing: round(s.letterSpacing),
    alignH: s.textAlignHorizontal,
    alignV: s.textAlignVertical,
    autoResize: n.textAutoResize,
    decoration: s.textDecoration,
  };
}

/* ---------- عقدة واحدة ---------- */

function serialize(n) {
  const o = {
    id: n.id,
    name: n.name,
    type: n.type,
    visible: n.visible !== false,
  };

  if (n.type !== 'PAGE' && n.absoluteBoundingBox) {
    const b = n.absoluteBoundingBox;
    o.rect = { x: round(b.x), y: round(b.y), w: round(b.width), h: round(b.height) };
  }
  if (n.relativeTransform && n.type !== 'PAGE') {
    o.x = round(n.relativeTransform[0][2]);
    o.y = round(n.relativeTransform[1][2]);
  }
  if (typeof n.opacity === 'number' && n.opacity < 1) o.opacity = round(n.opacity);
  if (n.blendMode && n.blendMode !== 'PASS_THROUGH' && n.blendMode !== 'NORMAL') o.blend = n.blendMode;
  if (typeof n.rotation === 'number' && n.rotation !== 0) o.rotation = round(n.rotation);

  // auto-layout
  if (n.layoutMode && n.layoutMode !== 'NONE') {
    o.layout = n.layoutMode;
    o.gap = round(n.itemSpacing);
    o.pad = [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft].map(round);
    o.justify = n.primaryAxisAlignItems;
    o.align = n.counterAxisAlignItems;
    if (n.primaryAxisSizingMode) o.primarySizing = n.primaryAxisSizingMode;
    if (n.counterAxisSizingMode) o.counterSizing = n.counterAxisSizingMode;
    if (n.layoutWrap && n.layoutWrap !== 'NO_WRAP') o.wrap = n.layoutWrap;
  }

  // الشكل
  const f = paints(n.fills);
  if (f) o.fills = f;
  const st = paints(n.strokes);
  if (st) {
    o.strokes = st;
    o.strokeWeight = round(n.strokeWeight);
    if (n.strokeAlign) o.strokeAlign = n.strokeAlign;
    if (n.dashPattern && n.dashPattern.length) o.dash = n.dashPattern;
  }
  if (typeof n.cornerRadius === 'number' && n.cornerRadius) o.radius = round(n.cornerRadius);
  else if (n.rectangleCornerRadii) o.radius = n.rectangleCornerRadii.map(round);

  const fx = effects(n.effects);
  if (fx) o.effects = fx;
  if (typeof n.clipsContent === 'boolean') o.clips = n.clipsContent;

  // النص
  if (n.type === 'TEXT') Object.assign(o, textInfo(n));

  // المكوّنات
  if (n.type === 'INSTANCE' && n.mainComponent) {
    o.mainComponent = { id: n.mainComponent.id, name: n.mainComponent.name };
    const props = n.componentProperties;
    if (props) {
      o.props = {};
      for (const k in props) o.props[k] = props[k].value;
    }
  }
  if (n.type === 'COMPONENT_SET') o.componentSet = true;

  if (n.type === 'VECTOR' || n.type === 'BOOLEAN_OPERATION' || n.type === 'STAR' || n.type === 'POLYGON') {
    o.vector = true;
  }

  return o;
}

/* ---------- اجتياز الشجرة ---------- */

function walk(node, depth, out) {
  out.push({ ...serialize(node), depth });
  if ('children' in node) for (const c of node.children) walk(c, depth + 1, out);
}

/* ---------- تصدير SVG للمتجهات ---------- */

async function exportVectors(nodes, onProgress) {
  const vectors = nodes.filter((n) => n.vector);
  const out = {};
  let done = 0;
  for (const v of vectors) {
    try {
      const svg = await v.exportAsync({ format: 'SVG', svgOutlineText: true, svgIdAttribute: false });
      out[v.id] = String.fromCharCode.apply(null, svg);
    } catch (e) {
      out[v.id] = null;
    }
    done++;
    if (done % 10 === 0 || done === vectors.length) onProgress(done, vectors.length);
  }
  return out;
}

/* ---------- الاستقبال ---------- */

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'count') {
      const sel = figma.currentPage.selection;
      let n = 0;
      const count = (x) => { n++; if ('children' in x) x.children.forEach(count); };
      sel.forEach(count);
      figma.ui.postMessage({ type: 'count', selected: sel.length, nodes: n, page: figma.currentPage.name });
      return;
    }

    if (msg.type === 'dump') {
      const roots = msg.scope === 'all'
        ? figma.root.children.flatMap((p) => p.children)
        : figma.currentPage.selection;

      if (!roots.length) {
        figma.ui.postMessage({ type: 'error', message: 'Nothing selected.' });
        return;
      }

      const flat = [];
      for (const r of roots) walk(r, 0, flat);

      // كل العقد الفعلية (المتجهات تحتاج المرجع الأصلي)
      const byId = new Map();
      const index = (x) => { byId.set(x.id, x); if ('children' in x) x.children.forEach(index); };
      for (const r of roots) index(r);

      let svgs;
      if (msg.includeSvg) {
        figma.ui.postMessage({ type: 'progress', message: 'Exporting vectors…' });
        svgs = await exportVectors(flat.map((n) => byId.get(n.id)).filter(Boolean), (d, t) => {
          figma.ui.postMessage({ type: 'progress', message: `SVG ${d}/${t}` });
        });
      }

      const payload = {
        meta: {
          file: figma.root.name,
          page: figma.currentPage.name,
          scope: msg.scope,
          exportedAt: new Date().toISOString(),
          nodeCount: flat.length,
          svgCount: svgs ? Object.keys(svgs).length : 0,
        },
        nodes: flat,
        svgs,
      };

      figma.ui.postMessage({ type: 'done', payload });
      return;
    }

    if (msg.type === 'close') figma.closePlugin();
    if (msg.type === 'resize') figma.ui.resize(msg.w, msg.h);
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: String(e && e.message ? e.message : e) });
  }
};

/**
 * Blueprint — مخطط كامل لأي جزء من الصفحة.
 *
 *   الصق في Console على chatgpt.com، ثم:
 *     • تلقائيًّا: يلتقط **الشريط الجانبي** ويُنزّل `blueprint.json`.
 *     • أو لعنصر تختاره:  `__blueprint($0)`  — بعد تحديده في Inspector.
 *
 * ويُخرج **أربع طرق للنظر إلى الشيء نفسه**، لأنّ كلًّا منها يكشف ما لا يكشفه الآخر:
 *
 *   ١) `tree`  — الشجرة كما هي: كل عنصر وأبناؤه، بترتيبهم وأعماقهم.
 *   ٢) `texts` — كل نصّ ظاهر: كلمته، خطّه، لونه، وصندوقه. (‏Pinned · Projects · Recents)
 *   ٣) `icons` — كل أيقونة: صندوقها، و`viewBox`، ونصّها (أو مرجع الـsprite).
 *   ٤) `rows`  — العناصر المتكرّرة: مجموعات إخوة لها نفس المقاس — أي «الصفوف».
 *
 * ولكل عنصر في الأربعة: الصندوق (نسبيًّا للجذر ومطلقًا) · الخطّ · الألوان ·
 * المسافات **لكل جهة** · والتخطيط (flex/grid/position).
 *
 * ولا يحتاج مكتبة، ولا يرسل شيئًا: يُنزّل ملفًّا عندك فقط.
 */
(async () => {
  const MAX_NODES = 2500;

  const px = (v) => (v === 'normal' ? null : v);
  const sides = (cs, p) => [cs[p + 'Top'], cs[p + 'Right'], cs[p + 'Bottom'], cs[p + 'Left']];

  const styleOf = (cs) => ({
    font: {
      family: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      size: cs.fontSize,
      weight: cs.fontWeight,
      style: cs.fontStyle,
      lineHeight: cs.lineHeight,
      letterSpacing: px(cs.letterSpacing),
      align: cs.textAlign,
      transform: cs.textTransform,
      whiteSpace: cs.whiteSpace,
      overflow: cs.textOverflow,
    },
    color: {
      text: cs.color,
      bg: cs.backgroundColor,
      bgImage: cs.backgroundImage === 'none' ? null : cs.backgroundImage,
      border: cs.borderTopColor,
      opacity: cs.opacity,
    },
    space: {
      pad: sides(cs, 'padding'),
      margin: sides(cs, 'margin'),
      gap: px(cs.gap),
      rowGap: px(cs.rowGap),
      radius: cs.borderRadius,
      borderWidth: sides(cs, 'border').map((v) => v),
      borderStyle: cs.borderTopStyle,
      shadow: cs.boxShadow === 'none' ? null : cs.boxShadow,
    },
    layout: {
      display: cs.display,
      position: cs.position,
      flexDirection: cs.flexDirection,
      flexWrap: cs.flexWrap,
      alignItems: cs.alignItems,
      justifyContent: cs.justifyContent,
      gridTemplateColumns: cs.gridTemplateColumns === 'none' ? null : cs.gridTemplateColumns,
      overflowX: cs.overflowX,
      overflowY: cs.overflowY,
      zIndex: cs.zIndex === 'auto' ? null : cs.zIndex,
    },
  });

  const boxOf = (el, root) => {
    const r = el.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    return {
      abs: { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) },
      /** نسبيًّا إلى جذر المخطط — هذه هي التي تُبنى منها المسافات */
      rel: { x: +(r.x - b.x).toFixed(2), y: +(r.y - b.y).toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) },
    };
  };

  const ownText = (el) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');

  const pathOf = (el, root) => {
    const parts = [];
    let n = el;
    while (n && n !== root.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += '#' + n.id;
      const cls = (typeof n.className === 'string' ? n.className : '').split(/\s+/).filter((c) => c && !c.includes(':')).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      parts.unshift(s);
      if (n === root) break;
      n = n.parentElement;
    }
    return parts.join(' > ');
  };

  const iconOf = (el) => {
    const svg = el.tagName === 'svg' ? el : el.querySelector('svg');
    if (!svg) {
      /*
       * ليست كل الأيقونات `<svg>`: بعضها `<span>` بقناع CSS
       * (`mask-image: url(…)`) أو `background-image`. وهي التي نستعملها نحن.
       */
      const cs = getComputedStyle(el);
      const mask = cs.maskImage !== 'none' ? cs.maskImage : cs.webkitMaskImage !== 'none' ? cs.webkitMaskImage : null;
      const bg = cs.backgroundImage !== 'none' ? cs.backgroundImage : null;
      const src = mask || bg;
      if (!src) return null;
      const m = /url\("?([^")]+)"?\)/.exec(src);
      if (!m) return null;
      const r = el.getBoundingClientRect();
      return { kind: mask ? 'mask' : 'background', src: m[1], size: { w: +r.width.toFixed(1), h: +r.height.toFixed(1) } };
    }
    const use = svg.querySelector('use');
    const href = use ? use.getAttribute('href') || use.getAttribute('xlink:href') : null;
    const html = svg.outerHTML;
    return {
      viewBox: svg.getAttribute('viewBox'),
      size: { w: +svg.getBoundingClientRect().width.toFixed(1), h: +svg.getBoundingClientRect().height.toFixed(1) },
      spriteRef: href,
      /* النصّ الكامل للأيقونة إن كانت مسارات — وإلا يكفي مرجع الـsprite */
      html: href ? null : html.length < 4000 ? html : null,
      htmlLength: html.length,
    };
  };

  const texts = [];
  const icons = [];
  let count = 0;

  const toNode = (el, root, depth) => {
    if (count >= MAX_NODES) return null;
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    const r = el.getBoundingClientRect();

    count++;
    const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim() || null;
    const own = ownText(el);
    const icon = iconOf(el);
    const box = boxOf(el, root);
    const style = styleOf(cs);

    if (own) texts.push({ depth, tag, text: own.slice(0, 160), box: box.rel, font: style.font, color: style.color, path: pathOf(el, root) });
    if (icon && el.tagName !== 'svg') icons.push({ depth, box: box.rel, ...icon, path: pathOf(el, root) });

    const node = {
      depth,
      path: pathOf(el, root),
      tag,
      role: el.getAttribute('role') || null,
      label,
      text: own || null,
      box,
      style,
      icon,
      children: [],
    };

    for (const child of el.children) {
      const n = toNode(child, root, depth + 1);
      if (n) node.children.push(n);
    }
    return node;
  };

  /** الصفوف: إخوة متطابقون في الوسم والارتفاع — أي «عناصر القائمة» */
  const rows = [];
  const collectRows = (node) => {
    const groups = new Map();
    for (const c of node.children || []) {
      if (c.box.rel.h < 8 || c.box.rel.h > 300) continue;
      const k = `${c.tag}|${Math.round(c.box.rel.h)}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(c);
    }
    for (const [, list] of groups) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => a.box.rel.y - b.box.rel.y);
      /* الفراغ = المسافة بين نهاية صفّ وبداية التالي. والسالب ضجيج حاويات. */
      const gaps = [];
      for (let i = 1; i < sorted.length; i++) {
        const g = +(sorted[i].box.rel.y - (sorted[i - 1].box.rel.y + sorted[i - 1].box.rel.h)).toFixed(2);
        if (g >= 0) gaps.push(g);
      }
      if (!gaps.length) continue;
      const f = sorted[0];
      rows.push({
        count: sorted.length,
        tag: f.tag,
        h: f.box.rel.h,
        w: f.box.rel.w,
        gapBetween: Math.max(...gaps) === Math.min(...gaps) ? gaps[0] : gaps,
        sample: (f.label || f.text || '').slice(0, 50),
        font: f.style.font,
        pad: f.style.space.pad,
        radius: f.style.space.radius,
        bg: f.style.color.bg,
        parentPath: (f.path || '').split(' > ').slice(0, -1).join(' > '),
      });
    }
    for (const c of node.children || []) collectRows(c);
  };

  const run = (root, label) => {
    count = 0;
    texts.length = 0;
    icons.length = 0;
    rows.length = 0;
    const tree = toNode(root, root, 0);
    collectRows(tree);
    const out = {
      what: label,
      url: location.href,
      at: new Date().toISOString(),
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
      theme: document.documentElement.getAttribute('data-theme') || document.documentElement.dataset?.theme || null,
      root: { tag: root.tagName, box: boxOf(root, root), style: styleOf(getComputedStyle(root)) },
      counts: { nodes: count, texts: texts.length, icons: icons.length, rowGroups: rows.length },
      tree,
      texts,
      icons,
      rows,
    };
    const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `blueprint-${label.replace(/[^a-z0-9-]/gi, '')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    console.log(
      `✓ ${a.download} — عناصر ${count} · نصوص ${texts.length} · أيقونات ${icons.length} · مجموعات صفوف ${rows.length}`,
    );
    return out;
  };

  /* كشف الشريط الجانبي: aside، ثم أول عمود طويل ضيّق */
  const detect = () => {
    const aside = document.querySelector('aside');
    if (aside) return [aside, 'sidebar'];
    const nav = document.querySelector('nav');
    if (nav) return [nav, 'nav'];
    const cand = [...document.querySelectorAll('div')].find((d) => {
      const r = d.getBoundingClientRect();
      return r.height > window.innerHeight * 0.8 && r.width > 180 && r.width < 420 && r.x < 40;
    });
    return cand ? [cand, 'sidebar'] : [document.body, 'body'];
  };

  window.__blueprint = (el) => run(el || document.body, 'custom');
  const [root, label] = detect();
  run(root, label);
})();

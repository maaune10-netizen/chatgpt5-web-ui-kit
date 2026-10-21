/**
 * Dump All — كل تفاصيل الصفحة، بلا استثناء.
 *
 *   الصق في Console على chatgpt.com (في الوضع الذي تريد قياسه)، ثم Enter.
 *   يُنزّل `dump-all.json`.
 *
 * ويأخذ **أربعة أنواع** من المعلومات:
 *
 *   ١) `elements` — كل عنصر مرئيّ: صندوقه، خطّه، ألوانه، حشوه، حدّه، ظلّه.
 *   ٢) `palette`  — كل لون في الصفحة، مصنّفًا (نصّ · خلفية · حدّ · أيقونة) مع عدده.
 *   ٣) `tokens`   — **كل متغيّرات CSS** (`--*`) في أوراق الأنماط، بمحدّداتها.
 *   ٤) `stats`    — تكرار أحجام الخطوط، أنصاف الأقطار، الحشو، الفراغ.
 *
 * و`tokens` هي المفتاح: منها تُعرف ألوان الموقع الحقيقية بلا تخمين بكسل.
 *
 * ولا يحتاج مكتبة، ولا يرسل شيئًا: يُنزّل ملفًّا عندك فقط.
 */
(async () => {
  /*
   * `COMPACT` — الوضع المضغوط: لا يُسقط شيئًا مهمًّا، بل يُسقط **الحاويات
   * الفارغة** (بلا نصّ ولا خلفية ولا حدّ ولا أيقونة). وهي الأغلبية الساحقة
   * في أي صفحة، ولا تُضيف معلومة: صندوقها يُستنتج من أبنائها.
   *
   * والملفّ ينزل من عدّة ميجابايت إلى بضع مئات الكيلوبايت، ويبقى فيه:
   * كل لون · كل خطّ · كل متغيّر CSS · وكل عنصر له شكل أو كلام.
   *
   * اجعلها `false` إن أردت **كل** عقدة بلا استثناء.
   */
  const COMPACT = true;
  const MAX = COMPACT ? 1200 : 3000;

  /*
   * `SVGS` — يضيف شيفرة كل أيقونة (`<svg>` كاملة) مع سماكة خطّها.
   *
   * وهذا هو الفرق بين «يبدو أثقل» و«stroke-width = 1.5 عندهم و2 عندنا»:
   * الشكل نفسه يُقرأ من `html`، فيُنسخ لا يُقلَّد. الحجم يكبر ~١–٢ ميجا.
   */
  const SVGS = true;

  const px = (v) => (v === 'normal' ? null : v);
  const sides = (cs, p) => [cs[p + 'Top'], cs[p + 'Right'], cs[p + 'Bottom'], cs[p + 'Left']];

  const boxOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) };
  };

  const styleOf = (cs) => ({
    font: {
      family: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      size: cs.fontSize,
      weight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: px(cs.letterSpacing),
      align: cs.textAlign,
      transform: cs.textTransform,
      smoothing: cs.webkitFontSmoothing || null,
    },
    color: {
      text: cs.color,
      bg: cs.backgroundColor,
      bgImage: cs.backgroundImage === 'none' ? null : cs.backgroundImage.slice(0, 200),
      border: cs.borderTopWidth === '0px' ? null : cs.borderTopColor,
      opacity: cs.opacity,
    },
    space: {
      pad: sides(cs, 'padding'),
      margin: sides(cs, 'margin'),
      gap: px(cs.gap),
      radius: cs.borderRadius,
      borderWidth: sides(cs, 'border'),
      borderStyle: cs.borderTopStyle,
      shadow: cs.boxShadow === 'none' ? null : cs.boxShadow.slice(0, 200),
    },
    layout: {
      display: cs.display,
      position: cs.position,
      flexDirection: cs.flexDirection,
      alignItems: cs.alignItems,
      justifyContent: cs.justifyContent,
      overflowY: cs.overflowY,
    },
  });

  const ownText = (el) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');

  /* ————— ١) العناصر ————— */
  const elements = [];
  const palette = { text: new Map(), bg: new Map(), border: new Map(), mask: new Map() };
  const fonts = new Map();
  const radii = new Map();
  const pads = new Map();
  const gaps = new Map();
  const stats = { visited: 0, hidden: 0, noBox: 0 };

  const add = (map, key) => {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  };

  const walk = (el, depth) => {
    if (elements.length >= MAX || depth > 60) return;
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'path' || tag === 'use' || tag === 'g') return;
    stats.visited++;

    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') {
      stats.hidden++;
      return;
    }

    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) {
      stats.noBox++;
    } else {
      const own = ownText(el);
      const style = styleOf(cs);
      const mask = cs.maskImage !== 'none' ? cs.maskImage : cs.webkitMaskImage !== 'none' ? cs.webkitMaskImage : null;

      add(palette.text, style.color.text);
      if (style.color.bg && style.color.bg !== 'rgba(0, 0, 0, 0)') add(palette.bg, style.color.bg);
      if (style.color.border) add(palette.border, style.color.border);
      if (mask) add(palette.mask, (/url\("?([^")]+)"?\)/.exec(mask) || [])[1]);
      add(fonts, `${style.font.size}/${style.font.lineHeight} w${style.font.weight} ${style.font.family}`);
      add(radii, style.space.radius);
      add(pads, style.space.pad.join(' '));
      add(gaps, style.space.gap);

      /*
       * في الوضع المضغوط: نتخطّى الحاوية التي لا نصّ لها ولا سطح ولا حدّ
       * ولا أيقونة — فهي صندوق فارغ لا يُقاس منه شيء.
       */
      const surface = (style.color.bg && style.color.bg !== 'rgba(0, 0, 0, 0)') || style.color.border || mask;
      if (COMPACT && !own && !surface) {
        for (const c of el.children) walk(c, depth + 1);
        return;
      }

      elements.push({
        depth,
        tag,
        role: el.getAttribute('role') || null,
        label: (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim() || null,
        text: own.slice(0, 140) || null,
        box: boxOf(el),
        style,
        maskSrc: mask ? (/url\("?([^")]+)"?\)/.exec(mask) || [])[1] : null,
      });
    }

    for (const c of el.children) walk(c, depth + 1);
  };
  walk(document.body, 0);

  /* ————— ١ب) الأيقونات: الشكل الكامل + السماكة ————— */
  const svgs = [];
  if (SVGS) {
    const seen = new Map();
    for (const node of document.querySelectorAll('svg')) {
      const r = node.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const cs = getComputedStyle(node);
      const html = node.outerHTML.replace(/\s+/g, ' ').slice(0, 30000);
      if (seen.has(html)) {
        seen.get(html).count++;
        continue;
      }
      const rec = {
        count: 1,
        box: { w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: +r.x.toFixed(1), y: +r.y.toFixed(1) },
        viewBox: node.getAttribute('viewBox'),
        stroke: cs.stroke,
        strokeWidth: cs.strokeWidth,
        fill: cs.fill,
        /* السماكة كما هي مكتوبة في الشكل، لا كما ورثها من CSS */
        widths: [...new Set([...node.querySelectorAll('[stroke-width]')].map((n) => n.getAttribute('stroke-width')))],
        paths: node.querySelectorAll('path').length,
        html,
      };
      seen.set(html, rec);
      svgs.push(rec);
      if (svgs.length >= 300) break;
    }
  }

  /* ————— ٢) متغيّرات CSS من أوراق الأنماط ————— */
  const tokens = {};
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // ورقة من أصل آخر
    }
    if (!rules) continue;
    for (const rule of rules) {
      if (!rule.cssText || !rule.cssText.includes('--')) continue;
      const sel = rule.selectorText || (rule.cssText.startsWith('@') ? rule.cssText.slice(0, 40) : null);
      if (!sel) continue;
      for (const m of rule.cssText.matchAll(/--([\w-]+)\s*:\s*([^;{}]+)/g)) {
        const name = '--' + m[1];
        if (!tokens[name]) tokens[name] = {};
        tokens[name][sel] = m[2].trim().slice(0, 120);
      }
    }
  }

  const toObj = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));

  /* ————— ٣) المناطق ————— */
  const regionOf = (tag) => elements.filter((e) => e.tag === tag).slice(0, 2).map((e) => ({ box: e.box, style: e.style }));

  const out = {
    url: location.href,
    at: new Date().toISOString(),
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    theme: document.documentElement.getAttribute('data-theme') || null,
    prefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
    page: {
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      bodyFont: getComputedStyle(document.body).fontFamily.split(',')[0],
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
    },
    compact: COMPACT,
    stats,
    counts: { elements: elements.length, svgs: svgs.length, tokens: Object.keys(tokens).length },
    palette: {
      text: toObj(palette.text),
      bg: toObj(palette.bg),
      border: toObj(palette.border),
      mask: toObj(palette.mask),
    },
    frequent: {
      fonts: toObj(fonts).slice(0, 40),
      radii: toObj(radii).slice(0, 20),
      pads: toObj(pads).slice(0, 30),
      gaps: toObj(gaps).slice(0, 20),
    },
    regions: { header: regionOf('HEADER'), aside: regionOf('ASIDE'), main: regionOf('MAIN'), nav: regionOf('NAV') },
    elements,
    svgs,
    tokens,
  };

  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dump-all-${(out.theme || 'default')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  console.log(
    `✓ ${a.download} — عناصر ${elements.length} · أيقونات ${svgs.length} · متغيّرات CSS ${Object.keys(tokens).length} · ألوان: نصّ ${palette.text.size} · خلفية ${palette.bg.size} · حدّ ${palette.border.size}`,
  );
  console.log('  أكثر ١٠ ألوان نصًّا:', toObj(palette.text).slice(0, 10).map((c) => `${c.value}×${c.count}`).join(' · '));
})();

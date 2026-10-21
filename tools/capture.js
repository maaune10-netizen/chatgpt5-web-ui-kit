/**
 * capture.js — الأداة الوحيدة. تُشغَّل مرّة، تعمل بينما تتنقّل، وتُخرج مخطّطًا كاملًا.
 *
 *   الصقها في Console على chatgpt.com. تبدأ فورًا.
 *   تنقّل · افتح القوائم · غيّر المقاس · بدّل الوضع. ثم «إيقاف» ثم «تنزيل».
 *
 * ما تُخرجه (التفصيل في specs/CAPTURE.md):
 *   • كل عنصر: صناديقه، وكل خصائصه المحسوبة (٣٥٠+ خاصيّة، **مجمَّعة** فلا تتكرّر).
 *   • كل لون + نسبة تباين WCAG لكل نصّ مقابل خلفيّته الفعلية.
 *   • كل أيقونة: <svg> كاملة، <use> محلولًا، ::before/::after، وروابط الصور والأقنعة.
 *   • **البايتات**: كل أصل (أيقونة/خطّ/صورة) يُنزَّل ويُحفظ كـ`data:`.
 *   • قواعد CSS للتفاعل: :hover · :focus · :active · [data-*] · @font-face · @keyframes.
 *   • نقاط الانكسار، وخريطة الظهور، والفرق بين كل حالتين، وجرد الروابط.
 *
 * ولماذا «حالة» لا «لقطة»؟ لأنّ الصفحة تتغيّر بفعل القوائم والمقاسات والتنقّل،
 * وكل تغيّر حالةٌ مستقلّة. والبصمة تمنع تكرار الحالة نفسها.
 */
(() => {
  if (window.__cap) {
    try { window.__cap.stop(); } catch {}
    document.getElementById('__cap_panel')?.remove();
  }

  const MAX_STATES = 150;
  const MAX_MS = 5 * 60 * 1000;
  const FETCH_CAP_BYTES = 90 * 1024 * 1024;

  /*
   * مدخل الطابور: الملفّ يُرسَل من هنا مباشرة، فيصل إلى `inbox/` مرتّبًا
   * باسمه الزمنيّ — بلا رفع يدويّ وبلا انتظار.
   */
  const UPLOAD = 'https://bahr-vps.tail18374c.ts.net:8445/api/capture';

  const t0 = Date.now();
  const states = [];
  const appearance = new Map(); // key -> Set(width)
  const links = new Map();
  const siteMap = new Map();
  const assetUrls = new Set();
  const styleTable = new Map(); // hash -> { id, props }
  let styleSeq = 0;

  /* ————————————————— أدوات صغيرة ————————————————— */

  const hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  };

  const ownText = (el) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');

  const rgb = (v) => {
    const m = /rgba?\(([^)]+)\)/.exec(v || '');
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };

  const lum = ({ r, g, b }) => {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  /*
   * الخلفية الفعلية = **تركيب** كل الطبقات الشفافة فوق بعضها، لا أوّل لون معتم.
   *
   * وكان الخطأ: صفّ نشط بخلفية `rgba(255,255,255,0.1)` فوق أسود يُقرأ أبيضَ
   * كاملًا، فيطلع التباين 1.17 بدل 17.9. والشفافية جزء من اللون.
   */
  const blend = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });

  const effBg = (el) => {
    const stack = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const c = rgb(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.004) {
        stack.push(c);
        if (c.a >= 0.99) break;
      }
      n = n.parentElement;
    }
    const bodyBg = rgb(getComputedStyle(document.body).backgroundColor);
    let cur = bodyBg && bodyBg.a > 0.9 ? bodyBg : { r: 0, g: 0, b: 0, a: 1 };
    /* من الأبعد إلى الأقرب — ترتيب الرسم نفسه */
    for (let i = stack.length - 1; i >= 0; i--) cur = blend(stack[i], cur);
    /* أعداد صحيحة: rgb(20.400000000000002) لا تُقرأ */
    return { r: Math.round(cur.r), g: Math.round(cur.g), b: Math.round(cur.b), a: 1 };
  };

  const ratio = (fg, bg) => {
    const L1 = lum(fg);
    const L2 = lum(bg);
    return +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2));
  };

  /* كل الخصائص المحسوبة، مجمَّعة: ٣٥٠+ خاصيّة، لكن المتطابق يُحفظ مرّة */
  const styleIdOf = (cs) => {
    const parts = [];
    for (let i = 0; i < cs.length; i++) {
      const p = cs[i];
      parts.push(p + ':' + cs.getPropertyValue(p));
    }
    const joined = parts.join(';');
    const h = hash(joined);
    if (!styleTable.has(h)) {
      const props = {};
      for (const kv of parts) {
        const i = kv.indexOf(':');
        props[kv.slice(0, i)] = kv.slice(i + 1);
      }
      styleTable.set(h, { id: styleSeq++, props });
    }
    return h;
  };

  /* نصّ مقيس بـRange: العرض الحقيقي وعدد الأسطر */
  const textMetrics = (el) => {
    try {
      const r = document.createRange();
      r.selectNodeContents(el);
      const rects = [...r.getClientRects()].filter((x) => x.width > 0 && x.height > 0);
      if (!rects.length) return null;
      const lines = new Set(rects.map((x) => Math.round(x.top / 4) * 4)).size;
      return {
        textWidth: +Math.max(...rects.map((x) => x.right)).toFixed(1) - +Math.min(...rects.map((x) => x.left)).toFixed(1),
        lineCount: lines,
        truncated: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
      };
    } catch {
      return null;
    }
  };

  /* ————————————————— CSS: قواعد مفيدة ————————————————— */
  const cssRules = [];
  const cssSkipped = [];
  const breakpoints = new Set();
  const INTERESTING = /:hover|:focus|:active|:disabled|:checked|\[data-|::before|::after|::placeholder|@font-face|@keyframes|:where|:is\(/;

  const pushRule = (text, media) => {
    if (cssRules.length >= 12000) return;
    cssRules.push({ media: media || null, css: text.slice(0, 4000) });
  };

  const scanRules = (list, media) => {
    for (const r of list || []) {
      if (r.media && r.media.mediaText) {
        if (/width/.test(r.media.mediaText)) breakpoints.add(r.media.mediaText);
        if (INTERESTING.test(r.media.mediaText)) pushRule(`@media ${r.media.mediaText}{`, media);
        if (r.cssRules) scanRules(r.cssRules, media ? media + ' and ' + r.media.mediaText : r.media.mediaText);
        continue;
      }
      if (r.cssText && INTERESTING.test(r.cssText)) pushRule(r.cssText, media);
      if (r.cssRules && !r.selectorText) scanRules(r.cssRules, media); // @supports/@layer
    }
  };

  for (const sheet of document.styleSheets) {
    try {
      scanRules(sheet.cssRules, null);
    } catch {
      cssSkipped.push(sheet.href || '(inline)');
    }
  }

  /* ————————————————— الأصول: URLs ————————————————— */
  const ASSET_RE = /\.(svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf)(\?|#|$)/i;
  const urlFromCss = (v) => {
    const m = /url\(["']?([^"')]+)["']?\)/.exec(v || '');
    return m ? m[1] : null;
  };
  const noteUrl = (u) => {
    if (!u || u.startsWith('data:') || u.startsWith('blob:')) return;
    try {
      assetUrls.add(new URL(u, location.href).href);
    } catch {}
  };
  /*
   * لا تعتمد على الامتداد: أصول ChatGPT تحمل بصمات بلا امتداد
   * (`UcC73....woff2` نعم، لكن غيرها لا). فنجمع بالنوع أيضًا.
   */
  for (const r of performance.getEntriesByType('resource')) {
    if (ASSET_RE.test(r.name) || /^(img|css|font|other|link)$/.test(r.initiatorType)) noteUrl(r.name);
  }

  /* ————————————————— التحويم والتلميحات —————————————————
   *
   * `:hover` لا تُفعَّل بالأحداث الصناعيّة — تُفعَّل بالمؤشّر الحقيقي وحده.
   * فالحيلة: نستمع لـ`mousemove`، وحين يستقرّ المؤشّر على عنصر ٢٦٠ مللي
   * نقرأ أنماطه **وهو محوَّم عليه فعلًا**، ثم نبحث عن التلميح الظاهر.
   *
   * وهذا يسجّل شيئًا لا تُنتجه أي لقطة ساكنة: «العقل يقول Get a smarter
   * answer، وإطاره يتغيّر إلى كذا».
   */
  const hovers = [];
  /*
   * ليس كلّ تلميح `[role=tooltip]`. بعضها في portal، وبعضها مربوط
   * بـ`aria-describedby`، وبعضها `popover` أصليّ. فنبحث في كلّها.
   */
  const TIP_SEL = [
    '[role="tooltip"]',
    '[role="status"]',
    '[aria-live]',
    '[popover]:popover-open',
    '[data-radix-popper-content-wrapper]',
    '[data-state="open"][data-side]',
    '[id*="tooltip" i]',
    '[class*="tooltip" i]',
  ].join(',');

  /* التلميح الخفيّ: aria-describedby → نصّ العنصر المشار إليه */
  const describedBy = (el) => {
    const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    const txt = ids.map((id) => document.getElementById(id)?.innerText || '').join(' ').replace(/\s+/g, ' ').trim();
    return txt ? txt.slice(0, 200) : null;
  };

  const recordHover = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el || el.closest('#__cap_panel')) return;
    const chain = [];
    let n = el;
    for (let i = 0; i < 4 && n && n !== document.body; i++) {
      const r = n.getBoundingClientRect();
      chain.push({
        tag: n.tagName,
        label: (n.getAttribute('aria-label') || '').slice(0, 120) || null,
        title: n.getAttribute('title') || null,
        text: ownText(n).slice(0, 80) || null,
        box: { x: +r.x.toFixed(0), y: +r.y.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0) },
        s: styleIdOf(getComputedStyle(n)),
      });
      n = n.parentElement;
    }
    /*
     * التلميح المرئيّ **يُضاف إلى `<body>`** بعد مهلة، وغالبًا في portal.
     * فبدل البحث بمحدّد نجهله: نقارن أبناء `<body>` قبل وبعد.
     * (وكان الخطأ أخذ `aria-describedby`، وهو نصّ مخفيّ 1×1 لا يُرى.)
     */
    const tip = [...document.body.children].find(
      (n) =>
        n.id !== '__cap_panel' && /* ← لوحة الأداة ليست تلميحًا: كانت تُلتقط مكانه */
        !n.dataset.capSeen &&
        n.getBoundingClientRect().width > 20 &&
        n.innerText &&
        n.innerText.trim().length > 1,
    ) || document.querySelector(TIP_SEL);
    const tipRect = tip ? tip.getBoundingClientRect() : null;
    const rec = {
      at: new Date().toISOString(),
      x, y,
      key: chain[0].label || chain[0].title || chain[0].text || chain[0].tag,
      tip: (tip ? tip.innerText.replace(/\s+/g, ' ').trim().slice(0, 200) : null) || describedBy(el),
      tipBox: tipRect ? { x: +tipRect.x.toFixed(0), y: +tipRect.y.toFixed(0), w: +tipRect.width.toFixed(0), h: +tipRect.height.toFixed(0) } : null,
      tipS: tip ? styleIdOf(getComputedStyle(tip)) : null,
      chain,
    };
    /* التمريرات المكرّرة على الشيء نفسه لا تُضيف معلومة */
    if (hovers.some((h) => h.key === rec.key && h.tip === rec.tip)) return;
    hovers.push(rec);
    if (hoverCount) hoverCount.textContent = hovers.length;
  };

  let hoverTimer = null;
  const onMove = (e) => {
    /* بصمة أبناء body الآن — كل ما يُضاف بعدها هو سطح جديد */
    for (const n of document.body.children) if (n.id !== '__cap_panel') n.dataset.capSeen = '1';
    clearTimeout(hoverTimer);
    const x = e.clientX, y = e.clientY;
    /*
     * ٩٠٠ مللي: التلميحات في ChatGPT تتأخّر. وبـ٢٦٠ كُنّا نلتقط «Think» بلا
     * تلميح إطلاقًا.
     */
    hoverTimer = setTimeout(() => recordHover(x, y), 900);
  };
  window.addEventListener('mousemove', onMove, { passive: true });

  /* ————————————————— النقر: ماذا ظهر بعده —————————————————
   *
   * «أضغط Work فيظهر لي إشعار» — هذا لا يظهر بالتحويم. فنسجّل كل نقرة،
   * ونقارن الأسطح الطافية قبلها وبعدها بـ٧٠٠ مللي: فما ظهر هو الجواب.
   */
  const clicks = [];
  const FLOAT_SEL = '[role="alert"],[role="status"],[role="dialog"],[role="tooltip"],[aria-live],[popover]:popover-open,[data-radix-popper-content-wrapper],[class*="toast" i],[class*="Toast"]';

  const surfacesNow = () => {
    const out = new Map();
    for (const n of document.querySelectorAll(FLOAT_SEL)) {
      if (n.closest('#__cap_panel')) continue;
      const r = n.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const text = n.innerText.replace(/\s+/g, ' ').trim().slice(0, 220);
      if (!text) continue;
      out.set(text, {
        text,
        tag: n.tagName,
        role: n.getAttribute('role') || null,
        box: { x: +r.x.toFixed(0), y: +r.y.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0) },
        s: styleIdOf(getComputedStyle(n)),
      });
    }
    return out;
  };

  const onClick = (e) => {
    const el = e.target instanceof Element ? e.target.closest('button,[role="button"],[role="tab"],a,[role="menuitem"],summary') : null;
    if (!el || el.closest('#__cap_panel')) return;
    const before = surfacesNow();
    const r = el.getBoundingClientRect();
    const key = (el.getAttribute('aria-label') || el.innerText || el.textContent || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 90);
    const rec = {
      at: new Date().toISOString(),
      key,
      box: { x: +r.x.toFixed(0), y: +r.y.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0) },
      s: styleIdOf(getComputedStyle(el)),
      appeared: [],
      stateAfter: null,
    };
    clicks.push(rec);
    setTimeout(() => {
      rec.appeared = [...surfacesNow()].filter(([t]) => !before.has(t)).map(([, v]) => v);
      rec.stateAfter = el.getAttribute('aria-expanded');
    }, 700);
  };
  document.addEventListener('click', onClick, true);

  /* ————————————————— لقطة حالة ————————————————— */
  const SURFACES = '[role="dialog"],[aria-expanded="true"],[data-state="open"],[popover],dialog[open]';

  const snapshot = (trigger) => {
    const elements = [];
    const pseudo = [];
    const wrapperKeys = new Set();

    const walk = (el, depth) => {
      if (elements.length >= 1400 || depth > 70) return;
      const tag = el.tagName;
      if (/^(SCRIPT|STYLE|NOSCRIPT|PATH|USE|G|DEFS|SYMBOL|META|LINK|HEAD|TITLE)$/.test(tag)) return;
      /* لوحة الأداة نفسها ليست من الصفحة — وكانت تُسجَّل وتُفسد الفروق */
      if (el.id && el.id.startsWith('__cap')) return;
      if (el.closest && el.closest('#__cap_panel')) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;

      const rect = el.getBoundingClientRect();
      const own = ownText(el);
      const bg = cs.backgroundColor;
      const hasSurface = bg !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px' || cs.backgroundImage !== 'none';
      const hasSvg = el.querySelector(':scope > svg, :scope > * > svg');

      /* الحاويات الفارغة تُتخطّى — صندوقها يُستنتج من أبنائها */
      if (!own && !hasSurface && !hasSvg && !el.getAttribute('role') && !el.getAttribute('aria-label')) {
        for (const c of el.children) walk(c, depth + 1);
        return;
      }

      const key = `${tag}|${el.getAttribute('role') || ''}|${(el.getAttribute('aria-label') || '').slice(0, 40)}|${own.slice(0, 60)}`;
      if (!wrapperKeys.has(key + '|' + Math.round(rect.x) + ',' + Math.round(rect.y))) {
        wrapperKeys.add(key + '|' + Math.round(rect.x) + ',' + Math.round(rect.y));
        if (!appearance.has(key)) appearance.set(key, new Set());
        appearance.get(key).add(window.innerWidth);
      }

      /* التباين: فقط للعناصر التي تحمل نصًّا */
      let contrast = null;
      if (own) {
        const fg = rgb(cs.color);
        const b = effBg(el);
        if (fg && fg.a > 0.05) contrast = { fg: cs.color, bg: `rgb(${b.r}, ${b.g}, ${b.b})`, ratio: ratio(fg, b) };
      }

      const rec = {
        tag,
        role: el.getAttribute('role') || null,
        label: (el.getAttribute('aria-label') || '').slice(0, 120) || null,
        text: own.slice(0, 300) || null,
        id: el.id || null,
        classes: el.className && typeof el.className === 'string' ? el.className.slice(0, 200) : null,
        box: { x: +rect.x.toFixed(1), y: +rect.y.toFixed(1), w: +rect.width.toFixed(1), h: +rect.height.toFixed(1) },
        scroll: { sw: el.scrollWidth, sh: el.scrollHeight, cw: el.clientWidth, ch: el.clientHeight },
        s: styleIdOf(cs),
        contrast,
      };
      if (own && own.length < 200) rec.metrics = textMetrics(el);

      /* ::before و ::after — مكان كثير من الأيقونات */
      for (const pe of ['::before', '::after']) {
        try {
          const ps = getComputedStyle(el, pe);
          const content = ps.content;
          if (!content || content === 'none' || content === 'normal') continue;
          const img = urlFromCss(ps.backgroundImage) || urlFromCss(ps.maskImage) || urlFromCss(ps.content);
          if (img) noteUrl(img);
          pseudo.push({ of: key, pe, content: content.slice(0, 200), size: `${ps.width}x${ps.height}`, color: ps.color, bgImage: ps.backgroundImage.slice(0, 200), maskImage: (ps.maskImage || ps.webkitMaskImage || 'none').slice(0, 200) });
        } catch {}
      }

      /*
       * الأيقونة **تُنسَب إلى عنصرها**.
       * وكانت تُجمع في قائمة منفصلة (`svgs`) بلا إحداثيّات، فتُفقد النسبة:
       * ٧٥ أيقونة، ولا يُعرف أيّها لـ«Search the web». وهذا سبب أنّ أيقوناتنا
       * للاقتراحات خطأ.
       */
      const iconNode = el.tagName === 'svg' ? el : el.querySelector('svg');
      if (iconNode) {
        const ir = iconNode.getBoundingClientRect();
        rec.icon = iconNode.outerHTML.replace(/\s+/g, ' ').slice(0, 40000);
        rec.iconBox = { x: +ir.x.toFixed(0), y: +ir.y.toFixed(0), w: +ir.width.toFixed(1), h: +ir.height.toFixed(1) };
        rec.iconViewBox = iconNode.getAttribute('viewBox');
        rec.iconWidths = [...new Set([...iconNode.querySelectorAll('[stroke-width]')].map((n) => n.getAttribute('stroke-width')))];
        rec.iconPaths = iconNode.querySelectorAll('path').length;
        rec.iconFill = getComputedStyle(iconNode).fill;
      }

      const bgImg = urlFromCss(cs.backgroundImage);
      const maskImg = urlFromCss(cs.maskImage !== 'none' ? cs.maskImage : cs.webkitMaskImage);
      if (bgImg) noteUrl(bgImg);
      if (maskImg) noteUrl(maskImg);
      if (bgImg || maskImg) rec.images = { bg: bgImg, mask: maskImg };
      if (tag === 'IMG') {
        rec.img = { src: el.currentSrc || el.src, natural: `${el.naturalWidth}x${el.naturalHeight}` };
        noteUrl(el.currentSrc || el.src);
      }

      elements.push(rec);
      for (const c of el.children) walk(c, depth + 1);
    };
    walk(document.body, 0);

    /* الأيقونات */
    const svgs = [];
    for (const node of document.querySelectorAll('svg')) {
      const r = node.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      svgs.push({
        box: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
        viewBox: node.getAttribute('viewBox'),
        strokeWidth: getComputedStyle(node).strokeWidth,
        widths: [...new Set([...node.querySelectorAll('[stroke-width]')].map((n) => n.getAttribute('stroke-width')))],
        fill: getComputedStyle(node).fill,
        paths: node.querySelectorAll('path').length,
        html: node.outerHTML.replace(/\s+/g, ' ').slice(0, 40000),
      });
      if (svgs.length >= 400) break;
    }
    const uses = [...document.querySelectorAll('use')].slice(0, 300).map((u) => {
      const href = u.getAttribute('href') || u.getAttribute('xlink:href') || '';
      const id = href.startsWith('#') ? href.slice(1) : null;
      const t = id && document.getElementById(id);
      return { id, resolved: t ? t.outerHTML.replace(/\s+/g, ' ').slice(0, 40000) : null };
    });

    /* الروابط */
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
      const abs = new URL(href, location.href).href;
      links.set(abs, (links.get(abs) || 0) + 1);
    }

    const out = {
      id: states.length,
      trigger,
      at: new Date().toISOString(),
      t: Date.now() - t0,
      url: location.href,
      title: document.title,
      viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio, sx: scrollX, sy: scrollY },
      theme: {
        dataTheme: document.documentElement.getAttribute('data-theme') || document.documentElement.className.slice(0, 100) || null,
        prefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
      },
      page: {
        bodyBg: getComputedStyle(document.body).backgroundColor,
        bodyColor: getComputedStyle(document.body).color,
        rootFont: getComputedStyle(document.documentElement).fontSize,
        lang: document.documentElement.lang,
        dir: document.documentElement.dir || 'ltr',
      },
      surfaces: [...document.querySelectorAll(SURFACES)].map((e) => ({
        tag: e.tagName,
        role: e.getAttribute('role'),
        label: (e.getAttribute('aria-label') || '').slice(0, 80),
        box: (() => { const b = e.getBoundingClientRect(); return { x: +b.x.toFixed(0), y: +b.y.toFixed(0), w: +b.width.toFixed(0), h: +b.height.toFixed(0) }; })(),
      })),
      mediaMatched: [...breakpoints].filter((m) => { try { return matchMedia(m).matches; } catch { return false; } }),
      scrollContainers: elements.filter((e) => e.scroll.sh > e.scroll.ch + 4 || e.scroll.sw > e.scroll.cw + 4).map((e) => ({ tag: e.tag, box: e.box, scroll: e.scroll })),
      counts: { elements: elements.length, svgs: svgs.length, iconsBound: elements.filter((e) => e.icon).length, pseudo: pseudo.length },
      elements,
      svgs,
      uses,
      pseudo,
    };

    /* البصمة: نفس المحتوى لا يُخزَّن مرّتين */
    const sig = hash(out.url + out.viewport.w + '|' + elements.map((e) => e.tag + e.box.x + ',' + e.box.y + ',' + e.box.w + e.s).join(''));
    out.sig = sig;
    return out;
  };

  const capture = (trigger) => {
    if (states.length >= MAX_STATES) return false;
    if (Date.now() - t0 > MAX_MS) return false;
    const snap = snapshot(trigger);
    if (states.length && states[states.length - 1].sig === snap.sig) return false;

    /* الفرق من الحالة السابقة */
    const prev = states[states.length - 1];
    if (prev) {
      const pk = new Map(prev.elements.map((e) => [`${e.tag}|${e.text}|${e.label}`, e]));
      const diff = { added: [], removed: [], moved: [], resized: [], restyled: [] };
      for (const e of snap.elements) {
        const k = `${e.tag}|${e.text}|${e.label}`;
        const o = pk.get(k);
        if (!o) { diff.added.push(k.slice(0, 90)); continue; }
        if (o.s !== e.s) diff.restyled.push(k.slice(0, 90));
        if (o.box.x !== e.box.x || o.box.y !== e.box.y) diff.moved.push(`${k.slice(0, 70)} ${o.box.x},${o.box.y}→${e.box.x},${e.box.y}`);
        else if (o.box.w !== e.box.w || o.box.h !== e.box.h) diff.resized.push(`${k.slice(0, 70)} ${o.box.w}x${o.box.h}→${e.box.w}x${e.box.h}`);
        pk.delete(k);
      }
      diff.removed = [...pk.keys()].map((k) => k.slice(0, 90));
      snap.diff = diff;
    }

    states.push(snap);
    if (!siteMap.has(snap.url)) siteMap.set(snap.url, { first: snap.at, title: snap.title });
    render();
    return true;
  };

  /* ————————————————— اللوحة ————————————————— */
  let hoverCount = null;
  const panel = document.createElement('div');
  panel.id = '__cap_panel';
  panel.style.cssText = `position:fixed;z-index:2147483647;inset-inline-start:12px;bottom:12px;background:#0b0b0b;color:#ededed;
    font:12px/1.6 ui-monospace,SFMono-Regular,monospace;padding:10px 12px;border-radius:10px;border:1px solid #2a2a2a;
    box-shadow:0 10px 30px rgba(0,0,0,.6);display:flex;gap:9px;align-items:center;flex-wrap:wrap;max-width:94vw`;
  document.body.appendChild(panel);

  let running = true;
  const estimate = () => {
    let bytes = 0;
    for (const [k, v] of styleTable) bytes += k.length + JSON.stringify(v.props).length;
    bytes += states.length * 400;
    bytes += cssRules.reduce((a, r) => a + r.css.length, 0);
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const render = () => {
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    panel.innerHTML = `
      <span>🔴 <b>${states.length}</b> حالة</span>
      <span style="color:#7a7a7a">${secs}s · ${siteMap.size} صفحة · <b id="__cap_h">${hovers.length}</b> تحويمًا · <b id="__cap_c">${clicks.length}</b> نقرة · ~${estimate()}</span>
      <button id="__cap_s" style="all:unset;cursor:pointer;background:${running ? '#2f2f2f' : '#1f6f3f'};padding:5px 9px;border-radius:6px">${running ? '⏸ إيقاف' : '▶ متابعة'}</button>
      <button id="__cap_u" style="all:unset;cursor:pointer;background:#1f6f3f;color:#fff;padding:5px 9px;border-radius:6px">⬆ إرسال</button>
      <button id="__cap_d" style="all:unset;cursor:pointer;background:#333;color:#ededed;padding:5px 9px;border-radius:6px">⬇ تنزيل</button>`;
    hoverCount = panel.querySelector('#__cap_h');
    panel.querySelector('#__cap_s').onclick = () => { running = !running; render(); if (running) capture('resume'); };
    panel.querySelector('#__cap_d').onclick = () => download('download');
    panel.querySelector('#__cap_u').onclick = () => download('upload');
  };

  /* ————————————————— التنزيل ————————————————— */
  const dl = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  };

  const toDataUrl = (blob) =>
    new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => res(null);
      r.readAsDataURL(blob);
    });

  const download = async (mode = 'download') => {
    const btn = panel.querySelector('#__cap_d');
    if (btn) btn.textContent = mode === 'upload' ? '… جمع الأصول' : '… جمع الأصول';

    const assets = {};
    let total = 0;
    const list = [...assetUrls].slice(0, 400);
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      try {
        const res = await fetch(u, { credentials: 'include' });
        if (!res.ok) { assets[u] = { error: res.status }; continue; }
        const blob = await res.blob();
        if (total + blob.size > FETCH_CAP_BYTES) { assets[u] = { error: 'cap', size: blob.size }; continue; }
        total += blob.size;
        assets[u] = { mime: blob.type, size: blob.size, dataUrl: await toDataUrl(blob) };
      } catch (e) {
        assets[u] = { error: String(e).slice(0, 80) };
      }
      if (btn) btn.textContent = `… ${i + 1}/${list.length}`;
    }

    const out = {
      meta: {
        tool: 'capture.js',
        startedAt: new Date(t0).toISOString(),
        endedAt: new Date().toISOString(),
        url: location.href,
        durationMs: Date.now() - t0,
        states: states.length,
        viewports: [...new Set(states.map((s) => s.viewport.w))].sort((a, b) => a - b),
        breakpoints: [...breakpoints],
        cssRuleCount: cssRules.length,
        cssSkipped,
        assetCount: Object.keys(assets).length,
        assetBytes: total,
        hovers: hovers.length,
        clicks: clicks.length,
        styleTableSize: styleTable.size,
      },
      styles: Object.fromEntries([...styleTable].map(([h, v]) => [h, v.props])),
      css: cssRules,
      hovers,
      clicks,
      states,
      appearance: [...appearance].map(([key, widths]) => ({
        key,
        widths: [...widths].sort((a, b) => a - b),
        missingAt: [...new Set(states.map((s) => s.viewport.w))].filter((w) => !widths.has(w)).sort((a, b) => a - b),
      })),
      links: [...links].map(([url, count]) => ({ url, count })).sort((a, b) => b.count - a.count),
      siteMap: [...siteMap].map(([url, v]) => ({ url, ...v })),
      resources: performance.getEntriesByType('resource').map((r) => ({ name: r.name, type: r.initiatorType, bytes: r.transferSize || 0 })),
      assets,
    };

    const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
    const mb = (blob.size / 1048576).toFixed(1);

    if (mode === 'upload') {
      if (btn) btn.textContent = `… إرسال ${mb} MB`;
      try {
        const res = await fetch(UPLOAD, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: blob });
        const r = await res.json();
        if (btn) btn.textContent = r.ok ? `✓ أُرسل ${mb} MB` : `✗ فشل ${res.status}`;
        console.log(r.ok ? `↑ أُرسل ${r.name} · ${mb} ميجا` : `✗ ${JSON.stringify(r).slice(0, 120)}`);
      } catch (e) {
        if (btn) btn.textContent = '✗ الشبكة';
        console.log('✗ فشل الإرسال:', String(e).slice(0, 120));
      }
      return;
    }

    dl(blob, `capture-${out.meta.states}s-${mb}mb.json`);
    if (btn) btn.textContent = `⬇ تنزيل (${mb} MB)`;
    console.log(`✓ ${states.length} حالة · ${Object.keys(assets).length} أصل · ${cssRules.length} قاعدة · ${mb} ميجا`);
  };

  /* ————————————————— المحرّكات ————————————————— */
  const later = (fn, ms) => {
    let t = null;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };
  const deb = later(() => { if (running) capture('mutation'); }, 700);
  const debR = later(() => { if (running) capture('resize'); }, 600);

  const mo = new MutationObserver(deb);
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-expanded', 'data-state', 'open'] });

  const onResize = () => debR();
  const onNav = () => setTimeout(() => { if (running) capture('nav'); }, 500);
  window.addEventListener('resize', onResize);
  window.addEventListener('popstate', onNav);
  window.addEventListener('hashchange', onNav);
  const ps = history.pushState;
  const rs = history.replaceState;
  history.pushState = function (...a) { const r = ps.apply(this, a); onNav(); return r; };
  history.replaceState = function (...a) { const r = rs.apply(this, a); onNav(); return r; };

  const interval = setInterval(() => {
    if (!running) return;
    if (Date.now() - t0 > MAX_MS) { running = false; render(); return; }
    capture('interval');
  }, 1500);

  capture('start');
  render();

  window.__cap = {
    states,
    capture,
    download,
    stop: () => {
      running = false;
      clearInterval(interval);
      mo.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('popstate', onNav);
      window.removeEventListener('hashchange', onNav);
      history.pushState = ps;
      history.replaceState = rs;
      render();
    },
  };

  console.log(
    `🧭 capture.js يعمل — ${breakpoints.size} نقطة انكسار · ${cssRules.length} قاعدة CSS · ${assetUrls.size} أصل.\n` +
      '   تنقّل، افتح القوائم، غيّر المقاس. ثم «إيقاف» ثم «تنزيل».',
  );
})();

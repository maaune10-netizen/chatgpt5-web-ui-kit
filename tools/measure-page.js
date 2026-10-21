/**
 * قياس الصفحة — يُلصق في Console المتصفّح، فيُنزّل `page-measure.json`.
 *
 * الخطوات:
 *   ١) افتح الصفحة التي تريدها على chatgpt.com (وأنت مسجَّل).
 *   ٢) F12 → Console → الصق هذا الملفّ → Enter.
 *   ٣) سيُنزّل `page-measure.json` — ارفعه على https://bahr-vps.tail18374c.ts.net:8445/
 *
 * ويأخذ لكل عنصر مرئيّ:
 *   • **الصندوق** — x · y · العرض · الارتفاع (بكسلات، بلا تقريب).
 *   • **الخطّ** — العائلة · الحجم · الوزن · ارتفاع السطر · تباعد الحروف.
 *   • **الألوان** — النصّ · الخلفية · الحدّ · الشفافية.
 *   • **المسافات** — الحشو · الهامش · الفراغ بين الأبناء · نصف القطر · الحدّ.
 *
 * ولا يحتاج مكتبة، ولا يرسل شيئًا: يُنزّل ملفًّا عندك فقط.
 *
 * **وللمسات الدقيقة:** بعد التشغيل، حدّد أي عنصر في Inspector ثم اكتب في
 * الـConsole:  `__measure($0)`  — يطبع قياساته كاملةً.
 */
(async () => {
  const MAX = 900; // سقف: الصفحة فيها آلاف العناصر، ولا نريد ملفًّا بلا نهاية

  const boxOf = (el) => {
    const r = el.getBoundingClientRect();
    return {
      x: +r.x.toFixed(2),
      y: +r.y.toFixed(2),
      w: +r.width.toFixed(2),
      h: +r.height.toFixed(2),
      /** المسافة من يمين الصفحة — للعناصر الملتصقة بالحافة */
      right: +(window.innerWidth - r.right).toFixed(2),
    };
  };

  const fontOf = (cs) => ({
    family: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
    size: cs.fontSize,
    weight: cs.fontWeight,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing === 'normal' ? 'normal' : cs.letterSpacing,
    align: cs.textAlign,
    transform: cs.textTransform,
  });

  const colorOf = (cs) => ({
    text: cs.color,
    bg: cs.backgroundColor,
    border: cs.borderTopColor,
    opacity: cs.opacity,
  });

  /*
   * الحشو والهامش تُقرأ **لكل جهة** لا مختصرة: `10px 8px` لا تقول أيّ جهة
   * صاحبة الرقم، وقد قارنّا مرّات أرقامًا مختصرة فأخطأنا الجهة.
   */
  const spaceOf = (cs) => ({
    pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft],
    margin: [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft],
    gap: cs.gap === 'normal' ? null : cs.gap,
    radius: cs.borderRadius,
    borderWidth: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth],
    borderStyle: cs.borderTopStyle,
    shadow: cs.boxShadow === 'none' ? null : cs.boxShadow,
  });

  const pathOf = (el) => {
    const parts = [];
    let n = el;
    for (let i = 0; i < 6 && n && n !== document.body; i++) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += '#' + n.id;
      const cls = (n.className && typeof n.className === 'string' ? n.className : '')
        .split(/\s+/)
        .filter((c) => c && !c.startsWith('hover:') && !c.includes(':'))
        .slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      parts.unshift(s);
      n = n.parentElement;
    }
    return parts.join(' > ');
  };

  /*
   * الاسم من `aria-label` ثم من **النصّ المباشر** — لا من `innerText`.
   * و`innerText` يشمل الأبناء كلّهم، فأيّ حاوية تحتوي «New chat» تُسمّى
   * «New chat» — ويضيع الصفّ بين عشرات الحاويات المتطابقة.
   */
  const directText = (el) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();

  const nameOf = (el) => {
    const label = el.getAttribute('aria-label') || el.getAttribute('title');
    if (label) return label.trim().slice(0, 60);
    const own = directText(el);
    if (own) return own.slice(0, 60);
    if (['BUTTON', 'A', 'LABEL'].includes(el.tagName)) {
      const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
      if (t) return t.slice(0, 60);
    }
    return '';
  };

  const items = [];
  const byBox = new Set();

  const walk = (el, depth) => {
    if (items.length >= MAX || depth > 22) return;
    if (el.tagName === 'svg' || el.closest('svg')) return; // الأيقونات لها سكربتها
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    if (r.bottom < -50 || r.top > window.innerHeight + 50) {
      /* خارج الشاشة: نتخطّى الأبناء أيضًا — إلا الحاويات الكبيرة */
      if (r.height < window.innerHeight) return;
    }

    const text = directText(el);
    const tag = el.tagName;
    const interactive = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'LABEL'].includes(tag);
    const hasSurface = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px';
    const key = `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)},${tag}`;

    if ((text || interactive || hasSurface) && !byBox.has(key)) {
      byBox.add(key);
      items.push({
        path: pathOf(el),
        tag,
        role: el.getAttribute('role') || null,
        name: nameOf(el),
        text: text.slice(0, 120) || null,
        box: boxOf(el),
        font: fontOf(cs),
        color: colorOf(cs),
        space: spaceOf(cs),
        layout: { display: cs.display, position: cs.position, flexDirection: cs.flexDirection, alignItems: cs.alignItems, justifyContent: cs.justifyContent },
      });
    }

    for (const child of el.children) walk(child, depth + 1);
  };

  walk(document.body, 0);

  const out = {
    url: location.href,
    at: new Date().toISOString(),
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    theme: document.documentElement.getAttribute('data-theme') || document.documentElement.className || null,
    count: items.length,
    /** أهمّ ما نحتاجه: خطّ الصفحة نفسه وخلفيتها */
    page: {
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      bodyFont: getComputedStyle(document.body).fontFamily,
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
    },
    items,
  };

  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'page-measure.json';
  document.body.appendChild(a);
  a.click();
  a.remove();

  /* أداة لمسة واحدة: حدّد عنصرًا في Inspector ثم __measure($0) */
  window.__measure = (el) => {
    if (!el) return 'مرّر عنصرًا: __measure($0)';
    const cs = getComputedStyle(el);
    const m = { path: pathOf(el), name: nameOf(el), box: boxOf(el), font: fontOf(cs), color: colorOf(cs), space: spaceOf(cs) };
    console.table ? console.log(JSON.stringify(m, null, 1)) : console.log(m);
    return m;
  };

  console.log(`✓ أُنزل page-measure.json — ${items.length} عنصرًا · نافذة ${out.viewport.w}×${out.viewport.h}`);
  console.log('  لقياس عنصر واحد: حدّده في Inspector ثم اكتب  __measure($0)');
})();

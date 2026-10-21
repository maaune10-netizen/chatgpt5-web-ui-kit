/**
 * dump-matrix.js — يلتقط الصفحة **عند كل عرض** بينما تسحب النافذة.
 *
 *   الصق في Console على chatgpt.com، ثم اسحب طرف النافذة ببطء من أوسع ما
 *   عندك إلى أضيق ما عندك. كل عرض يستقرّ ٤٠٠ مللي، يأخذ لقطة كاملة.
 *   ثم اضغط «تنزيل» في اللوحة السفلى — ملفّ واحد فيه كل العروض وفروقها.
 *
 * ولماذا هكذا؟ لأنّ JavaScript لا تستطيع تغيير مقاس النافذة (المتصفّح
 * يمنعها). فبدل أن نطلب منك تشغيله اثنتي عشرة مرة، يستمع هذا للـresize
 * ويجمع بنفسه.
 *
 * ويأخذ لكل عرض:
 *   ١) العناصر — صندوقها وخطّها ولونها وحشوها (كالـdump-all).
 *   ٢) الأيقونات — <svg> كاملة مع حلّ <use>.
 *   ٣) **نقاط الانكسار** — كل `@media` في أوراق الأنماط، وهل تُطابق الآن.
 *   ٤) عند التنزيل: **خريطة الظهور** — أيّ عنصر وُجد في أي عرض، وأين اختفى.
 *
 * وزرّ «لقطة حالة» يأخذ لقطة إضافية بعد فتح قائمة أو طيّ شريط — لأنّ
 * الحالات ليست مقاسات، وهي أكثر ما يختلف.
 */
(() => {
  if (window.__dm) {
    window.__dm.panel?.remove();
    window.__dm.stop?.();
  }

  const SETTLE = 400; // مللي — انتظار استقرار العرض
  const MAX_SNAPS = 40;

  const px = (v) => (v === 'normal' ? null : v);
  const sides = (cs, p) => [cs[p + 'Top'], cs[p + 'Right'], cs[p + 'Bottom'], cs[p + 'Left']];
  const add = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
  const ownText = (el) =>
    [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');

  /* ————— نقاط الانكسار ————— */
  const breakpoints = new Set();
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    const scan = (list) => {
      for (const r of list || []) {
        if (r.media && r.media.mediaText && /width/.test(r.media.mediaText)) breakpoints.add(r.media.mediaText);
        if (r.cssRules) scan(r.cssRules);
      }
    };
    scan(rules);
  }
  const MEDIA = [...breakpoints].slice(0, 200);

  /* ————— لقطة واحدة ————— */
  const snapshot = (label) => {
    const elements = [];
    const palette = { text: new Map(), bg: new Map(), border: new Map() };
    const fonts = new Map();
    const radii = new Map();
    const pads = new Map();

    const walk = (el, depth) => {
      if (elements.length >= 1200 || depth > 60) return;
      const tag = el.tagName;
      if (/^(SCRIPT|STYLE|NOSCRIPT|PATH|USE|G|DEFS|SYMBOL)$/.test(tag)) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
      const r = el.getBoundingClientRect();

      const own = ownText(el);
      const style = {
        font: {
          size: cs.fontSize, weight: cs.fontWeight, lineHeight: cs.lineHeight,
          family: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
          letterSpacing: px(cs.letterSpacing), align: cs.textAlign,
        },
        color: { text: cs.color, bg: cs.backgroundColor, border: cs.borderTopWidth === '0px' ? null : cs.borderTopColor, opacity: cs.opacity },
        space: { pad: sides(cs, 'padding'), margin: sides(cs, 'margin'), gap: px(cs.gap), radius: cs.borderRadius, borderWidth: sides(cs, 'border') },
        layout: { display: cs.display, position: cs.position, flexDirection: cs.flexDirection, alignItems: cs.alignItems, overflowY: cs.overflowY },
      };
      const surface = style.color.bg !== 'rgba(0, 0, 0, 0)' || style.color.border;
      if (!own && !surface && !el.querySelector('svg')) { for (const c of el.children) walk(c, depth + 1); return; }

      add(palette.text, style.color.text);
      if (style.color.bg !== 'rgba(0, 0, 0, 0)') add(palette.bg, style.color.bg);
      if (style.color.border) add(palette.border, style.color.border);
      add(fonts, `${style.font.size}/${style.font.lineHeight} w${style.font.weight}`);
      add(radii, style.space.radius);
      add(pads, style.space.pad.join(' '));

      elements.push({
        tag,
        role: el.getAttribute('role') || null,
        label: (el.getAttribute('aria-label') || '').trim() || null,
        text: own.slice(0, 120) || null,
        box: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
        style,
        shown: r.width > 0 && r.height > 0,
      });

      for (const c of el.children) walk(c, depth + 1);
    };
    walk(document.body, 0);

    /* الأيقونات */
    const svgs = [];
    const seen = new Set();
    for (const node of document.querySelectorAll('svg')) {
      const r = node.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const html = node.outerHTML.replace(/\s+/g, ' ').slice(0, 30000);
      if (seen.has(html)) continue;
      seen.add(html);
      svgs.push({
        box: { w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
        viewBox: node.getAttribute('viewBox'),
        strokeWidth: getComputedStyle(node).strokeWidth,
        widths: [...new Set([...node.querySelectorAll('[stroke-width]')].map((n) => n.getAttribute('stroke-width')))],
        html,
      });
      if (svgs.length >= 300) break;
    }
    const uses = [...document.querySelectorAll('use')].slice(0, 200).map((u) => {
      const href = u.getAttribute('href') || u.getAttribute('xlink:href') || '';
      const id = href.startsWith('#') ? href.slice(1) : null;
      const t = id && document.getElementById(id);
      return { id, resolved: t ? t.outerHTML.replace(/\s+/g, ' ').slice(0, 30000) : null };
    });

    return {
      label: label || null,
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: window.devicePixelRatio,
      at: new Date().toISOString(),
      page: {
        bodyBg: getComputedStyle(document.body).backgroundColor,
        bodyColor: getComputedStyle(document.body).color,
        rootFont: getComputedStyle(document.documentElement).fontSize,
      },
      /* أيّ نقاط الانكسار تُطابق الآن */
      matched: MEDIA.filter((m) => { try { return matchMedia(m).matches; } catch { return false; } }),
      counts: { elements: elements.length, svgs: svgs.length },
      palette: { text: [...palette.text].sort((a, b) => b[1] - a[1]), bg: [...palette.bg].sort((a, b) => b[1] - a[1]), border: [...palette.border].sort((a, b) => b[1] - a[1]) },
      frequent: { fonts: [...fonts].sort((a, b) => b[1] - a[1]).slice(0, 25), radii: [...radii].sort((a, b) => b[1] - a[1]).slice(0, 15), pads: [...pads].sort((a, b) => b[1] - a[1]).slice(0, 20) },
      elements,
      svgs,
      uses,
    };
  };

  /* ————— التجميع ————— */
  const snaps = [];
  const keyOf = (e) => `${e.tag}|${e.role || ''}|${e.label || ''}|${(e.text || '').slice(0, 50)}`;

  const take = (label) => {
    if (snaps.length >= MAX_SNAPS) return;
    const w = window.innerWidth;
    if (!label && snaps.some((s) => s.w === w)) return; // نفس العرض
    snaps.push(snapshot(label));
    render();
  };

  let timer = null;
  const onResize = () => {
    clearTimeout(timer);
    timer = setTimeout(() => take(null), SETTLE);
  };

  /* ————— اللوحة ————— */
  const panel = document.createElement('div');
  panel.id = '__dm_panel';
  panel.style.cssText = `position:fixed;z-index:2147483647;inset-inline-start:12px;bottom:12px;background:#111;color:#ededed;
    font:12px/1.6 ui-monospace,monospace;padding:10px 12px;border-radius:10px;border:1px solid #333;
    box-shadow:0 8px 24px rgba(0,0,0,.5);display:flex;gap:10px;align-items:center;max-width:92vw`;
  document.body.appendChild(panel);

  const render = () => {
    const widths = [...new Set(snaps.map((s) => s.w))].sort((a, b) => a - b);
    panel.innerHTML = `
      <span>📐 <b>${snaps.length}</b> لقطة</span>
      <span style="color:#8f8f8f">${widths.join(' · ') || 'اسحب النافذة…'}</span>
      <button id="__dm_state" style="all:unset;cursor:pointer;background:#2a2a2a;padding:5px 9px;border-radius:6px">＋ لقطة حالة</button>
      <button id="__dm_dl" style="all:unset;cursor:pointer;background:#3a83f7;color:#fff;padding:5px 9px;border-radius:6px">⬇ تنزيل</button>
      <button id="__dm_clear" style="all:unset;cursor:pointer;color:#8f8f8f">تصفير</button>`;

    panel.querySelector('#__dm_state').onclick = () => take('حالة يدوية');
    panel.querySelector('#__dm_clear').onclick = () => { snaps.length = 0; render(); };
    panel.querySelector('#__dm_dl').onclick = () => {
      /* خريطة الظهور: لكل عنصر، في أيّ العروض وُجد */
      const map = new Map();
      for (const s of snaps) {
        for (const e of s.elements) {
          const k = keyOf(e);
          if (!map.has(k)) map.set(k, { key: k, box: e.box, widths: [] });
          map.get(k).widths.push(s.w);
        }
      }
      const appearance = [...map.values()].map((v) => ({
        ...v,
        widths: [...new Set(v.widths)].sort((a, b) => a - b),
        missingAt: [...new Set(snaps.map((s) => s.w))].filter((w) => !v.widths.includes(w)).sort((a, b) => a - b),
      }));

      const out = {
        capturedAt: new Date().toISOString(),
        url: location.href,
        breakpoints: MEDIA,
        widths: [...new Set(snaps.map((s) => s.w))].sort((a, b) => a - b),
        appearance,
        snapshots: snaps,
      };
      const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `dump-matrix-${out.widths.length}w.json`;
      a.click();
      console.log(`✓ ${a.download} — ${snaps.length} لقطة · ${out.widths.length} عرض · ${appearance.length} عنصر · ${MEDIA.length} نقطة انكسار`);
    };
  };

  window.addEventListener('resize', onResize);
  take('بداية');
  render();

  window.__dm = { snaps, take, stop: () => window.removeEventListener('resize', onResize), panel };
  console.log(`📐 dump-matrix جاهز — ${MEDIA.length} نقطة انكسار. اسحب النافذة ببطء، ثم اضغط «تنزيل».`);
})();

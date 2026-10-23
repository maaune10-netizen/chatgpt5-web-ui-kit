/**
 * capture2.js — أداة القياس، مكتوبة من جديد على مرحلتين.
 *
 *   المرحلة ١ — **التعرّف**: تُعدّ كل كائن مرئيّ في الصفحة، وتُسمّيه، وتقرأ
 *   شكله الأوّل (صندوقه، خطّه، ألوانه، حشوه، نصف قطره).
 *
 *   المرحلة ٢ — **المراقبة**: كل ٢٥٠ مللي تُعاد قراءة كل كائن، ويُسجَّل **الفرق
 *   فقط**: كبر، صغر، تحرّك، تغيّر لونه، ظهر، اختفى. ولكل تغيّر زمانه.
 *
 *   والسابق كان يأخذ لقطات كاملة لحظيّة — فيرى النتيجة لا الحركة. هذه ترى
 *   الحركة نفسها: من أيّ قيمة إلى أيّ قيمة، ومتى.
 *
 * ولماذا هذا مهمّ؟ لأنّ السؤال «كيف يتصرّف هذا الشيء؟» لا تجيبه لقطة، بل
 * **تتبّع**: `Think` من رماديّ إلى أزرق، والزرّ من ٧٢ إلى ٩٠، والشريط من ٢٤٠
 * إلى ٥٢ — كلّها فروق لها وقت.
 *
 * ملاحظة: الإرسال إلى السيرفر مستحيل من هذه الصفحة (سياسة CSP تمنع
 * `connect-src`)، فالمخرَج يُنزَّل ملفًّا ويُرسَل يدويًّا.
 */
(() => {
  if (window.__cap2) {
    try { window.__cap2.stop(); } catch {}
    document.getElementById('__cap2_panel')?.remove();
  }

  const SAMPLE_MS = 250; // إيقاع المراقبة
  const MAX_OBJECTS = 900;
  const MAX_CHANGES = 120; // لكل كائن
  const MAX_MS = 10 * 60 * 1000;

  const t0 = Date.now();
  const objects = new Map(); // key -> كائن
  const states = []; // اللقطات البنيويّة (تنقّل/مقاس/نقر)
  const hovers = [];
  const clicks = [];
  const motion = new Map();
  let seq = 0;

  /* ————————————————— أدوات ————————————————— */

  const hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  };
  const ownText = (el) =>
    [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
  const round = (n) => Math.round(n * 10) / 10;

  const nameOf = (el) => {
    const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
    const own = ownText(el);
    const role = el.getAttribute('role') || '';
    const s = (label || own || role || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 60);
    return s || el.tagName;
  };

  /* المعرّف: بنية + اسم. يبقى مع العنصر عبر تغيّر شكله — وهذا جوهر التتبّع. */
  const keyOf = (el, depth) => {
    const parts = [];
    let n = el;
    for (let i = 0; i < 3 && n && n.tagName !== 'BODY'; i++) {
      parts.unshift(n.tagName + (n.getAttribute('role') ? ':' + n.getAttribute('role') : ''));
      n = n.parentElement;
    }
    return parts.join('>') + '|' + nameOf(el) + '|' + depth;
  };

  /* الشكل المقروء — ما يتغيّر فعلًا حين يتحرّك شيء */
  const readShape = (el, cs) => {
    const r = el.getBoundingClientRect();
    return {
      x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height),
      color: cs.color,
      bg: cs.backgroundColor,
      op: round(parseFloat(cs.opacity) || 0),
      fs: cs.fontSize,
      fw: cs.fontWeight,
      r: cs.borderRadius,
      tr: cs.transform === 'none' ? '' : cs.transform,
      sh: cs.boxShadow === 'none' ? '' : cs.boxShadow.slice(0, 60),
    };
  };

  const DIFF_KEYS = ['x', 'y', 'w', 'h', 'color', 'bg', 'op', 'fs', 'fw', 'r', 'tr', 'sh'];

  /* الفرق بين شكلين — يُسجَّل الفرق فقط، لا الشكل كلّه */
  const diff = (a, b) => {
    const d = {};
    for (const k of DIFF_KEYS) if (a[k] !== b[k]) d[k] = [a[k], b[k]];
    return Object.keys(d).length ? d : null;
  };

  /* ————————————————— المرحلة ١: التعرّف ————————————————— */

  const discover = () => {
    objects.clear();
    seq = 0;

    const walk = (el, depth) => {
      if (objects.size >= MAX_OBJECTS || depth > 60) return;
      const tag = el.tagName;
      if (/^(SCRIPT|STYLE|NOSCRIPT|META|LINK|HEAD|TITLE|PATH|USE|G|DEFS|SYMBOL)$/.test(tag)) return;
      if (el.id && el.id.startsWith('__cap2')) return;
      if (el.closest && el.closest('#__cap2_panel')) return;

      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();

      const own = ownText(el);
      const hasSurface = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px' || cs.backgroundImage !== 'none';
      const hasIcon = !!el.querySelector(':scope > svg, :scope > * > svg');
      const named = el.getAttribute('aria-label') || el.getAttribute('role');

      /* الحاويات الفارغة لا تُمثّل شيئًا يُرى */
      if (!own && !hasSurface && !hasIcon && !named) {
        for (const c of el.children) walk(c, depth + 1);
        return;
      }
      if (r.width < 2 || r.height < 2) { for (const c of el.children) walk(c, depth + 1); return; }

      const key = keyOf(el, depth);
      if (objects.has(key)) { for (const c of el.children) walk(c, depth + 1); return; }

      const shape = readShape(el, cs);
      objects.set(key, {
        id: seq++,
        key,
        name: nameOf(el),
        tag,
        role: el.getAttribute('role') || null,
        depth,
        first: { t: 0, ...shape },
        changes: [],
        last: shape,
        el, // مرجع حيّ للمرحلة ٢ (لا يُخرَج)
      });

      for (const c of el.children) walk(c, depth + 1);
    };
    walk(document.body, 0);
    return objects.size;
  };

  /* ————————————————— المرحلة ٢: المراقبة ————————————————— */

  const sample = () => {
    for (const o of objects.values()) {
      const el = o.el;
      if (!el || !el.isConnected) {
        if (o.last.w !== 0) {
          o.changes.push({ t: Date.now() - t0, gone: true });
          o.last = { ...o.last, w: 0, h: 0, op: 0 };
        }
        continue;
      }
      const cs = getComputedStyle(el);
      const shape = readShape(el, cs);
      const d = diff(o.last, shape);
      if (d && o.changes.length < MAX_CHANGES) {
        o.changes.push({ t: Date.now() - t0, d });
        o.last = shape;
      }
      if (o.changes.length >= MAX_CHANGES) o.el = null; // توقّف عن هذا الكائن
    }
  };

  /* ————————————————— الحركات الجارية ————————————————— */

  const sampleMotion = () => {
    try {
      for (const a of document.getAnimations()) {
        const t = a.effect && a.effect.target;
        if (!t || (t.closest && t.closest('#__cap2_panel'))) continue;
        const timing = (a.effect.getTiming && a.effect.getTiming()) || {};
        const name = a.animationName || a.transitionProperty || '?';
        const label = nameOf(t);
        const key = name + '|' + label + '|' + timing.duration;
        if (motion.has(key)) continue;
        motion.set(key, {
          name,
          kind: a.constructor.name,
          target: label,
          duration: timing.duration,
          easing: timing.easing,
          iterations: timing.iterations,
          keyframes: (a.effect.getKeyframes ? a.effect.getKeyframes() : []).slice(0, 6)
            .map((k) => Object.fromEntries(Object.entries(k).filter(([x]) => x !== 'offset' && x !== 'computedOffset'))),
          at: Date.now() - t0,
        });
      }
    } catch {}
  };

  /* ————————————————— التحويم والنقر ————————————————— */

  const recordHover = (x, y) => {
    let el = document.elementFromPoint(x, y);
    if (!el || el.closest('#__cap2_panel')) return;
    el = el.closest('button,a,[role="button"],[role="tab"],[role="menuitem"]') || el;
    const r = el.getBoundingClientRect();
    const tip = [...document.querySelectorAll('[role="tooltip"],[role="status"],[aria-live]')]
      .find((n) => getComputedStyle(n).opacity === '1' && n.getBoundingClientRect().width > 20);
    const tb = tip ? tip.getBoundingClientRect() : null;
    const key = nameOf(el);
    const text = tip ? tip.innerText.replace(/\s+/g, ' ').trim().slice(0, 200) : null;
    if (hovers.some((h) => h.key === key && h.tip === text)) return;
    hovers.push({
      at: Date.now() - t0,
      key,
      box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      tip: text,
      tipBox: tb ? { x: Math.round(tb.x), y: Math.round(tb.y), w: Math.round(tb.width), h: Math.round(tb.height) } : null,
      placement: tb
        ? (() => {
            const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
            const tx = tb.x + tb.width / 2, ty = tb.y + tb.height / 2;
            const dx = tx - cx, dy = ty - cy;
            return {
              side: Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 'bottom' : 'top') : dx > 0 ? 'right' : 'left',
              gap: Math.round(Math.abs(dy) - (r.height / 2 + tb.height / 2)),
              clamped: tb.x < 0 || tb.right > innerWidth,
            };
          })()
        : null,
      style: tip ? (() => { const c = getComputedStyle(tip); return { fs: c.fontSize, lh: c.lineHeight, fw: c.fontWeight, bg: c.backgroundColor, color: c.color, r: c.borderRadius, pad: c.padding }; })() : null,
    });
  };

  const surfacesNow = () => {
    const m = new Map();
    for (const n of document.querySelectorAll('[role="alert"],[role="status"],[role="dialog"],[role="tooltip"],[popover]:popover-open')) {
      if (n.closest('#__cap2_panel')) continue;
      const r = n.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const text = n.innerText.replace(/\s+/g, ' ').trim().slice(0, 240);
      if (text) m.set(text, { text, role: n.getAttribute('role'), box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } });
    }
    return m;
  };

  /* ————————————————— اللقطات البنيويّة ————————————————— */

  const snapshot = (trigger) => {
    const svgs = [];
    for (const n of document.querySelectorAll('svg')) {
      const r = n.getBoundingClientRect();
      if (r.width < 4) continue;
      svgs.push({
        box: { x: Math.round(r.x), y: Math.round(r.y), w: round(r.width), h: round(r.height) },
        viewBox: n.getAttribute('viewBox'),
        widths: [...new Set([...n.querySelectorAll('[stroke-width]')].map((x) => x.getAttribute('stroke-width')))],
        fill: getComputedStyle(n).fill,
        html: n.outerHTML.replace(/\s+/g, ' ').slice(0, 40000),
      });
      if (svgs.length >= 400) break;
    }
    const st = {
      id: states.length,
      trigger,
      at: Date.now() - t0,
      url: location.href,
      viewport: { w: innerWidth, h: innerHeight, docW: document.documentElement.clientWidth, dpr: devicePixelRatio },
      theme: { data: document.documentElement.getAttribute('data-theme'), dark: matchMedia('(prefers-color-scheme: dark)').matches },
      page: {
        bodyBg: getComputedStyle(document.body).backgroundColor,
        bodyColor: getComputedStyle(document.body).color,
        lang: document.documentElement.lang,
        dir: document.documentElement.dir || 'ltr',
      },
      aside: (() => { const a = document.querySelector('aside'); if (!a) return null; const r = a.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width) }; })(),
      objects: objects.size,
      svgs,
    };
    const sig = hash(st.url + st.viewport.w + st.objects + svgs.map((s) => s.viewBox + s.box.w).join(''));
    if (states.length && states[states.length - 1].sig === sig) return false;
    st.sig = sig;
    states.push(st);
    return true;
  };

  /* ————————————————— اللوحة ————————————————— */

  const panel = document.createElement('div');
  panel.id = '__cap2_panel';
  panel.style.cssText = `position:fixed;z-index:2147483647;inset-inline-start:12px;bottom:12px;background:#0b0b0b;color:#ededed;
    font:12px/1.6 ui-monospace,monospace;padding:10px 12px;border-radius:10px;border:1px solid #2a2a2a;
    display:flex;gap:9px;align-items:center;flex-wrap:wrap;max-width:94vw`;
  document.body.appendChild(panel);

  let running = true;
  const render = () => {
    const changed = [...objects.values()].filter((o) => o.changes.length).length;
    panel.innerHTML = `
      <span>🎯 <b>${objects.size}</b> كائنًا</span>
      <span style="color:#7a7a7a">${((Date.now() - t0) / 1000).toFixed(0)}s · <b>${changed}</b> تغيّر · ${hovers.length} تحويمًا · ${clicks.length} نقرة · ${states.length} حالة</span>
      <button id="__c2_s" style="all:unset;cursor:pointer;background:${running ? '#2f2f2f' : '#1f6f3f'};padding:5px 9px;border-radius:6px">${running ? '⏸' : '▶'}</button>
      <button id="__c2_d" style="all:unset;cursor:pointer;background:#1f6f3f;color:#fff;padding:5px 9px;border-radius:6px">⬇ تنزيل</button>`;
    panel.querySelector('#__c2_s').onclick = () => { running = !running; render(); };
    panel.querySelector('#__c2_d').onclick = () => out();
  };

  const out = () => {
    const data = {
      meta: {
        tool: 'capture2',
        startedAt: new Date(t0).toISOString(),
        durationMs: Date.now() - t0,
        url: location.href,
        objects: objects.size,
        states: states.length,
        hovers: hovers.length,
        clicks: clicks.length,
        motion: motion.size,
      },
      objects: [...objects.values()].map((o) => ({
        id: o.id, name: o.name, tag: o.tag, role: o.role, key: o.key,
        first: o.first, changes: o.changes,
      })),
      states, hovers, clicks,
      motion: [...motion.values()],
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cap2-${objects.size}o-${(blob.size / 1048576).toFixed(1)}mb.json`;
    a.click();
    console.log(`✓ ${objects.size} كائنًا · ${states.length} حالة · ${(blob.size / 1048576).toFixed(1)} ميجا`);
  };

  /* ————————————————— المحرّكات ————————————————— */

  const onMove = (() => {
    let t = null;
    return (e) => { clearTimeout(t); const x = e.clientX, y = e.clientY; t = setTimeout(() => recordHover(x, y), 900); };
  })();

  const onClick = (e) => {
    const el = e.target instanceof Element ? e.target.closest('button,[role="button"],[role="tab"],a,[role="menuitem"]') : null;
    if (!el || el.closest('#__cap2_panel')) return;
    const before = surfacesNow();
    const rec = { at: Date.now() - t0, key: nameOf(el), appeared: [] };
    clicks.push(rec);
    setTimeout(() => {
      rec.appeared = [...surfacesNow()].filter(([t]) => !before.has(t)).map(([, v]) => v);
    }, 700);
  };

  const onNav = () => setTimeout(() => { if (running) { discover(); snapshot('nav'); } }, 500);
  const onResize = (() => {
    let t = null;
    return () => { clearTimeout(t); t = setTimeout(() => { if (running) { discover(); snapshot('resize'); } }, 350); };
  })();

  window.addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('click', onClick, true);
  window.addEventListener('resize', onResize);
  window.addEventListener('popstate', onNav);
  window.addEventListener('hashchange', onNav);

  /* إعادة التعرّف عند تغيّر بنيويّ كبير — الكائنات الجديدة تُضاف */
  let mutTimer = null;
  const mo = new MutationObserver(() => {
    clearTimeout(mutTimer);
    mutTimer = setTimeout(() => { if (running) discover(); }, 800);
  });
  mo.observe(document.body, { childList: true, subtree: true });

  const discovered = discover();
  snapshot('start');
  render();

  const sampleLoop = setInterval(() => {
    if (!running) return;
    if (Date.now() - t0 > MAX_MS) { running = false; render(); return; }
    sample();
    sampleMotion();
    render();
  }, SAMPLE_MS);

  window.__cap2 = {
    objects, states, hovers, clicks, motion, discover, out,
    stop: () => {
      running = false;
      clearInterval(sampleLoop);
      mo.disconnect();
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('popstate', onNav);
      window.removeEventListener('hashchange', onNav);
      render();
    },
  };

  console.log(`🎯 capture2 — تعرّف على ${discovered} كائنًا. يتتبّع الآن كل تغيّر في الشكل واللون والحجم والموضع.`);
})();

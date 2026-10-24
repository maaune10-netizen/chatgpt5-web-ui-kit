/*
 * blueprint.js — v4
 *
 * الغرض: **بلوبرنت الصفحة كاملة**، لا صورة عنها.
 *
 *  1. كل عنصر: صندوقه، نصّه، دوره، أيقوناته، إيموجيه، صوره، مؤشّره، حالته.
 *  2. كل تفاعليّ: يُمرَّر عليه تلقائيًّا، ويُسجَّل ما يفتحه (سطح/قائمة/تلميح).
 *  3. كل موسِّع (aria-expanded / سهم / «More»): يُنقر تلقائيًّا، ويُسجَّل ما يفتحه، ثم Escape.
 *  4. مخرَجَان: JSON كامل، وMarkdown مقروء بالهيكل والمقاسات.
 *
 * التشغيل: الصق الملفّ كاملًا في الكونسول. يعمل وحده ولا يحتاج ضغط زرّ.
 */
(() => {
  const PANEL = '__bp_panel';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (n) => {
    const r = n.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const visible = (n) => {
    const r = n.getBoundingClientRect();
    const s = getComputedStyle(n);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05;
  };
  const own = (n) => {
    let t = '';
    for (const c of n.childNodes) if (c.nodeType === 3) t += c.textContent;
    return t.replace(/\s+/g, ' ').trim();
  };
  const emojiOf = (n) => {
    const t = (n.textContent || '').trim();
    if (/\p{Extended_Pictographic}/u.test(t) && t.length <= 4) return t;
    const p = ['::before', '::after'].map((q) => getComputedStyle(n, q).content).join(' ');
    const m = p.match(/\p{Extended_Pictographic}/gu);
    return m ? m.join('') : null;
  };
  const iconsOf = (n) =>
    [...n.querySelectorAll('svg,img')]
      .filter(visible)
      .slice(0, 10)
      .map((i) => {
        const u = i.querySelector ? i.querySelector('use') : null;
        return {
          kind: i.tagName.toLowerCase(),
          box: box(i),
          ref: u ? u.getAttribute('href') || u.getAttribute('xlink:href') : i.getAttribute('src'),
          bg: getComputedStyle(i).backgroundImage.slice(0, 100),
        };
      });

  /* ---------- الأسطح الظاهرة ---------- */
  const surfaceRoots = () =>
    [...document.querySelectorAll('[role="menu"],[role="dialog"],[role="listbox"],[role="tooltip"],[data-state="open"]')].filter(
      (n) => !n.closest('#' + PANEL) && visible(n) && box(n).w > 40 && box(n).w < 900,
    );

  const surfaceOf = (root) => ({
    role: root.getAttribute('role') || root.tagName.toLowerCase(),
    box: box(root),
    text: (root.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400),
    items: [...root.querySelectorAll('[role="menuitem"],[role="menuitemradio"],[role="option"],button,a')]
      .filter(visible)
      .slice(0, 30)
      .map((b) => ({
        text: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        box: box(b),
        icons: iconsOf(b),
        emoji: emojiOf(b),
        expanded: b.getAttribute('aria-expanded'),
        checked: b.getAttribute('aria-checked'),
      })),
  });

  /* ---------- المسح ---------- */
  const all = [...document.querySelectorAll('body *')].filter((n) => !n.closest('#' + PANEL) && visible(n));

  const nodes = all.map((n) => {
    const s = getComputedStyle(n);
    return {
      tag: n.tagName.toLowerCase(),
      role: n.getAttribute('role'),
      text: own(n).slice(0, 200) || null,
      box: box(n),
      font: { size: s.fontSize, weight: s.fontWeight, line: s.lineHeight, family: s.fontFamily.split(',')[0] },
      color: s.color,
      bg: s.backgroundColor,
      radius: s.borderRadius,
      padding: s.padding,
      gap: s.gap,
      display: s.display,
      cursor: s.cursor,
      overflow: s.overflow,
      icons: iconsOf(n),
      emoji: emojiOf(n),
      img: n.tagName === 'IMG' ? n.src : null,
      bgImage: s.backgroundImage !== 'none' ? s.backgroundImage.slice(0, 140) : null,
      disabled: n.disabled || n.getAttribute('aria-disabled') === 'true' || null,
      expanded: n.getAttribute('aria-expanded'),
      label: n.getAttribute('aria-label') || n.title || null,
      href: n.getAttribute('href') || null,
    };
  });

  /* ---------- المرشّحون للتحويم والنقر ---------- */
  const hovCandidates = all
    .filter((n) => {
      const s = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      return r.width > 12 && r.height > 12 && (n.tagName === 'BUTTON' || n.tagName === 'A' || n.getAttribute('role') === 'menuitem' || s.cursor === 'pointer');
    })
    .slice(0, 28);

  const expandCandidates = hovCandidates.filter(
    (n) => n.getAttribute('aria-expanded') === 'false' || /chevron|caret|arrow/i.test(n.innerHTML.slice(0, 800)),
  );

  const run = async () => {
    const result = { url: location.href, at: new Date().toISOString(), viewport: { w: innerWidth, h: innerHeight }, nodes, hovers: [], clicks: [] };

    /* 1) تحويم على كل مرشّح */
    for (const n of hovCandidates) {
      try {
        const r = n.getBoundingClientRect();
        const cx = Math.round(r.x + r.width / 2);
        const cy = Math.round(r.y + r.height / 2);
        n.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: cx, clientY: cy }));
        n.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: cx, clientY: cy }));
        n.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: cx, clientY: cy }));
        n.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, clientX: cx, clientY: cy }));
        n.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx, clientY: cy }));
        await sleep(300);
        const surf = surfaceRoots().map(surfaceOf);
        const cur = getComputedStyle(n);
        result.hovers.push({
          target: { text: own(n).slice(0, 60), label: n.getAttribute('aria-label'), box: box(n), tag: n.tagName.toLowerCase() },
          cursor: cur.cursor,
          cursorAfter: cur.cursor,
          surfaces: surf,
        });
      } catch (e) {
        /* عنصر اختفى أثناء المسح */
      }
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    /* 2) نقر على كل موسِّع */
    for (const n of expandCandidates.slice(0, 8)) {
      try {
        const before = surfaceRoots().length;
        n.click();
        await sleep(480);
        const surf = surfaceRoots().map(surfaceOf);
        result.clicks.push({
          target: { text: own(n).slice(0, 60), label: n.getAttribute('aria-label'), box: box(n) },
          before,
          after: surf.length,
          surfaces: surf,
        });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(240);
      } catch (e) {
        /* تجاهل */
      }
    }

    return result;
  };

  /* ---------- Markdown مقروء ---------- */
  const md = (r) => {
    const L = [];
    L.push('# ' + r.url);
    L.push(`viewport ${r.viewport.w}×${r.viewport.h} · ${r.nodes.length} nodes`);
    L.push('\n## الهيكل والمقاسات');
    for (const n of r.nodes) {
      if (n.box.w < 8 || n.box.h < 8) continue;
      const bits = [`\`${n.tag}\``, `${n.box.x},${n.box.y} ${n.box.w}×${n.box.h}`];
      if (n.text) bits.push(`"${n.text.slice(0, 50)}"`);
      if (n.emoji) bits.push(`emoji ${n.emoji}`);
      if (n.icons.length) bits.push(`icons ${n.icons.length}(${n.icons.map((i) => (i.ref || '').split('/').pop()).join(',')})`);
      if (n.font.size !== '16px') bits.push(`${n.font.size}/${n.font.line} ${n.font.weight}`);
      if (n.radius !== '0px') bits.push(`r ${n.radius}`);
      L.push('- ' + bits.join(' · '));
    }
    L.push('\n## التحويم');
    r.hovers.forEach((h, i) => {
      if (!h.surfaces.length) return;
      L.push(`\n### ${i}. "${h.target.text || h.target.label}" @${h.target.box.x},${h.target.box.y}`);
      for (const s of h.surfaces) {
        L.push(`- ${s.role} ${s.box.w}×${s.box.h}: ${s.text.slice(0, 120)}`);
        for (const it of s.items) L.push(`  - ${it.emoji || ''} ${it.text || '(icon)'} ${it.box.w}×${it.box.h}${it.expanded ? ' ▸' : ''}`);
      }
    });
    L.push('\n## النقر');
    r.clicks.forEach((c, i) => {
      L.push(`\n### ${i}. "${c.target.text || c.target.label}" — surfaces ${c.before} → ${c.after}`);
      for (const s of c.surfaces) {
        L.push(`- ${s.role} ${s.box.w}×${s.box.h}: ${s.text.slice(0, 120)}`);
        for (const it of s.items) L.push(`  - ${it.emoji || ''} ${it.text || '(icon)'}`);
      }
    });
    return L.join('\n');
  };

  /* ---------- اللوحة ---------- */
  const panel = document.createElement('div');
  panel.id = PANEL;
  panel.style.cssText =
    'position:fixed;right:12px;bottom:12px;z-index:2147483647;background:#111;color:#eee;font:12px/1.5 ui-monospace,monospace;padding:10px 12px;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.6);max-width:320px';
  panel.innerHTML = '<b>blueprint</b><div id="__bp_s">جارٍ الفحص…</div>';
  document.body.appendChild(panel);
  const say = (t) => (document.getElementById('__bp_s').textContent = t);

  const save = (name, data, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  (async () => {
    const r = await run();
    window.__bp = r;
    say(`${r.nodes.length} عنصر · ${r.hovers.filter((h) => h.surfaces.length).length} تحويم بسطح · ${r.clicks.filter((c) => c.after > c.before).length} نقرة بسطح`);
    panel.insertAdjacentHTML(
      'beforeend',
      '<div style="display:flex;gap:6px;margin-top:8px">' +
        '<button id="__bp_j" style="flex:1;padding:6px;border-radius:6px;background:#2a2a2a;color:#eee">JSON</button>' +
        '<button id="__bp_m" style="flex:1;padding:6px;border-radius:6px;background:#2a2a2a;color:#eee">Markdown</button></div>',
    );
    document.getElementById('__bp_j').onclick = () => save('blueprint.json', JSON.stringify(r, null, 2), 'application/json');
    document.getElementById('__bp_m').onclick = () => save('blueprint.md', md(r), 'text/markdown');
  })();
})();

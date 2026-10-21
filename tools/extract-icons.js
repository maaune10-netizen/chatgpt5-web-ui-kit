/**
 * استخراج أيقونات chatgpt.com — يُلصق في Console المتصفّح.
 *
 * الخطوات:
 *   ١) افتح https://chatgpt.com وسجّل الدخول.
 *   ٢) F12 (أو ⌥⌘I) → تبويب Console.
 *   ٣) الصق هذا الملفّ كاملًا ثم Enter.
 *   ٤) سيُنزّل `chatgpt-icons.json` — ارفعه على https://bahr-vps.tail18374c.ts.net:8445/
 *
 * ويفعل ثلاثة أشياء، لأنّ الأيقونات في المواقع الحديثة تُرسم بثلاث طرق:
 *   • `<svg>` مضمَّن            → يأخذ الـ outerHTML كاملًا
 *   • `<img src="….svg">`      → يأخذ الرابط
 *   • `<use href="#icon-…">`   → يأخذ مراجع الـ sprite (وأيقونات الموقع
 *                                 غالبًا sprite واحد)
 *
 * ولا يحتاج أي مكتبة، ولا يرسل شيئًا إلى أي مكان: يُنزّل ملفًّا عندك فقط.
 */
(() => {
  const sizeOf = (el) => {
    const r = el.getBoundingClientRect();
    return `${Math.round(el.getAttribute('width') || r.width)}x${Math.round(el.getAttribute('height') || r.height)}`;
  };

  /* اسم تقريبي: من aria-label، ثم نصّ الزرّ الأب، ثم أوّل سطر نصّ */
  const nameOf = (el) => {
    const labelled = el.closest('[aria-label]');
    if (labelled) return labelled.getAttribute('aria-label');
    const btn = el.closest('button, a, [role="button"], [role="menuitem"]');
    const txt = (btn?.innerText || '').trim().replace(/\s+/g, ' ');
    if (txt) return txt.slice(0, 40);
    const parent = el.parentElement;
    return ((parent?.innerText || '').trim().split('\n')[0] || '').slice(0, 40);
  };

  const icons = [];
  const seen = new Set();

  for (const el of document.querySelectorAll('svg')) {
    const html = el.outerHTML;
    if (html.length < 50) continue; // شعارات فارغة/زخرفية
    const key = `${el.getAttribute('viewBox') || ''}|${el.innerHTML.length}|${el.innerHTML.slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    icons.push({ name: nameOf(el), size: sizeOf(el), viewBox: el.getAttribute('viewBox'), html });
  }

  const imgs = [...document.querySelectorAll('img')]
    .filter((i) => /\.svg(\?|$)/.test(i.src) || i.src.startsWith('data:image/svg'))
    .map((i) => ({ name: nameOf(i), size: `${i.width}x${i.height}`, src: i.src.length > 400 ? i.src.slice(0, 120) + '…' : i.src }));

  const uses = [
    ...new Set(
      [...document.querySelectorAll('use')]
        .map((u) => u.getAttribute('href') || u.getAttribute('xlink:href'))
        .filter(Boolean),
    ),
  ];

  /* خريطة sprite كاملة إن وُجدت: غالبًا SVG واحد مخفيّ فيه كل الأيقونات */
  const sprites = [...document.querySelectorAll('svg')]
    .filter((s) => s.querySelector('symbol'))
    .map((s) => ({
      id: s.id || null,
      symbols: [...s.querySelectorAll('symbol')].map((x) => ({ id: x.id, viewBox: x.getAttribute('viewBox'), html: x.innerHTML })),
    }));

  const out = {
    url: location.href,
    at: new Date().toISOString(),
    inlineSvg: icons.length,
    imgs: imgs.length,
    useRefs: uses.length,
    spriteSymbols: sprites.reduce((n, s) => n + s.symbols.length, 0),
    icons,
    imgs,
    uses,
    sprites,
  };

  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'chatgpt-icons.json';
  document.body.appendChild(a);
  a.click();
  a.remove();

  console.log(
    `✓ أُنزل chatgpt-icons.json — SVG مضمَّن: ${icons.length} · صور SVG: ${imgs.length} · مراجع sprite: ${uses.length} · رموز sprite: ${out.spriteSymbols}`,
  );
})();

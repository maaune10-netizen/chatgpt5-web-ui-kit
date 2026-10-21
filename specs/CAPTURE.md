# capture.js — ما يأخذه بالضبط

أداة واحدة، تُشغَّل مرّة، تعمل بينما تتنقّل، وتُخرج مخطّطًا كاملًا.
هذه قائمة **ما يُستخرج** — بندًا بندًا، لا «كل شيء».

> القاعدة: كل حقل هنا **يُقرأ من المتصفّح**، لا يُخمَّن. وما لا يُقرأ يُترك
> فارغًا بدل أن يُملأ بتقدير.

---

## ١. هوية الحالة — ما يجعل اللقطة مختلفة عن أختها

| الحقل | من أين |
|---|---|
| `url` · `path` · `hash` | `location` |
| `title` | `document.title` |
| `theme` | `data-theme` / `prefers-color-scheme` / `color-scheme` |
| `htmlAttrs` | كل `data-*` و`class` و`lang` و`dir` على `<html>` |
| `viewport` | `innerWidth/Height` · `dpr` · `scrollX/Y` |
| `trigger` | `nav` · `interval` · `mutation` · `resize` · `manual` |
| `seq` · `at` | ترتيب اللقطة ووقتها |

**والحالة تُعرَّف ببصمة**: `hash(url + viewport + الأسطح المفتوحة)`. فـ٢٠ ثانية
بلا حركة لا تُنتج ٢٥ لقطة متطابقة.

---

## ٢. الصناديق — الهندسة

- `box` مطلق (x,y,w,h) **و**نسبةً إلى الأب.
- `scroll` — `scrollWidth/Height` مقابل `clientWidth/Height` → **هل النصّ مقصوص؟**
- `position` · `zIndex` · `stackingContext` · `positionedAncestor`
- `visible` — هل يُرى فعلًا (داخل الشاشة، بلا `clip`، وبلا `opacity:0`).
- `tag` · `id` · `classes` · `role` · `aria-*` · `accessibleName`.

---

## ٣. الأنماط المحسوبة

`display` · `position` · `flexDirection/Wrap/Grow/Shrink/Basis` · `gridTemplate*` ·
`gap` · `alignItems` · `justifyContent` · `padding` · `margin` · `border`
(سماكة/لون/نمط لكل جهة) · `borderRadius` · `outline` · `boxShadow` ·
`filter` · `backdropFilter` · `transform` · `opacity` · `overflow` · `cursor` ·
`pointerEvents` · `transition` · `animation`.

**والحشو والهامش لكل جهة على حدة** — لا اختصار، لأنّ الاختصار يُخفي انحيازًا.

---

## ٤. الخطّ والنصّ

- `fontFamily` (المحلول + سلسلة البدائل) · `fontSize` · `fontWeight` ·
  `lineHeight` · `letterSpacing` · `wordSpacing` · `fontFeatureSettings` ·
  `webkitFontSmoothing`.
- `textAlign` · `textTransform` · `textDecoration` · `whiteSpace` · `textOverflow`.
- `color` · `opacity`.
- `text` (النصّ الخاصّ) · `textFull` (مع الأبناء) · `placeholder` · `title` · `alt`.
- **مقيس لا مقروء**: `textWidth` · `lineCount` (من `Range`) · `truncated` (`scrollWidth > clientWidth`).

---

## ٥. الألوان

- لكل عنصر: `color` · `backgroundColor` · `borderColor` · `outlineColor` ·
  `shadowColors` · `gradient` (المحطّات) · `backgroundImage`.
- `palette` — كل لون بعدده، مصنّفًا (نصّ · خلفية · حدّ · أيقونة).
- **`contrast`** — لكل نصّ: خلفيّته الفعلية (بصعود الآباء حتى لون معتم) + نسبة
  التباين WCAG. وهو ما يكشف «باهت» و«أبيض» برقم لا بوصف.
- `cssVariables` — كل `--*` بقيمتها **لكل محدّد**، ثم **قيمتها المحلولة على
  كل عنصر** (لأنّ نفس المتغيّر يختلف بين الغامق والفاتح).

---

## ٦. الأيقونات والأصول

- كل `<svg>`: `outerHTML` · `viewBox` · `fill` · `stroke` · **`strokeWidth`
  كما هو مكتوب في الشكل** · عدد المسارات · صندوقه.
- كل `<use>`: مرجعه **محلولًا** إلى `symbol` (المرجع ليس شكلًا).
- كل `<img>`: `src` · `srcset` · `alt` · الطبيعيّ مقابل المعروض.
- كل `background-image` و`mask-image`: الرابط، ونسبته إلى عنصره.
- **`::before` و`::after`** — `content` وأنماطهما. وكثير من الأيقونات تعيش هناك
  ولا تظهر في `outerHTML` إطلاقًا.
- `resources` من `performance.getEntriesByType('resource')`: كل ملفّ حُمّل،
  بنوعه وحجمه — قائمة الأصول التي يمكن تنزيلها كما هي.
- (اختياري) **البايتات**: تنزيل الأصول من نفس الأصل وتحويلها إلى `data:`.

---

## ٧. الهيكل والتخطيط

- `regions`: `header` · `aside` · `main` · `footer` · `nav` · `dialog`.
- `landmarks` — كل `role` دلاليّ.
- `scrollContainers` — كل عنصر يُمرَّر، ومداه.
- `blueprint` — مجموع الصناديق المطلقة = الصفحة تُعاد رسمًا من الملفّ وحده.

---

## ٨. الحالات والتفاعل

- `openSurfaces`: `[role=dialog]` · `[aria-expanded=true]` · `[data-state=open]` ·
  `[popover]` · `.open`.
- `interactionCss` — قواعد `:hover` · `:focus` · `:focus-visible` · `:active` ·
  `[data-*]` من أوراق الأنماط. **هي مصدر أنماط التفاعل**، ولا تُرى في لقطة ساكنة.
- `mediaMatched` — أيّ نقاط الانكسار تُطابق الآن.
- **`diff`** من الحالة السابقة: أُضيف · حُذف · تحرّك · تغيّر مقاسه · تغيّر لونه.
  وعليه يُقال «الشريط الجانبي اختفى عند 430» كحقيقة.

---

## ٩. الاستجابة

- `breakpoints` — كل `@media (width …)` من `cssRules`.
- `appearance` — لكل عنصر: في أيّ العروض وُجد، وفي أيّها غاب.
- `crossState` — مقارنة العرض نفسه بين صفحتين.

---

## ١٠. الروابط والتنقّل

- `links` — كل `a[href]` بنصّه → جرد الصفحات.
- `siteMap` — الصفحات التي زُرتها أثناء التشغيل، بترتيبها وزمنها.

---

## المخرَج

ملفّ JSON واحد:

```
{
  meta: { startedAt, endedAt, url, breakpoints, cssVariables },
  widths: [...],
  states: [ { id, trigger, url, viewport, page, elements, svgs, assets,
              palette, contrast, openSurfaces, mediaMatched, diff } ],
  appearance: [...],
  links: [...],
  resources: [...],
  siteMap: [...]
}
```

**تقدير الحجم:** ٤٠ حالة × ~٣٠٠ عنصر × ~١٫٥ ك.ب ≈ **١٨ ميجا**. مقبول.

---

## التشغيل

تُشغَّل مرّة → تبدأ فورًا → تعمل **حتى تضغط «إيقاف»** (بسقف ٥ دقائق).
وأنت تتنقّل وتفتح القوائم وتغيّر المقاس. اللوحة تُظهر: عدد الحالات،
الصفحات المزارة، والحجم التقديري — ثم زرّ واحد يُنزّل.

Design Dump — Figma plugin
==========================

HOW TO INSTALL (30 seconds)
1. Unzip this folder somewhere permanent (e.g. Documents/design-dump).
2. Open Figma (desktop app or figma.com in Chrome).
3. Right-click the canvas  ->  Plugins  ->  Development  ->  Import plugin from manifest…
   (or: menu  ->  Plugins  ->  Development  ->  Import plugin from manifest…)
4. Pick the manifest.json inside the unzipped folder.
5. Done — it now appears under Plugins -> Development -> Design Dump.

UPDATING AN ALREADY-IMPORTED COPY
Figma does not re-read a changed manifest. So:
  Plugins -> Development -> Manage plugins in development -> "..." -> Remove
then import the manifest again.

VERSION 2 FIXES
  - "flatMap is not a function" on whole-file export (older Figma engines have
    no Array.prototype.flatMap). Replaced with plain loops.
  - SVG export silently produced 0 files: it filtered on a flag that only exists
    on the serialized objects, not on the real nodes.
  - Every step now reports progress by name, so any failure says where.
  - Guarded for older Figma: no loadAllPagesAsync, missing apiVersion, and an
    undefined selection no longer break it.

HOW TO USE
1. Open the file you want to export (e.g. the ChatGPT 5 Web UI Kit).
2. Select the frames you want (shift-click, or drag a marquee over the whole page).
3. Run: Plugins -> Development -> Design Dump.
4. Click "Use selection"  (or "Use whole file" for everything).
5. Tick "Also export SVG for every vector" if you want the icons as SVG too.
6. Press "Export JSON", then "Download .json".

The JSON contains every node with: position, size, auto-layout direction,
padding, gaps, fills (with alpha), strokes, corner radii, effects/shadows,
text content + font/size/weight/line-height/letter-spacing, and component
references — plus the SVG paths when the checkbox is on.

Tip: exporting the whole file can produce a large JSON. Start with a
selection (one screen at a time) if it feels slow.

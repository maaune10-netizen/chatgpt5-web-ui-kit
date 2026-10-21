#!/usr/bin/env node
/**
 * sprite-extract.mjs — يفكّ رموز شريحة SVG إلى ملفّات مستقلّة.
 *
 *   node tools/sprite-extract.mjs <sprite.svg> <outDir> id1 id2 ...
 *
 * والشريحة تظهر **فارغة** حين تُفتح: كلّ شكل داخل `<symbol>` معرَّف بالاسم،
 * ولا يُرسم حتى يُستدعى بـ`<use>`. فالمحتوى موجود والفراغ مرئيّ فقط.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [, , spritePath, outDir, ...ids] = process.argv;
if (!spritePath || !outDir || !ids.length) {
  console.error('usage: sprite-extract.mjs <sprite.svg> <outDir> id1 id2 …');
  process.exit(1);
}
const src = readFileSync(spritePath, 'utf8');
mkdirSync(outDir, { recursive: true });

let ok = 0;
for (const id of ids) {
  const re = new RegExp(`<symbol[^>]*id="${id}"[^>]*>([\\s\\S]*?)</symbol>`);
  const m = re.exec(src);
  if (!m) { console.log(`  ✗ ${id}`); continue; }
  const open = src.slice(src.indexOf(`id="${id}"`) - 400, src.indexOf(`id="${id}"`));
  const vb = /viewBox="([^"]+)"/.exec(open)?.[1] || '0 0 20 20';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="currentColor">${m[1]}</svg>`;
  writeFileSync(join(outDir, `${id}.svg`), svg);
  console.log(`  ✓ ${id}  ${vb}  ${m[1].length} حرفًا`);
  ok++;
}
console.log(`\n${ok}/${ids.length} → ${outDir}`);

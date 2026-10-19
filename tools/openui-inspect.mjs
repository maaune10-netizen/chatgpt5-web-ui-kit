#!/usr/bin/env node
/**
 * يقرأ مكتبة OpenUI **من الحزمة المثبَّتة** لا من التوثيق على الويب.
 *
 * لأنّ الترتيب الذي يفرضه الـskill نفسه: كود `node_modules` أولًا، ثم ملفّات
 * المشروع، ثم GitHub، ثم الموقع. وقد رأينا مرّات أنّ الويب يتأخّر عن المنشور.
 *
 *   node tools/openui-inspect.mjs            # المجموعات والأعداد
 *   node tools/openui-inspect.mjs --prompt   # نصّ التعليمات كاملًا (204 سطرًا)
 *   node tools/openui-inspect.mjs --schema   # مخطّط الخصائص JSON
 *
 * ونصّ التعليمات هو ما يُرسل للنموذج — وهو أيضًا **مرجع الكتابة باليد**،
 * فمنه عرفت ترتيب الوسائط لكل مكوّن في `src/lib/openui-samples.ts`.
 */
import { writeFileSync } from 'node:fs';
import { openuiLibrary, openuiChatLibrary, openuiComponentGroups, openuiChatComponentGroups } from '@openuidev/react-ui';

const arg = process.argv[2];

if (arg === '--prompt') {
  for (const [name, lib] of [['openui', openuiLibrary], ['openui-chat', openuiChatLibrary]]) {
    const text = lib.prompt();
    const file = `/tmp/${name}-prompt.txt`;
    writeFileSync(file, text);
    console.log(`${file}  ${text.length} chars, ${text.split('\n').length} lines`);
  }
} else if (arg === '--schema') {
  for (const [name, lib] of [['openui', openuiLibrary], ['openui-chat', openuiChatLibrary]]) {
    const file = `/tmp/${name}-schema.json`;
    writeFileSync(file, JSON.stringify(lib.toJSONSchema(), null, 1));
    console.log(`${file}  root=${lib.root}`);
  }
} else {
  for (const [name, groups, lib] of [
    ['openuiLibrary', openuiComponentGroups, openuiLibrary],
    ['openuiChatLibrary', openuiChatComponentGroups, openuiChatLibrary],
  ]) {
    const total = groups.reduce((n, g) => n + g.components.length, 0);
    console.log(`\n${name} — root=${lib.root}, ${total} components in ${groups.length} groups`);
    for (const g of groups) console.log(`  ${g.name.padEnd(22)} ${g.components.length.toString().padStart(3)}  ${g.components.join(', ')}`);
  }
}

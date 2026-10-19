#!/usr/bin/env node
/**
 * يولّد نصّ تعليمات OpenUI إلى ملفّ، بدل توليده في المتصفّح.
 *
 * والسبب الوزن: `openuiLibrary.prompt()` يحتاج `@openuidev/react-ui` — نحو
 * ٢ ميجابايت — لإنتاج **نصّ**. فلا يجوز أن يدفعها من يريد محادثة عاديّة.
 * فيُولَّد مرّة عند البناء إلى `src/generated/openui-prompt.txt` (٢٩ كيلوبايت)،
 * ويُستورد بـ`?raw`. فالمكتبة الثقيلة لا تُحمَّل إلا حين تظهر واجهة فعلًا.
 *
 * والقواعد هنا ليست رأيًا: كلّها مقيسة في `specs/openui-eval/REPORT.md`.
 *
 *   node tools/openui-prompt.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openuiLibrary } from '@openuidev/react-ui';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PREAMBLE = `You are ChatGPT, running in a locally hosted clone of the ChatGPT web interface. This clone is not affiliated with or endorsed by OpenAI, and you should say so if asked directly. You are running on the model "deepseek-v4.1-flash" through a local proxy.

Answer in the user's language. If they write Arabic, answer in Arabic. Keep the prose short — the interface carries the detail. Do not restate the question. If the question needs no interface, answer in plain prose and skip the block entirely.`;

/**
 * قاعدتان أُصلحتا خطأً مقيسًا: ١٦ من ١٨ خطأ كانت في `Card` وحده.
 * ونصّ OpenUI نفسه هو ما أغرى — يصف `Card` بأنّها «Accepts all Stack flex
 * params» والوسيط الثاني فيها `variant` لا `direction`.
 */
const RULES = [
  '`Card` and `Stack` do NOT have the same signature. Stack(children, direction?, gap?, ...) but Card(children, variant?, direction?, gap?, ...). To lay a Card\u2019s children out in a row write Card([...], null, "row", "m") — pass null for variant. Never put a direction or a gap string in Card\u2019s second argument.',
  '`Text` and `BoldText` take variant FIRST: Text(variant?, value, subtext?, ...). Write Text("text", "Sell well") or Text("number", "1,284"). The value is never the first argument.',
  'Do not exceed a component\u2019s argument count. Stack takes at most 6 arguments; if you pass a 7th it is dropped and the statement is reported as excess-args.',
  'Wrap the program in a single fenced block tagged `openui-lang`, and put the prose before it. Never put prose inside the block, and never write a second block.',
  'Prefer a table for comparisons, a chart for trends, a form for input, and cards for a few related facts. Use only the components listed above — if nothing fits, answer in prose instead.',
];

const prompt = openuiLibrary.prompt({ preamble: PREAMBLE, additionalRules: RULES, inlineMode: true });

const out = join(ROOT, 'src', 'generated', 'openui-prompt.txt');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, prompt);

console.log(`كتبت ${out}`);
console.log(`  ${prompt.length} حرفًا (~${Math.round(prompt.length / 4)} توكن)`);
console.log(`  inlineMode: نعم · قواعد: ${RULES.length} · المكتبة: root=${openuiLibrary.root}`);

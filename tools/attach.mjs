/*
 * attach.mjs — أتصل بمتصفحك بدل أن أطلب منه ملفّات.
 *
 * أنت تشغّل Chrome مرّة واحدة بمنفذ تصحيح، وتسجّل الدخول إلى chatgpt.com.
 * بعدها أنا أفتح الصفحات، أمرّر على كل شيء، أنقر كل موسِّع، ألتقط البلوبرنت
 * وأصور الشاشة — بلا أن تلمس شيئًا.
 *
 * التشغيل من عندك (مرّة واحدة):
 *   macOS:
 *     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *       --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-clone" \
 *       https://chatgpt.com
 *   Windows:
 *     "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
 *       --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\.chrome-clone" ^
 *       https://chatgpt.com
 *
 * ثم من عندي:
 *   node tools/attach.mjs https://chatgpt.com/scheduled scheduled
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const URL_ARG = process.argv[2] || 'https://chatgpt.com/';
const NAME = process.argv[3] || 'page';
const OUT = '/home/deploy/refs/chatgpt/blueprints';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages()[0] || (await ctx.newPage());

await page.goto(URL_ARG, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);

/* أداة البلوبرنت تُحقن كما هي — نفس التي تُلصق يدويًّا */
await page.evaluate(readFileSync(new URL('./blueprint.js', import.meta.url), 'utf8'));
await page.waitForSelector('#__bp_m', { timeout: 120000 });

const summary = await page.evaluate(() => document.getElementById('__bp_s').textContent);
const data = await page.evaluate(() => window.__bp);

writeFileSync(`${OUT}/${NAME}.json`, JSON.stringify(data, null, 2));
await page.screenshot({ path: `${OUT}/${NAME}.png`, fullPage: false });

/* لقطة كاملة طويلة — تكشف ما تحت الطيّة */
try {
  await page.screenshot({ path: `${OUT}/${NAME}-full.png`, fullPage: true });
} catch {}

console.log(`${NAME}: ${summary}`);
console.log(`→ ${OUT}/${NAME}.json`);
await browser.close();

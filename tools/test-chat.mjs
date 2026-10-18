/* يحتاج الخادم والوسيط قائمين. شغّله من جذر المشروع. */
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERR ' + String(e).slice(0, 180)));
p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 180)); });
await p.goto('http://127.0.0.1:5180/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);

await p.click('textarea');
await p.fill('textarea', 'اكتب جملة واحدة: ما هي عاصمة المغرب؟');
await p.waitForTimeout(200);
await p.keyboard.press('Enter');
console.log('sent — waiting for the stream…');

let text = '';
for (let i = 0; i < 80; i++) {
  await p.waitForTimeout(500);
  text = await p.evaluate(() => document.body.innerText);
  if (/الرباط|Rabat/.test(text)) break;
  if (/error|تعذّر|invalid/i.test(text) && i > 6) break;
}
const tail = text.split('\n').filter(Boolean).slice(-14).join('\n');
console.log('--- آخر ما ظهر ---');
console.log(tail);
await p.screenshot({ path: '/tmp/app-chat.png' });
if (errs.length) { console.log('--- errors ---'); errs.slice(0,4).forEach(e=>console.log('  '+e)); }
await b.close();

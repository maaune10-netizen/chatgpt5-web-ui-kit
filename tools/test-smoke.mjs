/* يحتاج: الوسيط + خادم التطوير. شغّله من جذر المشروع. */
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));

const ok = (label, v) => console.log(`  ${v ? '✓' : '✗'} ${label}`);

await p.goto('http://127.0.0.1:5180/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1600);
ok('app boots', await p.evaluate(() => !!document.querySelector('textarea')));

/* إرسال حقيقي */
await p.fill('textarea', 'أجب بكلمة واحدة: ما لون السماء؟');
await p.keyboard.press('Enter');
let answered = false;
for (let i = 0; i < 50; i++) {
  await p.waitForTimeout(600);
  const t = await p.evaluate(() => document.body.innerText);
  if (/أزرق|blue|سماء/i.test(t) && !/Thinking/.test(t)) { answered = true; break; }
}
ok('streamed a real answer', answered);
/* الأزرار تظهر بعد انتهاء البثّ، لا قبله */
for (let i = 0; i < 20; i++) {
  if (await p.evaluate(() => !!document.querySelector('button[aria-label="Copy"]'))) break;
  await p.waitForTimeout(400);
}

/* الأزرار */
const actions = await p.evaluate(() => document.querySelectorAll('button[aria-label="Copy"],button[aria-label="Good response"],button[aria-label="Bad response"],button[aria-label="Share"],button[aria-label="Try again"],button[aria-label="More actions"]').length);
ok('six message actions (' + actions + ')', actions === 6);

/* الاستمرارية بعد إعادة التحميل */
const before = await p.evaluate(() => document.querySelectorAll('aside button').length);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const after = await p.evaluate(() => document.querySelectorAll('aside button').length);
ok('conversation persisted (' + before + '→' + after + ')', after > 0);

/* وضع التصميم */
await p.goto('http://127.0.0.1:5180/#design', { waitUntil: 'networkidle' });
let loaded = false;
for (let i = 0; i < 20; i++) {
  await p.waitForTimeout(500);
  const n = await p.evaluate(() => (document.body.innerText.match(/Screens\s*(\d+)/) || [])[1]);
  if (Number(n) >= 24) { loaded = true; break; }
}
ok('design mode loads all 24 screens', loaded);

/* الحساب والإعدادات */
await p.goto('http://127.0.0.1:5180/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.click('button:has-text("Username")'); await p.waitForTimeout(400);
ok('account menu (8 items)', (await p.evaluate(() => document.querySelectorAll('[role="menuitem"]').length)) === 8);
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.click('button[aria-label="Settings"]'); await p.waitForTimeout(400);
ok('settings opens', await p.evaluate(() => document.body.innerText.includes('Test connection')));
await p.click('button:has-text("Test connection")');
await p.waitForTimeout(2500);
const t = await p.evaluate(() => document.body.innerText);
ok('connection test: ' + (t.match(/الاتصال ناجح[^\n]*/) || ['failed'])[0], /الاتصال ناجح/.test(t));

console.log(errs.length ? '\npage errors:\n  ' + errs.slice(0,4).join('\n  ') : '\nno page errors');
await b.close();

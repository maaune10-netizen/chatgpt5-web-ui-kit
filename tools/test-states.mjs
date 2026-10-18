/* يحتاج الخادم والوسيط قائمين. شغّله من جذر المشروع. */
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await p.goto('http://127.0.0.1:5180/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);

console.log('=== الدردشة المؤقتة ===');
await p.click('button:has-text("Temporary chat")');
await p.waitForTimeout(600);
console.log('  banner:', await p.evaluate(() => document.body.innerText.includes('won’t appear')));
const before = await p.evaluate(() => document.querySelectorAll('aside button').length);
await p.fill('textarea', 'test temp');
await p.keyboard.press('Enter');
await p.waitForTimeout(600);
const after = await p.evaluate(() => [...document.querySelectorAll('aside button')].map(b=>b.innerText.trim()).filter(t=>t==='test temp').length);
console.log('  appears in the sidebar list:', after, '(should be 0)');
await p.screenshot({ path: '/tmp/ui-temp.png' });

console.log('=== تسجيل الخروج ===');
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.click('button:has-text("Username")');
await p.waitForTimeout(400);
await p.click('button:has-text("Log out")');
await p.waitForTimeout(800);
await p.screenshot({ path: '/tmp/ui-loggedout.png' });
console.log('  login modal auto-shown:', await p.evaluate(() => document.body.innerText.includes('Try advanced features for free')));
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
console.log('  sidebar shows Log in:', await p.evaluate(() => !!Array.from(document.querySelectorAll('aside button')).find(b=>b.innerText.trim()==='Log in')));
await p.screenshot({ path: '/tmp/ui-loggedout2.png' });
await p.fill('textarea', 'hello there');
await p.keyboard.press('Enter');
await p.waitForTimeout(700);
console.log('  login modal shown on send:', await p.evaluate(() => document.body.innerText.includes('Try advanced features for free')));
await p.click('[role="dialog"] button:text-is("Log In")');
await p.waitForTimeout(600);
console.log('  after Log In, sidebar has account:', await p.evaluate(() => !!Array.from(document.querySelectorAll('aside button')).find(b=>b.innerText.includes('Username'))));

if (errs.length) { console.log('errors:'); errs.slice(0,4).forEach(e=>console.log('  '+e)); }
else console.log('\nno page errors');
await b.close();

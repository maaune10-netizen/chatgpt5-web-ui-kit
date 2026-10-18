/* يحتاج الخادم والوسيط قائمين. شغّله من جذر المشروع. */
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERR ' + String(e).slice(0, 160)));
await p.goto('http://127.0.0.1:5180/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);

console.log('=== صفحة المشروع ===');
await p.click('button:has-text("Example Project 1")');
await p.waitForTimeout(600);
console.log('  ', await p.evaluate(() => document.body.innerText.split('\n').filter(Boolean).slice(0, 10).join(' | ')));
await p.screenshot({ path: '/tmp/ui-project.png' });

console.log('=== العودة للدردشة ===');
await p.click('button:has-text("Example Chat 1")');
await p.waitForTimeout(500);
console.log('   chat open:', await p.evaluate(() => !!document.querySelector('textarea')));

console.log('=== طيّ الشريط ===');
await p.click('button[aria-label="Close sidebar"]');
await p.waitForTimeout(500);
const w = await p.evaluate(() => document.querySelector('aside')?.getBoundingClientRect().width);
console.log('   sidebar width after collapse:', w);
await p.click('button[aria-label="Open sidebar"]');
await p.waitForTimeout(500);
console.log('   width after expand:', await p.evaluate(() => document.querySelector('aside')?.getBoundingClientRect().width));

console.log('=== مرفق (لصق صورة) ===');
const b64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
await p.evaluate((src) => {
  const dt = new DataTransfer();
  const blob = Uint8Array.from(atob(src.split(',')[1]), c => c.charCodeAt(0));
  dt.items.add(new File([blob], 'dot.png', { type: 'image/png' }));
  const ta = document.querySelector('textarea');
  ta.focus();
  ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
}, b64);
await p.waitForTimeout(900);
console.log('   library count:', await p.evaluate(() => document.body.innerText.includes('Library')));

if (errs.length) { console.log('errors:'); errs.slice(0,4).forEach(e=>console.log('  '+e)); }
else console.log('\nno page errors');
await b.close();

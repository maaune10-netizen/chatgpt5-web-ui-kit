#!/usr/bin/env node
/**
 * inbox.mjs — يقرأ طابور الالتقاط.
 *
 *   node tools/inbox.mjs              # آخر الملفّات
 *   node tools/inbox.mjs --newest    # أحدث ملفّ فقط، ثم تقريره
 *   node tools/inbox.mjs --icons <dir>  # مع فكّ الأيقونات
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const INBOX = '/home/deploy/refs/chatgpt/inbox';
const args = process.argv.slice(2);
const files = readdirSync(INBOX)
  .filter((n) => n.endsWith('.json'))
  .map((n) => ({ n, ...statSync(join(INBOX, n)) }))
  .sort((a, b) => b.mtime - a.mtime);

if (!files.length) {
  console.log('الطابور فارغ.');
  process.exit(0);
}

console.log(`\n══ الطابور: ${files.length} ملفّ ══`);
for (const f of files.slice(0, 10)) {
  console.log(`  ${f.n.padEnd(48)} ${(f.size / 1048576).toFixed(1)} MB  ${f.mtime.toISOString().slice(0, 19)}`);
}

if (args.includes('--newest')) {
  const newest = join(INBOX, files[0].n);
  console.log(`\n→ تقرير: ${files[0].n}\n`);
  execFileSync('node', ['--max-old-space-size=6144', 'tools/capture-report.mjs', newest, ...args.filter((a) => a !== '--newest')], { stdio: 'inherit' });
}

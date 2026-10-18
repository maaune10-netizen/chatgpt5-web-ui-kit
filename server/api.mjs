#!/usr/bin/env node
/**
 * الخادم: قاعدة بيانات + API كامل + وسيط النموذج.
 *
 * سبب وجوده ثلاثة:
 *
 * ١) **الوصول.** كل محادثة ورسالة وملف في قاعدة بيانات، ويمكن قراءتها
 *    وتعديلها عبر API — لا محبوسة في متصفح أحد.
 * ٢) **المفتاح.** لا يصل المتصفح إطلاقًا؛ الخادم يضعه على الطلب الصادر.
 * ٣) **CORS.** المزوّد لا يسمح بأصل المتصفح، فالطلب المباشر يفشل أصلًا.
 *
 * وقاعدة البيانات SQLite عبر `node:sqlite` المدمجة — بلا اعتماد خارجي.
 *
 *   node server/api.mjs [منفذ]
 */
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { resolve, dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.API_PORT || 5199);
const DATA = join(ROOT, 'data');
const FILES = join(DATA, 'files');

mkdirSync(FILES, { recursive: true });

/* ————— الإعداد ————— */
function loadEnv() {
  const p = resolve(ROOT, '.env.local');
  const out = {};
  if (existsSync(p)) {
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return {
    baseUrl: out.VITE_LLM_BASE_URL || 'https://opencode.ai/zen/v1',
    apiKey: out.VITE_LLM_API_KEY || '',
    model: out.VITE_LLM_MODEL || 'deepseek-v4.1-flash',
  };
}
const env = loadEnv();

/* ————— قاعدة البيانات ————— */
const db = new DatabaseSync(join(DATA, 'gpt5.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New chat',
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    temporary INTEGER NOT NULL DEFAULT 0,
    model TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    reasoning TEXT,
    citations TEXT,
    error TEXT,
    stopped INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    model TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mime TEXT,
    size INTEGER NOT NULL DEFAULT 0,
    path TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'file',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    kind TEXT NOT NULL,
    detail TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at DESC);
`);

/*
 * ترقية المخطّط.
 * SQLite لا تقبل ADD COLUMN إن وُجد، فنفحص أولًا — والتطبيق يعمل على قاعدة
 * قائمة من دون أن يفقد بياناتها.
 */
function addColumn(table, col, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
    console.log(`[api] migrated: ${table}.${col}`);
  }
}
addColumn('conversations', 'archived', 'INTEGER NOT NULL DEFAULT 0');
addColumn('conversations', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');

const log = (kind, detail) => {
  try {
    db.prepare('INSERT INTO events (at, kind, detail) VALUES (?, ?, ?)').run(
      Date.now(),
      kind,
      typeof detail === 'string' ? detail : JSON.stringify(detail ?? null),
    );
  } catch {
    /* التسجيل لا يُسقط الطلب */
  }
};

const now = () => Date.now();
const uid = (p) => `${p}_${now().toString(36)}_${randomUUID().slice(0, 8)}`;

/* ————— تحويل الصفوف ————— */
const convOut = (r) => ({
  /* messages دائمًا موجودة: غيابها يجعل الواجهة تُسقط القائمة عند التكرار */
  messages: [],
  id: r.id,
  title: r.title,
  projectId: r.project_id,
  pinned: !!r.pinned,
  archived: !!r.archived,
  temporary: !!r.temporary,
  model: r.model,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const msgOut = (r) => {
  if (!r) return null;
  return {
  id: r.id,
  conversationId: r.conversation_id,
  role: r.role,
  content: r.content,
  reasoning: r.reasoning || undefined,
  citations: r.citations ? JSON.parse(r.citations) : undefined,
  error: r.error || undefined,
  stopped: !!r.stopped,
  image: r.image || undefined,
  model: r.model || undefined,
  createdAt: r.created_at,
  };
};

const fileOut = (r) => ({
  id: r.id,
  name: r.name,
  mime: r.mime,
  size: r.size,
  kind: r.kind,
  url: `/api/files/${r.id}/raw`,
  createdAt: r.created_at,
});

/* ————— قراءة الجسم ————— */
const MAX_BODY = 60 * 1024 * 1024;

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        if (!tooLarge) {
          tooLarge = true;
          reject(Object.assign(new Error('too large'), { code: 'TOO_LARGE', size }));
        }
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!tooLarge) resolve(Buffer.concat(chunks));
    });
    req.on('error', (e) => {
      if (!tooLarge) reject(e);
    });
  });

const readJson = async (req) => {
  const b = await readBody(req);
  if (!b.length) return {};
  try {
    return JSON.parse(b.toString('utf8'));
  } catch {
    throw Object.assign(new Error('JSON غير صالح'), { code: 'BAD_JSON', status: 400 });
  }
};

const send = (res, code, data) => {
  const body = JSON.stringify(data);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
};

const fail = (res, code, message) => send(res, code, { error: { message } });

/* ————— الموجّه ————— */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const seg = path.split('/').filter(Boolean); /* ['api', ...] */

  try {
    /* ===== صحة ===== */
    if (path === '/api/health') {
      return send(res, 200, {
        ok: true,
        upstream: env.baseUrl,
        model: env.model,
        hasKey: Boolean(env.apiKey),
        db: join(DATA, 'gpt5.db'),
        counts: {
          conversations: db.prepare('SELECT COUNT(*) c FROM conversations').get().c,
          messages: db.prepare('SELECT COUNT(*) c FROM messages').get().c,
          projects: db.prepare('SELECT COUNT(*) c FROM projects').get().c,
          files: db.prepare('SELECT COUNT(*) c FROM files').get().c,
        },
      });
    }

    /* ===== الحالة كاملة ===== */
    if (path === '/api/state') {
      return send(res, 200, {
        projects: db.prepare('SELECT * FROM projects ORDER BY created_at').all().map((r) => ({
          id: r.id, name: r.name, createdAt: r.created_at,
        })),
        conversations: db
          .prepare('SELECT * FROM conversations WHERE temporary = 0 AND archived = 0 ORDER BY pinned DESC, sort_order, updated_at DESC')
          .all()
          .map((c) => ({
            ...convOut(c),
            messages: db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at').all(c.id).map(msgOut),
          })),
        files: db.prepare('SELECT * FROM files ORDER BY created_at DESC').all().map(fileOut),
        model: env.model,
      });
    }

    /* ===== المشاريع ===== */
    if (seg[1] === 'projects') {
      if (req.method === 'GET' && !seg[2]) {
        return send(res, 200, db.prepare('SELECT * FROM projects ORDER BY created_at').all().map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at })));
      }
      if (req.method === 'POST' && !seg[2]) {
        const b = await readJson(req);
        const id = b.id || uid('p');
        db.prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, b.name || 'New project', now(), now());
        log('project.create', { id, name: b.name });
        return send(res, 201, { id, name: b.name || 'New project' });
      }
      if (seg[2]) {
        const id = seg[2];
        if (req.method === 'PATCH') {
          const b = await readJson(req);
          if (typeof b.name === 'string') db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(b.name, now(), id);
          log('project.update', { id, ...b });
          return send(res, 200, { ok: true });
        }
        if (req.method === 'DELETE') {
          db.prepare('DELETE FROM projects WHERE id = ?').run(id);
          log('project.delete', { id });
          return send(res, 200, { ok: true });
        }
      }
    }

    /* ===== المحادثات ===== */
    if (seg[1] === 'conversations') {
      const id = seg[2];

      if (req.method === 'GET' && !id) {
        return send(res, 200, db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all().map(convOut));
      }

      if (req.method === 'POST' && !id) {
        const b = await readJson(req);
        const cid = b.id || uid('c');
        const t = now();
        db.prepare(
          'INSERT INTO conversations (id, title, project_id, pinned, temporary, model, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?)',
        ).run(cid, b.title || (b.temporary ? 'Temporary chat' : 'New chat'), b.projectId || null, b.temporary ? 1 : 0, b.model || env.model, t, t);
        log('conversation.create', { id: cid, temporary: !!b.temporary });
        return send(res, 201, convOut(db.prepare('SELECT * FROM conversations WHERE id = ?').get(cid)));
      }

      if (id) {
        const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
        if (!row) return fail(res, 404, 'المحادثة غير موجودة');

        /*
         * مسارات الرسائل تُفحص **قبل** مسارات المحادثة.
         * وإلا التقط `PATCH /conversations/:id/messages/:mid` معالج تعديل
         * المحادثة، لأن كليهما PATCH على نفس المسار حتى العنصر الثالث.
         */
        if (seg[3] === 'messages') {
          if (req.method === 'POST' && !seg[4]) {
            const b = await readJson(req);
            const mid = b.id || uid('m');
            db.prepare(
              `INSERT INTO messages (id, conversation_id, role, content, reasoning, citations, error, stopped, image, model, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              mid, id, b.role || 'user', b.content || '', b.reasoning || null,
              b.citations ? JSON.stringify(b.citations) : null, b.error || null,
              b.stopped ? 1 : 0, b.image || null, b.model || null, now(),
            );
            const first = db.prepare("SELECT content FROM messages WHERE conversation_id = ? AND role = 'user' ORDER BY created_at LIMIT 1").get(id);
            const cur = db.prepare('SELECT title, temporary FROM conversations WHERE id = ?').get(id);
            if (cur && !cur.temporary && first && (cur.title === 'New chat' || cur.title === 'Temporary chat')) {
              const t = first.content.replace(/\s+/g, ' ').trim();
              db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(t.length > 42 ? t.slice(0, 42) + '…' : t || 'New chat', id);
            }
            db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now(), id);
            log('message.create', { conversationId: id, id: mid, role: b.role });
            return send(res, 201, msgOut(db.prepare('SELECT * FROM messages WHERE id = ?').get(mid)));
          }

          if (req.method === 'PATCH' && seg[4]) {
            /* الرسالة قد لا توجد — نتحقق قبل الكتابة، وإلا فشل تحويل الصف */
            if (!db.prepare('SELECT 1 FROM messages WHERE id = ?').get(seg[4])) {
              return fail(res, 404, 'الرسالة غير موجودة');
            }
            const b = await readJson(req);
            const sets = [];
            const vals = [];
            for (const [k, col] of [['content', 'content'], ['reasoning', 'reasoning'], ['error', 'error']]) {
              if (k in b) { sets.push(`${col} = ?`); vals.push(b[k] ?? null); }
            }
            if ('stopped' in b) { sets.push('stopped = ?'); vals.push(b.stopped ? 1 : 0); }
            if ('citations' in b) { sets.push('citations = ?'); vals.push(b.citations ? JSON.stringify(b.citations) : null); }
            if (sets.length) {
              vals.push(seg[4]);
              db.prepare(`UPDATE messages SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
            }
            db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now(), id);
            return send(res, 200, msgOut(db.prepare('SELECT * FROM messages WHERE id = ?').get(seg[4])));
          }

          if (req.method === 'DELETE' && seg[4]) {
            const n = db.prepare('DELETE FROM messages WHERE id = ?').run(seg[4]).changes;
            log('message.delete', { id: seg[4], found: n });
            if (!n) return fail(res, 404, 'الرسالة غير موجودة');
            return send(res, 200, { ok: true });
          }

          /* حذف من رسالة فصاعدًا — يستعمله «أعد المحاولة» */
          if (req.method === 'DELETE' && !seg[4] && url.searchParams.get('from')) {
            const from = url.searchParams.get('from');
            const m = db.prepare('SELECT created_at FROM messages WHERE id = ?').get(from);
            if (m) {
              db.prepare('DELETE FROM messages WHERE conversation_id = ? AND created_at >= ?').run(id, m.created_at);
              log('message.truncate', { conversationId: id, from });
            }
            return send(res, 200, { ok: true });
          }

          return fail(res, 405, 'طريقة غير مدعومة على الرسائل');
        }

        if (req.method === 'GET') {
          return send(res, 200, {
            ...convOut(row),
            messages: db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at').all(id).map(msgOut),
          });
        }
        if (req.method === 'PATCH') {
          const b = await readJson(req);
          const sets = [];
          const vals = [];
          if (typeof b.title === 'string') { sets.push('title = ?'); vals.push(b.title); }
          if ('projectId' in b) { sets.push('project_id = ?'); vals.push(b.projectId || null); }
          if ('pinned' in b) { sets.push('pinned = ?'); vals.push(b.pinned ? 1 : 0); }
          if ('archived' in b) { sets.push('archived = ?'); vals.push(b.archived ? 1 : 0); }
          if ('temporary' in b) { sets.push('temporary = ?'); vals.push(b.temporary ? 1 : 0); }
          if (typeof b.model === 'string') { sets.push('model = ?'); vals.push(b.model); }
          if (sets.length) {
            sets.push('updated_at = ?');
            vals.push(now(), id);
            db.prepare(`UPDATE conversations SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
          }
          log('conversation.update', { id, ...b });
          return send(res, 200, convOut(db.prepare('SELECT * FROM conversations WHERE id = ?').get(id)));
        }
        if (req.method === 'DELETE') {
          db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
          log('conversation.delete', { id });
          return send(res, 200, { ok: true });
        }

      }
    }

    /* ===== الملفات ===== */
    if (seg[1] === 'files') {
      if (req.method === 'GET' && !seg[2]) {
        return send(res, 200, db.prepare('SELECT * FROM files ORDER BY created_at DESC').all().map(fileOut));
      }
      if (req.method === 'POST' && !seg[2]) {
        const name = basename(String(url.searchParams.get('name') || 'upload')).slice(0, 120);
        const kind = url.searchParams.get('kind') === 'image' ? 'image' : 'file';
        const mime = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0];
        const buf = await readBody(req);
        if (!buf.length) return fail(res, 400, 'ملف فارغ');
        const fid = uid('f');
        const ext = extname(name) || '';
        const disk = join(FILES, fid + ext);
        writeFileSync(disk, buf);
        db.prepare('INSERT INTO files (id, name, mime, size, path, kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          fid, name, mime, buf.length, disk, kind, now(),
        );
        log('file.create', { id: fid, name, size: buf.length, kind });
        return send(res, 201, fileOut(db.prepare('SELECT * FROM files WHERE id = ?').get(fid)));
      }
      if (seg[2] && seg[3] === 'raw') {
        const r = db.prepare('SELECT * FROM files WHERE id = ?').get(seg[2]);
        if (!r || !existsSync(r.path)) return fail(res, 404, 'الملف غير موجود');
        const data = readFileSync(r.path);
        res.writeHead(200, { 'Content-Type': r.mime || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        return res.end(data);
      }
      if (req.method === 'DELETE' && seg[2]) {
        const r = db.prepare('SELECT * FROM files WHERE id = ?').get(seg[2]);
        if (r && existsSync(r.path)) unlinkSync(r.path);
        db.prepare('DELETE FROM files WHERE id = ?').run(seg[2]);
        log('file.delete', { id: seg[2] });
        return send(res, 200, { ok: true });
      }
    }

    /* ===== الأرشيف ===== */
    if (path === '/api/archived') {
      return send(res, 200, db
        .prepare('SELECT * FROM conversations WHERE archived = 1 ORDER BY updated_at DESC')
        .all()
        .map(convOut));
    }

    /* ===== تصدير كامل — للفحص والتعديل من الخارج ===== */
    if (path === '/api/export') {
      const conversations = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all().map((c) => ({
        ...convOut(c),
        messages: db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at').all(c.id).map(msgOut),
      }));
      return send(res, 200, {
        exportedAt: new Date().toISOString(),
        model: env.model,
        projects: db.prepare('SELECT * FROM projects').all().map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at })),
        conversations,
        files: db.prepare('SELECT * FROM files').all().map(fileOut),
        counts: {
          conversations: conversations.length,
          messages: conversations.reduce((a, c) => a + c.messages.length, 0),
          projects: db.prepare('SELECT COUNT(*) c FROM projects').get().c,
          files: db.prepare('SELECT COUNT(*) c FROM files').get().c,
        },
      });
    }

    /* ===== سجل الأحداث — لتتبّع ما حدث ===== */
    if (path === '/api/events') {
      const limit = Math.min(500, Number(url.searchParams.get('limit') || 100));
      return send(res, 200, db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT ?').all(limit));
    }

    /* ===== النماذج ===== */
    if (path === '/api/models') {
      const r = await fetch(env.baseUrl.replace(/\/$/, '') + '/models', {
        headers: { Authorization: `Bearer ${env.apiKey}` },
      });
      const text = await r.text();
      res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(text);
    }

    /* ===== المحادثة مع النموذج ===== */
    if (path === '/api/chat' && req.method === 'POST') {
      const body = await readJson(req);
      const model = body.model || env.model;
      const started = now();

      const up = await fetch(env.baseUrl.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.apiKey}` },
        body: JSON.stringify({ ...body, model, stream: true }),
      });

      if (!up.ok || !up.body) {
        const t = await up.text().catch(() => '');
        log('chat.error', { status: up.status, detail: t.slice(0, 300) });
        return send(res, up.status || 502, { error: { message: t.slice(0, 400) || 'upstream failed' } });
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const reader = up.body.getReader();
      let out = 0;
      req.on('close', () => reader.cancel().catch(() => {}));
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          out += value.length;
          res.write(value);
        }
      } catch {
        /* العميل أغلق */
      }
      res.end();
      log('chat.done', { model, ms: now() - started, bytes: out });
      return;
    }

    return fail(res, 404, 'not found');
  } catch (e) {
    const tooLarge = e && e.code === 'TOO_LARGE';
    console.error('[api] error:', e.message, tooLarge ? `(${(e.size / 1048576).toFixed(0)} MB)` : '');
    log('error', { path, message: e.message });
    if (res.headersSent) return res.end();
    return fail(res, tooLarge ? 413 : e.status || 500, tooLarge ? 'الملف أكبر من الحد' : e.message);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('[api] listening on 127.0.0.1:' + PORT);
  console.log('[api] database : ' + join(DATA, 'gpt5.db'));
  console.log('[api] files    : ' + FILES);
  console.log('[api] upstream : ' + env.baseUrl + '  ·  ' + env.model);
  console.log('[api] key      : ' + (env.apiKey ? 'محمّل' : 'مفقود'));
});

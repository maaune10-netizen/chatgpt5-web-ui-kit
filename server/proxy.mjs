#!/usr/bin/env node
/**
 * وسيط النموذج.
 *
 * سببان لوجوده، وأولهما ليس الأهم:
 *
 * ١) المفتاح لا يصل المتصفح. لو نادى المتصفح المزوّد مباشرةً لكان المفتاح
 *    في الصفحة لكل من يفتح أدوات المطوّر.
 * ٢) المزوّد لا يسمح بأصل المتصفح (CORS)، فالطلب المباشر يفشل أصلًا.
 *
 * ويبثّ كما يستقبل — بلا تجميع — فلا يتأخر الرد حتى يكتمل.
 *
 *   node server/proxy.mjs [منفذ]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PROXY_PORT || 5199);

/* الإعداد من .env.local — والملف خارج git */
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
    baseUrl: out.VITE_LLM_BASE_URL || process.env.LLM_BASE_URL || 'https://opencode.ai/zen/v1',
    apiKey: out.VITE_LLM_API_KEY || process.env.LLM_API_KEY || '',
    model: out.VITE_LLM_MODEL || process.env.LLM_MODEL || 'deepseek-v4.1-flash',
  };
}

const env = loadEnv();
if (!env.apiKey) console.warn('[proxy] تحذير: لا مفتاح في .env.local — الطلبات ستُرفض');
console.log('[proxy] upstream : ' + env.baseUrl);
console.log('[proxy] model    : ' + env.model + ' (افتراضي)');
console.log('[proxy] key      : ' + (env.apiKey ? 'محمّل (' + env.apiKey.length + ' حرفًا)' : 'مفقود'));

const json = (res, code, data) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const upstream = env.baseUrl.replace(/\/$/, '');

  try {
    if (url.pathname === '/api/health') {
      return json(res, 200, { ok: true, upstream, model: env.model, hasKey: Boolean(env.apiKey) });
    }

    if (url.pathname === '/api/models') {
      const r = await fetch(upstream + '/models', { headers: { Authorization: `Bearer ${env.apiKey}` } });
      const text = await r.text();
      res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(text);
    }

    if (url.pathname === '/api/chat' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const model = body.model || env.model;

      const up = await fetch(upstream + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.apiKey}`,
        },
        body: JSON.stringify({ ...body, model, stream: true }),
      });

      if (!up.ok || !up.body) {
        const t = await up.text().catch(() => '');
        return json(res, up.status || 502, { error: { message: t.slice(0, 400) || 'upstream failed' } });
      }

      /* بثّ مباشر: لا ننتظر اكتمال الرد */
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const reader = up.body.getReader();
      const onClose = () => reader.cancel().catch(() => {});
      req.on('close', onClose);
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch {
        /* العميل أغلق الاتصال */
      }
      res.end();
      return;
    }

    return json(res, 404, { error: 'not found' });
  } catch (e) {
    console.error('[proxy] error:', e.message);
    if (!res.headersSent) json(res, 500, { error: { message: e.message } });
    else res.end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('[proxy] listening on 127.0.0.1:' + PORT);
});

import { useMemo, useState } from 'react';
import { C, FONT, T } from '../lib/tokens';

/**
 * عرض ردود النموذج.
 *
 * مكتوب بلا مكتبات: النموذج يُخرج مجموعة محدودة من الصيغ، ومكتبة كاملة
 * ستضيف وزنًا لا يقابله نفع. ويُعرض النص الخام فورًا أثناء البثّ ثم يُنسَّق
 * عند اكتماله — فإعادة التنسيق مع كل حرف تُسبب وميضًا.
 */

interface Block {
  kind: 'p' | 'h1' | 'h2' | 'h3' | 'ul' | 'ol' | 'code' | 'quote' | 'hr' | 'table';
  text?: string;
  items?: string[];
  lang?: string;
  rows?: string[][];
}

function parse(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: Block[] = [];
  let i = 0;

  const isTableRow = (s: string) => /^\s*\|.*\|\s*$/.test(s);
  const cells = (s: string) =>
    s.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];

    /* كتلة كود */
    const fence = /^\s*```(\w*)\s*$/.exec(line);
    if (fence) {
      const lang = fence[1] || '';
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push({ kind: 'code', text: buf.join('\n'), lang });
      continue;
    }

    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      out.push({ kind: 'hr' });
      i++;
      continue;
    }

    /* جدول */
    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const rows: string[][] = [cells(line)];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      out.push({ kind: 'table', rows });
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = Math.min(3, h[1].length);
      out.push({ kind: (`h${lvl}` as Block['kind']), text: h[2] });
      i++;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push({ kind: 'quote', text: buf.join('\n') });
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*+]\s+/, ''));
      out.push({ kind: 'ul', items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      out.push({ kind: 'ol', items });
      continue;
    }

    const buf: string[] = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !isTableRow(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    out.push({ kind: 'p', text: buf.join('\n') });
  }
  return out;
}

/** التنسيق داخل السطر: **عريض** *مائل* `كود` [رابط](url) */
function Inline({ text }: { text: string }) {
  const parts = useMemo(() => {
    const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    return text.split(re).filter((s) => s !== '');
  }, [text]);

  return (
    <>
      {parts.map((p, i) => {
        if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} style={{ fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
        if (/^\*[^*\n]+\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
        if (/^`[^`]+`$/.test(p))
          return (
            <code
              key={i}
              style={{
                fontFamily: FONT.mono,
                fontSize: '0.92em',
                background: C.codeBg,
                borderRadius: 4,
                padding: '1px 5px',
              }}
            >
              {p.slice(1, -1)}
            </code>
          );
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p);
        if (link)
          return (
            <a key={i} href={link[2]} target="_blank" rel="noreferrer" style={{ color: '#7ab2ff', textDecoration: 'underline' }}>
              {link[1]}
            </a>
          );
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function CodeBlock({ text, lang }: { text: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative my-3 overflow-hidden rounded-xl" style={{ background: C.codeBg }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: `1px solid ${C.line}` }}>
        <span style={{ color: C.muted, fontSize: 12 }}>{lang || 'code'}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
          className="rounded-md px-2 py-1 hover:bg-white/10"
          style={{ color: C.muted, fontSize: 12 }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3" style={{ margin: 0 }}>
        <code style={{ fontFamily: FONT.mono, fontSize: 13, lineHeight: 1.6, color: '#e6e6e6' }}>{text}</code>
      </pre>
    </div>
  );
}

export function Markdown({ text, mono }: { text: string; mono?: boolean }) {
  if (mono) {
    return (
      <pre style={{ margin: 0, fontFamily: FONT.mono, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{text}</pre>
    );
  }

  const blocks = useMemo(() => parse(text), [text]);

  return (
    <div style={{ fontSize: T.body.size, lineHeight: `${T.body.lh}px`, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h1':
            return <h1 key={i} style={{ fontSize: T.h1.size, lineHeight: `${T.h1.lh}px`, fontWeight: 600, margin: '20px 0 8px' }}><Inline text={b.text || ''} /></h1>;
          case 'h2':
            return <h2 key={i} style={{ fontSize: T.h2.size, lineHeight: `${T.h2.lh}px`, fontWeight: 600, margin: '18px 0 8px' }}><Inline text={b.text || ''} /></h2>;
          case 'h3':
            return <h3 key={i} style={{ fontSize: T.h3.size, lineHeight: `${T.h3.lh}px`, letterSpacing: T.h3.ls, fontWeight: 600, margin: '16px 0 6px' }}><Inline text={b.text || ''} /></h3>;
          case 'hr':
            return <hr key={i} style={{ border: 0, borderTop: `1px solid ${C.line}`, margin: '16px 0' }} />;
          case 'code':
            return <CodeBlock key={i} text={b.text || ''} lang={b.lang} />;
          case 'quote':
            return (
              <blockquote key={i} style={{ borderLeft: `3px solid ${C.line}`, margin: '12px 0', padding: '2px 0 2px 14px', color: C.muted }}>
                <Inline text={b.text || ''} />
              </blockquote>
            );
          case 'ul':
            return (
              <ul key={i} style={{ margin: '8px 0', paddingInlineStart: 22, listStyle: 'disc' }}>
                {(b.items || []).map((it, k) => <li key={k} style={{ margin: '3px 0' }}><Inline text={it} /></li>)}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} style={{ margin: '8px 0', paddingInlineStart: 22, listStyle: 'decimal' }}>
                {(b.items || []).map((it, k) => <li key={k} style={{ margin: '3px 0' }}><Inline text={it} /></li>)}
              </ol>
            );
          case 'table': {
            const rows = b.rows || [];
            const [head, ...body] = rows;
            return (
              <div key={i} className="my-3 overflow-x-auto">
                <table style={{ borderCollapse: 'collapse', fontSize: 14, minWidth: 320 }}>
                  <thead>
                    <tr>
                      {(head || []).map((c, k) => (
                        <th key={k} style={{ textAlign: 'start', padding: '8px 12px', borderBottom: `1px solid ${C.line}`, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          <Inline text={c} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {body.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, ci) => (
                          <td key={ci} style={{ padding: '8px 12px', borderBottom: `1px solid rgba(255,255,255,0.07)`, verticalAlign: 'top' }}>
                            <Inline text={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          default:
            return <p key={i} style={{ margin: '10px 0' }}><Inline text={b.text || ''} /></p>;
        }
      })}
    </div>
  );
}

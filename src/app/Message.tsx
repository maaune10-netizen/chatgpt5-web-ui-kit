import { useState } from 'react';
import { Icon } from './Icon';
import { cachedTokens, reasoningTokens, costOf, savings } from '../lib/models';
import { Markdown } from './Markdown';
import { C, FONT, T } from '../lib/tokens';
import type { Message, MsgUsage } from './store';

/**
 * رسالة واحدة.
 *
 * وصف الأزرار في التصميم: نسخ · إعجاب · عدم إعجاب · مشاركة · إعادة · المزيد
 * ثم المصادر. وهذا ترتيبها هنا حرفيًا.
 */
/**
 * سطر الاستهلاك — يظهر عند المرور بالرسالة، فيُعرف ثمن كل ردّ.
 * ويعرض نسبة الكاش لأنّها الفرق بين فاتورة وفاتورة:
 * قراءة الكاش ٠٫٠٠٣ مقابل ٠٫١٥ للإدخال الطازج — أرخص ٥٠ ضعفًا.
 */
function UsageLine({ usage, model }: { usage: MsgUsage; model: string }) {
  const cached = cachedTokens(usage);
  const prompt = usage.prompt_tokens ?? 0;
  const out = usage.completion_tokens ?? 0;
  const think = reasoningTokens(usage);
  const cost = costOf(usage, model);
  const saved = savings(usage, model);
  const pct = prompt > 0 ? Math.round((cached / prompt) * 100) : 0;

  return (
    <div
      className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 opacity-0 transition-opacity group-hover/row:opacity-100"
      style={{ fontSize: 11, color: C.dim }}
      title={`${prompt.toLocaleString()} input · ${cached.toLocaleString()} from cache · ${out.toLocaleString()} output (${think.toLocaleString()} reasoning)`}
    >
      <span>{prompt.toLocaleString()} in</span>
      <span>{out.toLocaleString()} out</span>
      {think > 0 && <span style={{ color: C.muted }}>{think.toLocaleString()} thinking</span>}
      {cached > 0 && (
        <span style={{ color: 'var(--c-ok)' }}>
          {pct}% cached · {Math.round(saved * 100)}% saved
        </span>
      )}
      {cost > 0 && <span>${cost < 0.001 ? cost.toFixed(5) : cost.toFixed(4)}</span>}
    </div>
  );
}

export function MessageRow({
  m,
  onCopy,
  onShare,
  onRetry,
  onMore,
  onOpenImage,
}: {
  m: Message;
  onCopy: () => void;
  onShare: () => void;
  onRetry: () => void;
  onMore: () => void;
  onOpenImage?: (src: string) => void;
}) {
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const [copied, setCopied] = useState(false);

  if (m.role === 'user') {
    return (
      <div className="group/row flex justify-end py-3">
        <div className="max-w-[75%]">
          {m.image && (
            <button type="button" onClick={() => onOpenImage?.(m.image!)} className="mb-2 block overflow-hidden rounded-2xl">
              <img src={m.image} alt="" style={{ maxWidth: 320, maxHeight: 240, objectFit: 'cover', display: 'block' }} />
            </button>
          )}
          <div
            className="px-4 py-2.5"
            style={{ background: C.userBubble, borderRadius: 18, fontSize: T.body.size, lineHeight: `${T.body.lh}px`, whiteSpace: 'pre-wrap' }}
          >
            {m.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group/row py-4" style={{ color: C.text }}>
      {/* التفكير — مطويّ، فالتفكير ليس جوابًا */}
      {m.reasoning ? <Reasoning text={m.reasoning} live={m.streaming} /> : null}

      {m.error ? (
        <div className="my-2 rounded-xl px-4 py-3" style={{ background: 'color-mix(in srgb, var(--c-danger) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--c-danger) 35%, transparent)' }}>
          <p style={{ fontSize: 14, color: 'var(--c-danger)' }}>{m.error}</p>
        </div>
      ) : m.streaming && !m.content ? (
        <Typing />
      ) : (
        <Markdown text={m.content} />
      )}

      {m.citations && m.citations.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span style={{ fontSize: 12, color: C.muted }}>Sources</span>
          {m.citations.map((c, i) => (
            <a
              key={i}
              href={c.url || '#'}
              target="_blank"
              rel="noreferrer"
              title={c.title}
              className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-medium hover:brightness-110"
              style={{ background: 'var(--c-pill)', color: C.muted }}
            >
              {i + 1}
            </a>
          ))}
        </div>
      )}

      {/* صفّ الأزرار — لا يظهر أثناء البثّ */}
      {!m.streaming && !m.error && (
        <div className="mt-2 flex items-center gap-0.5" style={{ color: C.muted }}>
          <Action
            name="copy"
            label={copied ? 'Copied' : 'Copy'}
            onClick={() => {
              void navigator.clipboard.writeText(m.content);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
              onCopy();
            }}
          />
          <Action
            name="thumbsUp"
            label="Good response"
            active={vote === 'up'}
            onClick={() => setVote(vote === 'up' ? null : 'up')}
          />
          <Action
            name="thumbsDown"
            label="Bad response"
            active={vote === 'down'}
            onClick={() => setVote(vote === 'down' ? null : 'down')}
          />
          <Action name="share" label="Share" onClick={onShare} />
          <Action name="retry" label="Try again" onClick={onRetry} />
          <Action name="overflow" label="More actions" onClick={onMore} />
        </div>
      )}

      {m.stopped && (
        <p className="mt-1" style={{ fontSize: 12, color: C.dim }}>
          Stopped
        </p>
      )}

      {/*
       * سطر الاستهلاك — يظهر عند المرور بالرسالة فقط، فلا يُشوّش القراءة.
       * ويعرض نسبة الكاش لأنّها الفرق بين فاتورة وفاتورة: قراءة الكاش
       * ٠٫٠٠٣ مقابل ٠٫١٥ للإدخال الطازج.
       */}
      {m.usage && !m.streaming && <UsageLine usage={m.usage} model={m.model || ''} />}
    </div>
  );
}

function Action({
  name,
  label,
  onClick,
  active,
}: {
  name: string;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-white/10"
      /* التصويت المُختار يُلوَّن بدل فلتر على الرمز */
      style={{ color: active ? 'var(--c-link)' : 'inherit' }}
    >
      <Icon name={name} size={18} style={{ opacity: active ? 1 : 0.7 }} />
    </button>
  );
}

/** مؤشر الكتابة — ثلاث نقاط نابضة */
function Typing() {
  return (
    <div className="flex items-center gap-1 py-2" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block rounded-full"
          style={{
            width: 6,
            height: 6,
            background: C.muted,
            animation: `gpt5dot 1.2s ${i * 0.15}s infinite ease-in-out`,
          }}
        />
      ))}
      <style>{`@keyframes gpt5dot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}`}</style>
    </div>
  );
}

/** التفكير — مطويّ افتراضيًا، ويُفتح أثناء البثّ مرة واحدة */
function Reasoning({ text, live }: { text: string; live?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-start hover:bg-white/[0.06]"
        style={{ fontSize: 13, color: C.muted }}
      >
        <Icon name="think" size={16} />
        <span>{live ? 'Thinking…' : 'Thought process'}</span>
        <Icon name={open ? 'chevronDown' : 'arrowRight'} size={14} />
      </button>
      {open && (
        <pre
          className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg px-3 py-2"
          style={{ fontFamily: FONT.sans, fontSize: 13, lineHeight: '19px', color: C.dim, background: 'var(--c-subtle)' }}
        >
          {text}
        </pre>
      )}
    </div>
  );
}

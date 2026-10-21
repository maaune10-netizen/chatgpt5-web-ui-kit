import { Icon } from './Icon';
import { C } from '../lib/tokens';

/**
 * نموذج الدخول — **من لقطة `/auth/login`** (٢١ أكتوبر)، لا من نافذة الـKit.
 *
 * وما تغيّر عن بنائنا السابق ثلاثة:
 *  ١) **لا ترويسة مصوّرة.** كان في نافذتنا مستطيل ١٩٧ بكسل — وليس في التصميم.
 *  ٢) **ثلاثة أزرار اجتماعية** (Google · Apple · Phone) ثم فاصل `or` ثم البريد.
 *  ٣) العنوان «Log in or sign up» لا «Try advanced features for free».
 *
 * ويُستعمل في النافذة الآن، وفي صفحة `/auth/login` لاحقًا بـ`variant="page"`.
 */

/** الـG الملوّن — لا يمكن رسمه بأيقوناتنا لأنّها قناع بلون واحد */
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

const SOCIAL: Array<{ label: string; icon: React.ReactNode }> = [
  { label: 'Continue with Google', icon: <GoogleG /> },
  { label: 'Continue with Apple', icon: <Icon name="apple" size={18} /> },
  { label: 'Continue with phone', icon: <Icon name="phone" size={18} /> },
];

export function AuthForm({
  onContinue,
  variant = 'modal',
}: {
  /** يُنادى حين يضغط المستخدم Continue أو أحد الأزرار الاجتماعية */
  onContinue: () => void;
  variant?: 'modal' | 'page';
}) {
  const page = variant === 'page';
  return (
    <div style={{ paddingInline: page ? 0 : 40, textAlign: 'center' }}>
      <h2 style={{ fontSize: page ? 28 : 26, lineHeight: '34px', fontWeight: 500 }}>Log in or sign up</h2>
      <p
        style={{
          fontSize: 14,
          lineHeight: '20px',
          color: C.muted,
          marginTop: 8,
          maxWidth: 340,
          marginInline: 'auto',
        }}
      >
        You’ll get smarter responses and can upload files, images, and more.
      </p>

      <div className="mt-6 flex flex-col gap-2.5" style={{ maxWidth: 368, marginInline: 'auto' }}>
        {SOCIAL.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={onContinue}
            className="flex items-center justify-center gap-2.5 rounded-full transition-colors hover:bg-[var(--c-hover)]"
            style={{
              height: 42,
              border: `1px solid ${C.line}`,
              fontSize: 14,
              fontWeight: 500,
              color: C.text,
            }}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {/* فاصل `or` — خطّان ووسيط، كما في اللقطة */}
      <div className="mx-auto mt-5 flex items-center gap-3" style={{ maxWidth: 368 }}>
        <span className="h-px flex-1" style={{ background: C.line }} />
        <span style={{ fontSize: 12, color: C.muted }}>or</span>
        <span className="h-px flex-1" style={{ background: C.line }} />
      </div>

      <div className="mx-auto mt-5 flex flex-col gap-2.5" style={{ maxWidth: 368 }}>
        <input
          type="email"
          autoComplete="email"
          placeholder="Email address"
          aria-label="Email address"
          className="w-full rounded-full px-4 outline-none placeholder:text-[var(--c-placeholder)]"
          style={{
            height: 43,
            border: `1px solid ${C.line}`,
            background: 'transparent',
            fontSize: 14,
            color: C.text,
          }}
        />
        <button
          type="button"
          onClick={onContinue}
          className="w-full rounded-full font-semibold transition-opacity hover:opacity-90 active:scale-[0.995]"
          style={{ height: 43, background: 'var(--c-text)', color: 'var(--c-body)', fontSize: 15 }}
        >
          Continue
        </button>
      </div>

      {page && (
        <>
          <button
            type="button"
            onClick={onContinue}
            className="mt-5 underline transition-opacity hover:opacity-70"
            style={{ fontSize: 13, color: C.muted }}
          >
            Try it first
          </button>
          <div className="mt-16 flex flex-col items-center gap-3">
            <Icon name="chatgpt" size={26} style={{ color: C.muted }} />
            <p style={{ fontSize: 12, color: C.muted }}>
              <span className="underline">Terms of use</span>
              <span style={{ margin: '0 8px', opacity: 0.5 }}>|</span>
              <span className="underline">Privacy policy</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

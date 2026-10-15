import { useEffect, useRef, useState, type FC, type KeyboardEvent } from 'react';
import { Box } from './AppHeader';
import { IconPlus, IconMic, IconAudio, IconAttachFile, IconImage, IconNewChat } from './icons';

export interface Attachment {
  id: string;
  name: string;
  icon: 'file' | 'image' | 'draw';
}

interface PromptInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const MENU = [
  { label: 'Attach file', icon: <IconAttachFile /> },
  { label: 'Upload image', icon: <IconImage /> },
  { label: 'Draw', icon: <IconNewChat /> },
];

export const PromptInput: FC<PromptInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Ask anything',
  autoFocus,
}) => {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  /* auto-grow the textarea like the kit's field does */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '24px';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const canSend = value.trim().length > 0;

  return (
    <div className="prompt-field relative flex w-full flex-col rounded-[28px] bg-input p-2.5">
      <div className="flex items-center gap-1.5">
        {/* Add */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            title="Add files and more"
            onClick={() => setMenu((v) => !v)}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10 ${
              menu ? 'bg-white/10' : ''
            }`}
          >
            <Box size="h-6 w-6">
              <IconPlus />
            </Box>
          </button>
          {menu && (
            <div className="absolute bottom-full left-0 z-30 mb-2 w-44 rounded-xl border border-line bg-[#2a2a2a] p-1 shadow-xl">
              {MENU.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => setMenu(false)}
                  className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-white/90 transition hover:bg-white/10"
                >
                  <Box size="h-4 w-4" className="text-muted">
                    {m.icon}
                  </Box>
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text */}
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="min-h-6 max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-[16px] leading-6 text-white placeholder:text-muted focus:outline-none"
        />

        {/* Right buttons */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            title="Dictate"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          >
            <Box size="h-6 w-6">
              <IconMic />
            </Box>
          </button>
          <button
            type="button"
            title={canSend ? 'Send' : 'Use voice mode'}
            onClick={canSend ? onSubmit : undefined}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#212121] text-white ring-1 ring-white/10 transition hover:bg-[#2a2a2a]"
          >
            <Box size="h-5 w-5">
              <IconAudio />
            </Box>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptInput;

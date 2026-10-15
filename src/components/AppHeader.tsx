import type { FC, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { IconStarIntelligence, IconTemporaryChat } from './icons';

/** يضبط حجم أي أيقونة داخل العقدة */
export const Box: FC<{ children: ReactNode; size?: string; className?: string }> = ({
  children,
  size = 'h-5 w-5',
  className = '',
}) => (
  <span className={`shrink-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${size} ${className}`}>
    {children}
  </span>
);

interface AppHeaderProps {
  temporary: boolean;
  onToggleTemporary: () => void;
  onUpsell: () => void;
}

export const AppHeader: FC<AppHeaderProps> = ({ temporary, onToggleTemporary, onUpsell }) => (
  <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-line bg-body px-3 py-2">
    {/* Model selection */}
    <button
      type="button"
      className="flex h-9 items-center gap-1 rounded-lg px-2.5 transition hover:bg-white/5"
    >
      <span className="text-[18px] font-normal leading-[27.9px] tracking-[-0.72px] text-white">
        ChatGPT
      </span>
      <Box size="h-4 w-4" className="text-muted">
        <ChevronDown />
      </Box>
    </button>

    {/* Upsell */}
    <button
      type="button"
      onClick={onUpsell}
      className="flex h-9 items-center justify-center gap-1 rounded-full bg-upsell px-3 py-2 text-[14px] font-semibold leading-[19.7px] text-white transition hover:brightness-110"
    >
      <Box size="h-4 w-4">
        <IconStarIntelligence />
      </Box>
      Get Plus
    </button>

    {/* Temporary chat */}
    <button
      type="button"
      title="Temporary chat"
      onClick={onToggleTemporary}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
        temporary ? 'bg-white/10 text-white' : 'text-muted hover:bg-white/5'
      }`}
    >
      <Box size="h-5 w-5">
        <IconTemporaryChat />
      </Box>
    </button>
  </header>
);

export default AppHeader;

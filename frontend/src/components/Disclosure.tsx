import type { ReactNode } from 'react';

interface Props {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /**
   * Visual prominence of the toggle row.
   * - `sm` (default): subtle, for inline detail rows inside cards.
   * - `lg`: prominent section divider — easy to spot at a glance.
   */
  size?: 'sm' | 'lg';
  /** Optional right-aligned hint, e.g. a count. */
  hint?: string;
}

/**
 * Collapsible section built on the native <details> element.
 */
export default function Disclosure({
  label,
  children,
  defaultOpen = false,
  className = '',
  size = 'sm',
  hint,
}: Props) {
  const isLg = size === 'lg';
  return (
    <details
      className={[
        'group rounded-2xl border bg-paper/70',
        isLg ? 'border-line shadow-soft' : 'border-line',
        className,
      ].join(' ')}
      open={defaultOpen}
    >
      <summary
        className={[
          'flex cursor-pointer list-none items-center justify-between transition-colors hover:bg-cream/40',
          isLg
            ? 'rounded-2xl px-5 py-4 text-[15px] font-semibold text-ink'
            : 'px-4 py-2.5 text-[12px] font-medium text-ink-muted hover:text-ink',
        ].join(' ')}
      >
        <span className="flex items-center gap-3">
          {isLg && (
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-ink-subtle transition-transform group-open:rotate-90"
              style={{ background: 'color-mix(in oklab, var(--stage-soft) 60%, white)' }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </span>
          )}
          <span>{label}</span>
        </span>
        <span className="flex items-center gap-2">
          {hint && (
            <span className={isLg ? 'text-[12px] font-medium text-ink-muted' : 'text-[11px] text-ink-subtle'}>
              {hint}
            </span>
          )}
          {!isLg && (
            <span className="inline-block text-ink-subtle transition-transform group-open:rotate-90">›</span>
          )}
        </span>
      </summary>
      <div className={isLg ? 'border-t border-line/60 px-5 py-4' : 'border-t border-line/60 px-4 py-3'}>
        {children}
      </div>
    </details>
  );
}

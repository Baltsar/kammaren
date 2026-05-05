import { cn } from '@/lib/utils';

const STEPS = ['E-post', 'Telegram', 'Profil', 'Klart'] as const;

export type Step = (typeof STEPS)[number];

export function ProgressDots({ activeIndex }: { activeIndex: number }): JSX.Element {
  return (
    <ol className="flex items-center justify-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-kammaren-label">
      {STEPS.map((label, i) => {
        const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                'h-2 w-2 rounded-full border transition',
                state === 'done' && 'bg-kammaren-strong border-kammaren-strong',
                state === 'active' && 'bg-kammaren-tamber border-kammaren-strong',
                state === 'pending' && 'bg-transparent border-kammaren-strong/30',
              )}
            />
            <span
              className={cn(
                'transition',
                state === 'pending' && 'opacity-50',
                state === 'active' && 'text-kammaren-strong',
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 ? (
              <span aria-hidden className="h-px w-4 bg-kammaren-strong/15" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

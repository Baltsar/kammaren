'use client';

import { useState } from 'react';
import { ProgressDots } from './progress-dots';
import { StepEmail } from './step-email';
import { StepTelegram } from './step-telegram';
import { StepProfile } from './step-profile';
import { StepSuccess } from './step-success';
import type { OnboardInput } from '@/lib/validation';

type Phase = 'email' | 'telegram' | 'profile' | 'success';

type State = {
  phase: Phase;
  email: string;
  chatId: string;
  profile?: OnboardInput;
  serverMessage?: string;
};

const PHASE_INDEX: Record<Phase, number> = {
  email: 0,
  telegram: 1,
  profile: 2,
  success: 3,
};

export function OnboardingWizard(): JSX.Element {
  const [state, setState] = useState<State>({
    phase: 'email',
    email: '',
    chatId: '',
  });

  return (
    <div className="space-y-8">
      <header className="space-y-3 text-center">
        <p className="label-eyebrow">KAMMAREN Watcher</p>
        <span className="inline-flex items-center gap-2 rounded-full border border-kammaren-tamber/40 bg-kammaren-tamber/10 px-3 py-1 text-[0.65rem] font-mono uppercase tracking-[0.18em] text-kammaren-strong">
          🔒 Stängd beta · invite only
        </span>
        <ProgressDots activeIndex={PHASE_INDEX[state.phase]} />
      </header>

      <main className="card-warm p-6 sm:p-8">
        {state.phase === 'email' ? (
          <StepEmail
            initialEmail={state.email}
            onContinue={(email) =>
              setState((s) => ({ ...s, phase: 'telegram', email }))
            }
          />
        ) : null}

        {state.phase === 'telegram' ? (
          <StepTelegram
            initialChatId={state.chatId}
            onBack={() => setState((s) => ({ ...s, phase: 'email' }))}
            onContinue={(chatId) =>
              setState((s) => ({ ...s, phase: 'profile', chatId }))
            }
          />
        ) : null}

        {state.phase === 'profile' ? (
          <StepProfile
            email={state.email}
            chatId={state.chatId}
            onBack={() => setState((s) => ({ ...s, phase: 'telegram' }))}
            onComplete={({ profile, serverMessage }) =>
              setState((s) => ({ ...s, phase: 'success', profile, serverMessage }))
            }
          />
        ) : null}

        {state.phase === 'success' && state.profile ? (
          <StepSuccess profile={state.profile} serverMessage={state.serverMessage} />
        ) : null}
      </main>

      <footer className="flex items-center justify-center gap-4 text-[0.7rem] font-mono uppercase tracking-[0.18em] text-kammaren-label">
        <a href="/watcher/terms" className="hover:text-kammaren-strong">
          Terms
        </a>
        <span aria-hidden>·</span>
        <a href="/watcher/privacy" className="hover:text-kammaren-strong">
          Privacy
        </a>
        <span aria-hidden>·</span>
        <a
          href="https://github.com/Baltsar/kammaren"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-kammaren-strong"
        >
          AGPL-3.0
        </a>
      </footer>
    </div>
  );
}

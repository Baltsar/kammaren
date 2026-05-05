'use client';

import type { OnboardInput } from '@/lib/validation';

export function StepSuccess({
  profile,
  serverMessage,
}: {
  profile: OnboardInput;
  serverMessage?: string;
}): JSX.Element {
  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-full bg-kammaren-pass text-kammaren-cream text-xl"
        >
          ✓
        </span>
        <h1 className="text-2xl font-display font-extrabold leading-tight">
          Registrerad!
        </h1>
      </div>

      <p className="text-sm text-kammaren-body">
        Du får din första notis i Telegram inom 24 timmar — vid nästa körning
        kl 06:00 (Europe/Stockholm).
      </p>

      <div className="card-warm p-4 space-y-2">
        <p className="label-eyebrow">Din profil</p>
        <dl className="grid grid-cols-[max-content,1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-kammaren-label">Bolag</dt>
          <dd>{profile.company_name}</dd>
          <dt className="text-kammaren-label">Org</dt>
          <dd className="font-mono">{profile.orgnr}</dd>
          <dt className="text-kammaren-label">Telegram-ID</dt>
          <dd className="font-mono">{profile.telegram_chat_id}</dd>
          <dt className="text-kammaren-label">E-post</dt>
          <dd>{profile.email}</dd>
        </dl>
      </div>

      <div className="text-xs text-kammaren-label space-y-1">
        <p>
          I boten: <span className="font-mono">/status</span> · {' '}
          <span className="font-mono">/pause</span> · {' '}
          <span className="font-mono">/forget</span> · {' '}
          <span className="font-mono">/help</span>
        </p>
        {serverMessage ? <p>{serverMessage}</p> : null}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';

const VERIFIER_DEEPLINK = 'https://t.me/kammarenverifyBOT?start=onboard';

export function StepTelegram({
  initialChatId,
  onBack,
  onContinue,
}: {
  initialChatId: string;
  onBack: () => void;
  onContinue: (chatId: string) => void;
}): JSX.Element {
  const [chatId, setChatId] = useState(initialChatId);
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = chatId.trim();
    if (!/^-?\d{5,20}$/.test(trimmed)) {
      setError('Telegram-ID ska bara innehålla siffror (5–20 siffror).');
      return;
    }
    setError(undefined);
    onContinue(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fade-up">
      <div>
        <h1 className="text-2xl font-display font-extrabold leading-tight">
          Klistra in ditt Telegram-ID
        </h1>
        <ol className="mt-3 space-y-2 text-sm text-kammaren-body list-decimal list-inside">
          <li>
            Öppna{' '}
            <a
              href={VERIFIER_DEEPLINK}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-kammaren-tamber underline-offset-2 hover:text-kammaren-strong"
            >
              @kammarenverifyBOT
            </a>{' '}
            i Telegram.
          </li>
          <li>Tryck <span className="font-mono">/start</span>.</li>
          <li>Boten skickar ditt Telegram-ID. Kopiera siffran.</li>
          <li>Klistra in det här nedanför.</li>
        </ol>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="chat_id">Telegram-ID</Label>
        <Input
          id="chat_id"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required
          placeholder="544123218"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'chat_id-error' : undefined}
        />
        <FieldError message={error} />
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Tillbaka
        </Button>
        <Button type="submit" className="flex-1">
          Fortsätt
        </Button>
      </div>
    </form>
  );
}

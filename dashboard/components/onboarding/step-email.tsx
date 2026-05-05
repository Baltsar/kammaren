'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';

const VERIFIER_DEEPLINK = 'https://t.me/kammarenverifyBOT?start=onboard';

export function StepEmail({
  initialEmail,
  onContinue,
}: {
  initialEmail: string;
  onContinue: (email: string) => void;
}): JSX.Element {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Ange en giltig e-postadress.');
      return;
    }
    setError(undefined);
    window.open(VERIFIER_DEEPLINK, '_blank', 'noopener,noreferrer');
    onContinue(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fade-up">
      <div>
        <h1 className="text-3xl font-display font-extrabold leading-tight">
          Regulatoriska notiser för ditt AB.
        </h1>
        <p className="mt-3 text-sm text-kammaren-body">
          Notiser från Skatteverket, Riksdagen m.fl. — direkt i Telegram. Gratis.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">E-post</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          inputMode="email"
          placeholder="du@bolaget.se"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'email-error' : undefined}
        />
        <FieldError message={error} />
      </div>

      <Button type="submit" size="lg" className="w-full">
        Hämta mitt Telegram-ID
      </Button>

      <p className="text-xs text-kammaren-label">
        En ny flik öppnas till @kammarenverifyBOT där du får ditt Telegram-ID.
      </p>
    </form>
  );
}

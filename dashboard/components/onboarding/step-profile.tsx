'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldError } from '@/components/ui/field-error';
import { onboardSchema, type OnboardInput } from '@/lib/validation';
import { formatOrgnr, normalizeOrgnr, validateOrgnr } from '@/lib/luhn';

type StepProfileProps = {
  email: string;
  chatId: string;
  onBack: () => void;
  onComplete: (result: { profile: OnboardInput; serverMessage?: string }) => void;
};

const profileFlags = [
  { key: 'is_vat_registered', label: 'Momsregistrerad' },
  { key: 'is_employer_registered', label: 'Arbetsgivare (registrerad hos Skatteverket)' },
  { key: 'pays_salary_to_owner', label: 'Betalar lön till ägare' },
  { key: 'processes_personal_data', label: 'Hanterar personuppgifter (GDPR)' },
  { key: 'has_more_than_3_employees', label: 'Fler än 3 anställda' },
  { key: 'revenue_over_40msek', label: 'Omsättning > 40 MSEK (större företag)' },
  { key: 'publishes_annual_report', label: 'Publicerar årsredovisning' },
] as const;

const formSchema = onboardSchema.omit({ email: true, telegram_chat_id: true });

type FormInput = z.infer<typeof formSchema>;

export function StepProfile({
  email,
  chatId,
  onBack,
  onComplete,
}: StepProfileProps): JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orgnr: '',
      company_name: '',
      business_profile: {
        is_vat_registered: false,
        is_employer_registered: false,
        pays_salary_to_owner: false,
        processes_personal_data: false,
        has_more_than_3_employees: false,
        revenue_over_40msek: false,
        publishes_annual_report: true,
      },
      consent: { terms: false as unknown as true, privacy: false as unknown as true, b2b: false as unknown as true },
    },
  });

  const orgnrValue = watch('orgnr');
  const consent = watch('consent');

  // Auto-formatera orgnr till XXXXXX-XXXX när de skrivit 10 siffror utan dash.
  useEffect(() => {
    const digits = normalizeOrgnr(orgnrValue);
    if (digits.length === 10 && !orgnrValue.includes('-')) {
      const result = validateOrgnr(orgnrValue);
      if (result.ok) {
        setValue('orgnr', result.canonical, { shouldValidate: true });
      } else {
        setValue('orgnr', formatOrgnr(digits), { shouldValidate: true });
      }
    }
  }, [orgnrValue, setValue]);

  const submit = async (values: FormInput): Promise<void> => {
    setSubmitting(true);
    setServerError(undefined);
    const payload: OnboardInput = {
      ...values,
      email,
      telegram_chat_id: chatId,
    };
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: true; message?: string }
        | { ok: false; error: string }
        | null;

      if (!res.ok || !json || !('ok' in json) || !json.ok) {
        const reason =
          json && 'error' in json && typeof json.error === 'string'
            ? json.error
            : `Servern svarade med ${res.status}`;
        setServerError(reason);
        setSubmitting(false);
        return;
      }
      onComplete({ profile: payload, serverMessage: 'message' in json ? json.message : undefined });
    } catch (err) {
      setServerError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-display font-extrabold leading-tight">
          Profil och samtycken
        </h1>
        <p className="mt-2 text-sm text-kammaren-body">
          Uppgifterna används för att avgöra vilka regulatoriska notiser som
          rör ditt bolag. Du kan alltid <span className="font-mono">/forget</span> i boten.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="orgnr">Organisationsnummer</Label>
        <Input
          id="orgnr"
          inputMode="numeric"
          maxLength={11}
          placeholder="556677-8899"
          {...register('orgnr')}
          aria-invalid={Boolean(errors.orgnr)}
        />
        <FieldError message={errors.orgnr?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="company_name">Bolagsnamn</Label>
        <Input
          id="company_name"
          placeholder="Testbolaget AB"
          autoComplete="organization"
          {...register('company_name')}
          aria-invalid={Boolean(errors.company_name)}
        />
        <FieldError message={errors.company_name?.message} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Bolagsprofil</legend>
        <p className="text-xs text-kammaren-label">
          Markera det som stämmer. Tjänsten matchar notiser mot dessa.
        </p>
        <div className="rounded-md border border-kammaren-strong/15 bg-white/50 divide-y divide-kammaren-strong/10">
          {profileFlags.map((flag) => {
            const id = `bp-${flag.key}`;
            const checked = watch(`business_profile.${flag.key}`);
            return (
              <label
                key={flag.key}
                htmlFor={id}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-kammaren-cream-mid/40"
              >
                <Checkbox
                  id={id}
                  checked={Boolean(checked)}
                  onCheckedChange={(value) =>
                    setValue(`business_profile.${flag.key}`, value === true, {
                      shouldDirty: true,
                    })
                  }
                />
                <span className="text-sm text-kammaren-strong">{flag.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Samtycken</legend>
        {(
          [
            {
              key: 'terms' as const,
              label: 'Jag har läst och godkänner ',
              link: { href: '/watcher/terms', text: 'Användarvillkor' },
            },
            {
              key: 'privacy' as const,
              label: 'Jag har läst och godkänner ',
              link: { href: '/watcher/privacy', text: 'Integritetspolicy' },
            },
            {
              key: 'b2b' as const,
              label:
                'Jag bekräftar att jag agerar för ett aktiebolag i näringsverksamhet (B2B).',
              link: null,
            },
          ] as const
        ).map((row) => {
          const id = `consent-${row.key}`;
          return (
            <div key={row.key}>
              <label
                htmlFor={id}
                className="flex items-start gap-3 cursor-pointer text-sm text-kammaren-strong"
              >
                <Checkbox
                  id={id}
                  checked={Boolean(consent?.[row.key])}
                  onCheckedChange={(value) =>
                    setValue(`consent.${row.key}`, (value === true) as true, {
                      shouldValidate: true,
                    })
                  }
                />
                <span className="leading-snug">
                  {row.label}
                  {row.link ? (
                    <a
                      href={row.link.href}
                      target="_blank"
                      rel="noopener"
                      className="underline decoration-kammaren-tamber underline-offset-2"
                    >
                      {row.link.text}
                    </a>
                  ) : null}
                  .
                </span>
              </label>
              <FieldError
                message={errors.consent?.[row.key]?.message}
                className="ml-8"
              />
            </div>
          );
        })}
      </fieldset>

      {serverError ? (
        <div
          role="alert"
          className="rounded-md border border-kammaren-red/30 bg-kammaren-red/5 p-3 text-sm text-kammaren-red"
        >
          {serverError}
        </div>
      ) : null}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1"
          disabled={submitting}
        >
          Tillbaka
        </Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? 'Registrerar…' : 'Klart — registrera mig'}
        </Button>
      </div>
    </form>
  );
}

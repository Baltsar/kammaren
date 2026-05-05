import { z } from 'zod';
import { validateOrgnr } from './luhn';

export const businessProfileSchema = z.object({
  is_vat_registered: z.boolean().default(false),
  is_employer_registered: z.boolean().default(false),
  processes_personal_data: z.boolean().default(false),
  has_more_than_3_employees: z.boolean().default(false),
  revenue_over_40msek: z.boolean().default(false),
  pays_salary_to_owner: z.boolean().default(false),
  publishes_annual_report: z.boolean().default(true),
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

export const consentSchema = z.object({
  terms: z.literal(true, {
    errorMap: () => ({ message: 'Du måste godkänna Användarvillkor.' }),
  }),
  privacy: z.literal(true, {
    errorMap: () => ({ message: 'Du måste godkänna Integritetspolicy.' }),
  }),
  b2b: z.literal(true, {
    errorMap: () => ({
      message: 'Bekräfta att du agerar för aktiebolag i näringsverksamhet.',
    }),
  }),
});

export const onboardSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Ogiltig e-postadress')
    .max(254),
  telegram_chat_id: z
    .string()
    .trim()
    .regex(/^-?\d+$/, 'Telegram-ID ska bara innehålla siffror.')
    .min(5)
    .max(20),
  orgnr: z
    .string()
    .trim()
    .superRefine((val, ctx) => {
      const result = validateOrgnr(val);
      if (result.ok) return;
      const messages: Record<typeof result.reason, string> = {
        format: 'Ange 10 siffror, format XXXXXX-XXXX.',
        luhn: 'Ogiltig kontrollsiffra (Luhn).',
        not_ab: 'Detta är inte ett aktiebolag (Bolagsverkets numrering).',
      };
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: messages[result.reason],
      });
    }),
  company_name: z
    .string()
    .trim()
    .min(2, 'Ange bolagsnamnet.')
    .max(120),
  business_profile: businessProfileSchema,
  consent: consentSchema,
});

export type OnboardInput = z.infer<typeof onboardSchema>;

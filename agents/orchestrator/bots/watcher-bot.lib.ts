/**
 * Watcher-bot — pure message-byggare och små helpers. Separat fil för
 * att kunna testas utan grammy/IO-dependency.
 */

import type { CustomerProfile } from '../../watcher/customer-profile/types.js';

export const ONBOARD_URL = 'https://kammaren.nu/watcher/start';
export const TERMS_URL = 'https://kammaren.nu/watcher/terms';
export const PRIVACY_URL = 'https://kammaren.nu/watcher/privacy';
export const SOURCE_URL = 'https://github.com/Baltsar/kammaren';
export const SUPPORT_EMAIL = 'info@kammaren.nu';
export const FORGET_CONFIRM_TOKEN = 'RADERA';
export const FORGET_TIMEOUT_MS = 5 * 60 * 1000;

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>]/g, (ch) => HTML_ESCAPE[ch] ?? ch);
}

function bool(value: unknown): 'ja' | 'nej' {
  return value === true ? 'ja' : 'nej';
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Svensk relativ tid: "just nu", "5 min sen", "3 timmar sen", "2 dagar sen".
 * Approximationer — för bot-status räcker det.
 */
export function formatTimeAgoSv(now: Date, then: Date): string {
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return 'just nu';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just nu';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min sen`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ${h === 1 ? 'timme' : 'timmar'} sen`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} ${d === 1 ? 'dag' : 'dagar'} sen`;
  const months = Math.floor(d / 30);
  if (months < 12) return `${months} ${months === 1 ? 'månad' : 'månader'} sen`;
  const years = Math.floor(d / 365);
  return `${years} ${years === 1 ? 'år' : 'år'} sen`;
}

export function buildHelpMessage(): string {
  return [
    '📚 <b>KAMMAREN Watcher — Commands</b>',
    '',
    '/start — Hämta ditt Telegram-ID + onboarding',
    '/status — Din profil och senaste notiser',
    '/pause — Pausa notiser temporärt',
    '/resume — Återuppta notiser',
    '/legal — TERMS, PRIVACY, källkod',
    '/forget — Radera mig (GDPR, oåterkalleligt)',
    '',
    `Frågor? ${SUPPORT_EMAIL}`,
  ].join('\n');
}

export function buildStartUnregisteredMessage(chatId: string): string {
  return [
    '👋 Välkommen till KAMMAREN Watcher!',
    '',
    'Ditt Telegram-ID är:',
    `<code>${escapeHtml(chatId)}</code>`,
    '',
    '📋 Kopiera siffran och gå till',
    `<a href="${ONBOARD_URL}">kammaren.nu/watcher/start</a>`,
    'för att slutföra registreringen.',
  ].join('\n');
}

export function buildStartRegisteredMessage(profile: CustomerProfile): string {
  const since = profile.meta?.profile_last_updated_at
    ? new Date(profile.meta.profile_last_updated_at).toISOString().slice(0, 10)
    : 'tidigare';
  return [
    `✅ Du är redan registrerad sedan ${escapeHtml(since)}.`,
    '',
    'Skriv /status för din profil eller /help för alla commands.',
  ].join('\n');
}

export type StatusInputs = {
  profile: CustomerProfile;
  deliveryCount: number;
  lastDeliveryAt: Date | null;
  now: Date;
};

export function buildStatusMessage(inputs: StatusInputs): string {
  const { profile, deliveryCount, lastDeliveryAt, now } = inputs;
  const orgnr = profile.company_identity.company_registration_number;
  const companyName = asString(profile.company_identity.company_name) ?? '(okänt)';
  const isVat = bool((profile.tax_profile as Record<string, unknown>).is_vat_registered);
  const isEmployer = bool((profile.tax_profile as Record<string, unknown>).is_employer_registered);
  const since = profile.meta?.profile_last_updated_at
    ? new Date(profile.meta.profile_last_updated_at).toISOString().slice(0, 10)
    : 'tidigare';

  const lastNotice = lastDeliveryAt
    ? `${lastDeliveryAt.toISOString().slice(0, 10)} (${formatTimeAgoSv(now, lastDeliveryAt)})`
    : 'inga ännu';

  const pausedLine = profile.is_paused
    ? '\n⏸️ <b>Notiser pausade</b> — skriv /resume för att återuppta.'
    : '';

  return [
    `✅ Registrerad sedan ${escapeHtml(since)}${pausedLine}`,
    '',
    '📊 <b>Profil:</b>',
    `• Org: ${escapeHtml(orgnr)}`,
    `• Bolag: ${escapeHtml(companyName)}`,
    `• Momsregistrerad: ${isVat}`,
    `• Arbetsgivare: ${isEmployer}`,
    '',
    `📬 Senaste notis: ${escapeHtml(lastNotice)}`,
    `📈 Total levererade: ${deliveryCount}`,
    '',
    '🔧 /pause för paus, /forget för radering',
  ].join('\n');
}

export function buildPauseMessage(wasAlreadyPaused: boolean): string {
  if (wasAlreadyPaused) {
    return '⏸️ Notiser är redan pausade. Skriv /resume för att återuppta.';
  }
  return '⏸️ Notiser pausade. Skriv /resume för att återuppta.';
}

export function buildResumeMessage(wasAlreadyActive: boolean): string {
  if (wasAlreadyActive) {
    return '▶️ Notiser är redan aktiva.';
  }
  return '▶️ Notiser återupptagna.';
}

export function buildLegalMessage(): string {
  return [
    '📜 <b>KAMMAREN Watcher — Juridisk info</b>',
    '',
    `• <a href="${TERMS_URL}">Användarvillkor</a>`,
    `• <a href="${PRIVACY_URL}">Integritetspolicy</a>`,
    `• <a href="${SOURCE_URL}">Källkod (AGPL-3.0)</a>`,
    '',
    'Tjänsten riktas till svenska aktiebolag i näringsverksamhet.',
    'Ej rådgivning. Verifiera alltid med revisor.',
    '',
    `Frågor? ${SUPPORT_EMAIL}`,
  ].join('\n');
}

export function buildForgetPromptMessage(orgnr: string): string {
  return [
    '⚠️ <b>Du håller på att radera ALL data.</b>',
    'Detta är oåterkalleligt.',
    '',
    `Org: <code>${escapeHtml(orgnr)}</code>`,
    '',
    `Skriv <code>${FORGET_CONFIRM_TOKEN}</code> (versaler) för att bekräfta.`,
    'Giltig i 5 minuter, annars avbryts.',
  ].join('\n');
}

export function buildForgetCompletedMessage(): string {
  return [
    '✅ Raderad. Du får inga fler notiser.',
    '',
    'Bot-historiken kan du själv ta bort i Telegram.',
  ].join('\n');
}

export function buildForgetAlreadyDeletedMessage(): string {
  return '✅ Din data är redan raderad. Inga fler notiser skickas.';
}

export function buildForgetExpiredMessage(): string {
  return '⏱️ Bekräftelsen har gått ut. Skriv /forget igen om du vill radera.';
}

export function buildNotRegisteredMessage(): string {
  return [
    'Du är inte registrerad.',
    '',
    `Skriv /start för att börja, eller gå till <a href="${ONBOARD_URL}">kammaren.nu/watcher/start</a>.`,
  ].join('\n');
}

export function buildUnknownMessage(): string {
  return '🤖 Jag förstår bara commands. Skriv /help för listan.';
}

export function buildWelcomeAfterOnboardMessage(): string {
  return [
    '✅ Onboarding klar! Du är registrerad för KAMMAREN Watcher.',
    'Du får din första notis vid nästa körning (06:00 Stockholm).',
    'Skriv /help för commands.',
  ].join('\n');
}

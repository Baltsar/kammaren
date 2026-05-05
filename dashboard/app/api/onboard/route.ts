import { NextResponse } from 'next/server';
import { onboardSchema } from '@/lib/validation';
import { buildProfilePayload, commitProfile } from '@/lib/storage';
import { sendTelegramMessage, WELCOME_MESSAGE } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Ogiltig JSON i request body.' },
      { status: 400 },
    );
  }

  const parsed = onboardSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return NextResponse.json(
      {
        ok: false,
        error: first ? `${first.path.join('.')}: ${first.message}` : 'Validation failed',
      },
      { status: 400 },
    );
  }

  const profile = buildProfilePayload(parsed.data);

  let commit: Awaited<ReturnType<typeof commitProfile>>;
  try {
    commit = await commitProfile(profile);
  } catch (err) {
    console.error('[api/onboard] commit failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Kunde inte spara profilen i vault. Försök igen om en stund.' },
      { status: 502 },
    );
  }

  if (commit.status === 'already_exists') {
    return NextResponse.json(
      {
        ok: false,
        error:
          'En profil för det här organisationsnumret finns redan. Skriv /forget i Telegram-boten om du vill registrera om dig.',
      },
      { status: 409 },
    );
  }

  // Audit-trail till stdout — Vercel-loggar fångar detta.
  console.info(
    `[api/onboard] created orgnr=${profile.company_identity.company_registration_number} chat_id=${profile.telegram_chat_id} sha=${commit.sha}`,
  );

  // Välkomst-notis via Watcher-bottens token (samma som delivery använder).
  const token = process.env.TELEGRAM_BOT_TOKEN;
  let serverMessage: string | undefined;
  if (token) {
    const result = await sendTelegramMessage({
      token,
      chatId: profile.telegram_chat_id,
      text: WELCOME_MESSAGE,
    });
    if (!result.ok) {
      console.warn(`[api/onboard] welcome telegram failed: ${result.error}`);
      serverMessage =
        'Välkomstnotisen kunde inte skickas direkt — du får din första notis vid nästa körning.';
    }
  } else {
    console.warn('[api/onboard] TELEGRAM_BOT_TOKEN saknas — hoppar över välkomst-notis');
    serverMessage = 'Välkomstnotisen kunde inte skickas (token saknas i miljön).';
  }

  return NextResponse.json(
    { ok: true, orgnr: profile.company_identity.company_registration_number, message: serverMessage },
    { status: 201 },
  );
}

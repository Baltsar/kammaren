import { NextResponse } from 'next/server';
import { validateOrgnr } from '@/lib/luhn';
import { readProfileFromGithub } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  context: { params: { orgnr: string } },
): Promise<Response> {
  const orgnrValidation = validateOrgnr(context.params.orgnr);
  if (!orgnrValidation.ok) {
    return NextResponse.json(
      { ok: false, error: 'Ogiltigt organisationsnummer.' },
      { status: 400 },
    );
  }

  let profile: Awaited<ReturnType<typeof readProfileFromGithub>>;
  try {
    profile = await readProfileFromGithub(orgnrValidation.canonical);
  } catch (err) {
    console.error('[api/profile] read failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Kunde inte hämta profilen.' },
      { status: 502 },
    );
  }

  if (!profile) {
    return NextResponse.json(
      { ok: false, error: 'Profil saknas.' },
      { status: 404 },
    );
  }

  // Returnera en minimal publik-vy. Identitets-fält och consents lämnas inte
  // i klartext via API:t; dashboarden visar bara översiktlig status.
  return NextResponse.json({
    ok: true,
    profile: {
      orgnr: profile.company_identity.company_registration_number,
      company_name: profile.company_identity.company_name,
      is_paused: profile.is_paused,
      schema_version: profile.meta.schema_version,
      profile_last_updated_at: profile.meta.profile_last_updated_at,
    },
  });
}

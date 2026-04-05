/**
 * verify/year-guard.ts
 *
 * Guard som säkerställer att en skills constants matchar begärt inkomstår.
 * Importeras av alla calculate.ts — anropas som första rad i calculate().
 *
 * Syfte: Förhindra att 2026-regler används tyst för 2027 och framåt.
 * Om inkomståret inte matchar laddade constants kastas ett tydligt Error
 * med instruktion om vad som behöver skapas.
 */

export function assertInkomstar(
  constants_year: number,
  requested_year?: number,
): void {
  const current_year = new Date().getFullYear();
  const year = requested_year ?? current_year;

  if (year !== constants_year) {
    throw new Error(
      `KAMMAREN: Regler för inkomstår ${year} är inte tillgängliga. ` +
      `Laddade regler gäller ${constants_year}. ` +
      `constants-${year}.ts behöver skapas och verifieras ` +
      `mot Skatteverkets publicerade tabeller innan beräkning kan ske.`,
    );
  }
}

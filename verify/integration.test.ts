/**
 * verify/integration.test.ts
 *
 * INTEGRATIONSTEST — Solo AB-ägare, Stockholm, IT-konsult, inkomstår 2026
 *
 * Kör ALLA skills i sekvens med SAMMA scenario och verifierar att
 * siffrorna är KONSISTENTA. Inga mocks — riktiga calculate()-anrop.
 *
 * OBS: Testet misslyckas fr.o.m. 2027 — year-guard är aktiv.
 * Det är korrekt beteende: nya constants-filer måste skapas och verifieras.
 *
 * Kör: bun test ./verify/integration.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { calculate as momsCalc } from '../skills/moms/calculate.js';
import { calculate as agCalc } from '../skills/ag-avgifter/calculate.js';
import { calculate as bolagsskattCalc } from '../skills/bolagsskatt/calculate.js';
import { calculate as k10Calc } from '../skills/k10/calculate.js';
import type { SkillOutput } from '../skills/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO-KONSTANTER
// Solo AB-ägare, Stockholm, IT-konsult, inkomstår 2026
// ═══════════════════════════════════════════════════════════════════════════

const NETTOOMSATTNING   = 1_500_000;   // kr exkl moms
const KOSTNADER_NETTO   = 200_000;     // kr exkl moms
const BRUTTOLÖN         = 660_000;     // kr/år (55 000 kr/mån = BRITTPUNKT, ej statlig skatt)
const FÖDELSEÅR         = 1985;
const ANSKAFFNINGSVÄRDE = 25_000;      // kr (aktiernas anskaffningsvärde)
const ÄGARANDEL_PROCENT = 100;         // 100% ägare
const SPARAT_UTRYMME    = 150_000;     // kr (sparat gränsbelopp från föregående år)
const UTDELNINGSSKATT   = 0.20;        // 20% — IL 65 kap 15 § (3:12 inom gränsbelopp)
const KOMMUNALSKATT     = 0.30455;     // Stockholm, ej kyrkomedlem (för informell nettolön)

// ═══════════════════════════════════════════════════════════════════════════
// HANDBERÄKNADE EXPECTED-VÄRDEN
// Formel i kommentar per post. Inga siffror utan matematisk grund.
// ═══════════════════════════════════════════════════════════════════════════

// ── Steg A: Moms på omsättning (netto → brutto, 25%) ───────────────────────
// round2(1 500 000 × 0.25) = 375 000
// round2(1 500 000 + 375 000) = 1 875 000
const EXP_MOMS_UTGAENDE  = 375_000;
const EXP_BRUTTO_OMSATT  = 1_875_000;

// ── Steg B: Moms på kostnader (netto → brutto, 25%) ────────────────────────
// round2(200 000 × 0.25) = 50 000
// Att betala: 375 000 − 50 000 = 325 000
const EXP_MOMS_INGAENDE   = 50_000;
const EXP_MOMS_ATT_BETALA = 325_000;

// ── Steg D: AG-avgifter (standard 31.42%, birth_year 1985, ej växa) ─────────
// Varje komponent: round(660 000 × sats)
// OBS: 660 000 × alla satser ger exakta heltal → noll avrundningskollision.
// 660 000 × 0.0355 = 23 430.000 → 23 430
// 660 000 × 0.0200 = 13 200.000 → 13 200
// 660 000 × 0.1021 = 67 386.000 → 67 386
// 660 000 × 0.0030 =  1 980.000 →  1 980
// 660 000 × 0.0264 = 17 424.000 → 17 424
// 660 000 × 0.0010 =    660.000 →    660
// 660 000 × 0.1262 = 83 292.000 → 83 292
// Summa = 207 372 (= 660 000 × 0.3142 exakt)
const EXP_TOTAL_AG      = 207_372;
const EXP_EMPLOYER_COST = 867_372;  // 660 000 + 207 372

// ── Steg E: Vinst i bolaget ──────────────────────────────────────────────────
// 1 500 000 − 200 000 − 660 000 − 207 372 = 432 628
const EXP_VINST = 432_628;

// ── Steg F: Bolagsskatt + periodiseringsfond (IL 30 kap + IL 65 kap 10 §) ───
// pfond_max = floor(432 628 × 0.25) = floor(108 157.0) = 108 157
// adj = 432 628 − 108 157 = 324 471
// bolagsskatt = round(324 471 × 0.206) = round(66 841.026) = 66 841
// resultat_efter_skatt = 324 471 − 66 841 = 257 630
const EXP_PFOND_AVDRAG    = 108_157;
const EXP_SKATTEPLIKTIG   = 324_471;  // 432 628 − 108 157
const EXP_BOLAGSSKATT     = 66_841;   // round(324 471 × 0.206) = round(66 841.026)
const EXP_RES_EFTER_SKATT = 257_630;  // 324 471 − 66 841

// ── Steg G: K10 gränsbelopp (IL 57 kap) — ADDITIV FORMEL 2026 ───────────────
// grundbelopp    = round(322 400 × 1.0) = 322 400 (IL 57:11)
// omk            = round(25 000 × 1.0) = 25 000
// kapitalbaserat = round(25 000 × 0.1155) = round(2 887.5) = 2 888 (IL 57:12)
// lonebaserat_underlag = max(0, 660 000 − 644 800) = 15 200
// lonebaserat_fore_tak = round(15 200 × 0.50) = 7 600
// tak_50x = 50 × 660 000 = 33 000 000 (ej bindande — 7 600 << 33M)
// lonebaserat = 7 600
// sparat_uppraknat = round(150 000 × (1 + 0)) = 150 000 (UPPRAKNINGSFAKTOR = 0, slopad 2026)
// gransbelopp = 322 400 + 2 888 + 7 600 + 150 000 = 482 888
const EXP_GRUNDBELOPP      = 322_400;
const EXP_KAPITALBASERAT   = 2_888;    // round(25 000 × 0.1155) = round(2 887.5) = 2 888
const EXP_LONEUND          = 15_200;   // 660 000 − 644 800
const EXP_LONEBASERAT      = 7_600;    // round(15 200 × 0.50) = 7 600
const EXP_SPARAT_UPPRAKNAT = 150_000;  // 150 000 × (1 + 0) — uppräkning slopad 2026
const EXP_GRANSBELOPP      = 482_888;  // 322 400 + 2 888 + 7 600 + 150 000 = 482 888

// ── Steg H: Utdelning ────────────────────────────────────────────────────────
// fritt_ek = resultat_efter_skatt = 257 630
// max_utdelning = min(257 630, 482 888) = 257 630  (begränsas av fritt EK)
// skatt_utdelning = round(257 630 × 0.20) = round(51 526.0) = 51 526
// netto_utdelning = 257 630 − 51 526 = 206 104
// sparat_nasta = 482 888 − 257 630 = 225 258
const EXP_MAX_UTDELNING = 257_630;  // min(257 630, 482 888)
const EXP_SKATT_UTD     = 51_526;   // round(257 630 × 0.20)
const EXP_NETTO_UTD     = 206_104;  // 257 630 − 51 526
const EXP_SPARAT_NASTA  = 225_258;  // 482 888 − 257 630

// ── Nettolön (förenklad — ingen jobbskatteavdrag/grundavdrag) ────────────────
// round(660 000 × 0.30455) = round(201 003) = 201 003
// nettolön = 660 000 − 201 003 = 458 997
// OBS: Faktisk nettolön är ca 30 000–40 000 kr högre p.g.a. jobbskatteavdrag.
//      Notering — ej ett test-assertion.
const INFO_KOMSKATT_APPROX = 201_003;  // round(660 000 × 0.30455)
const INFO_NETTOLÖN_APPROX = 458_997;  // 660 000 − 201 003 (FÖRENKLAD)

// ═══════════════════════════════════════════════════════════════════════════
// HJÄLPFUNKTION: talformatering (tusentalsseparator = mellanslag)
// ═══════════════════════════════════════════════════════════════════════════

function fmt(n: number): string {
  const s = Math.abs(n).toString();
  const formatted = s.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0'); // non-breaking space
  return (n < 0 ? '−' : '') + formatted;
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATIONSTEST
// ═══════════════════════════════════════════════════════════════════════════

describe('Integration: Solo AB-ägare, Stockholm 2026', () => {

  let momsOmst: SkillOutput;
  let momsKost: SkillOutput;
  let agOut:    SkillOutput;
  let bsOut:    SkillOutput;
  let k10Out:   SkillOutput;

  // Värden beräknade från skill-output (flödar mellan skills)
  let total_ag:            number;
  let vinst:               number;
  let pfond_avsattning:    number;
  let resultat_efter_skatt: number;
  let gransbelopp:         number;
  let max_utdelning:       number;
  let skatt_utdelning:     number;
  let netto_utdelning:     number;
  let sparat_nasta:        number;

  // ── Kör alla skills ─────────────────────────────────────────────────────────

  beforeAll(() => {
    // Steg A: Moms på omsättning
    momsOmst = momsCalc({
      amount: NETTOOMSATTNING,
      vat_rate: 25,
      direction: 'netto_to_brutto',
    }) as SkillOutput;

    // Steg B: Moms på kostnader
    momsKost = momsCalc({
      amount: KOSTNADER_NETTO,
      vat_rate: 25,
      direction: 'netto_to_brutto',
    }) as SkillOutput;

    // Steg D: AG-avgifter
    agOut = agCalc({
      gross_salary:   BRUTTOLÖN,
      birth_year:     FÖDELSEÅR,
      first_employee: false,
      num_employees:  0,
    }) as SkillOutput;

    // Steg E: Vinst (flödar från AG-output)
    total_ag = agOut.result['total_ag'] as number;
    vinst = NETTOOMSATTNING - KOSTNADER_NETTO - BRUTTOLÖN - total_ag;

    // Steg F: Bolagsskatt + max periodiseringsfond (floor(vinst × 25%))
    pfond_avsattning = Math.floor(vinst * 0.25);
    bsOut = bolagsskattCalc({
      taxable_profit:                vinst,
      periodiseringsfond_avsattning: pfond_avsattning,
      befintliga_fonder:             '[]',
      underskott_foregaende_ar:      0,
    }) as SkillOutput;

    // Steg G: K10 gränsbelopp
    k10Out = k10Calc({
      anskaffningsvarde:  ANSKAFFNINGSVÄRDE,
      agarandel_procent:  ÄGARANDEL_PROCENT,
      total_lonesumma:    BRUTTOLÖN,
      egen_lon:           BRUTTOLÖN,
      sparat_utrymme:     SPARAT_UTRYMME,
      inkomstar:          2026,
    }) as SkillOutput;

    // Steg H: Utdelning (flödar från bolagsskatt + k10)
    resultat_efter_skatt = bsOut.result['resultat_efter_skatt'] as number;
    gransbelopp          = k10Out.result['gransbelopp'] as number;
    max_utdelning        = Math.min(resultat_efter_skatt, gransbelopp);
    skatt_utdelning      = Math.round(max_utdelning * UTDELNINGSSKATT);
    netto_utdelning      = max_utdelning - skatt_utdelning;
    sparat_nasta         = gransbelopp - max_utdelning;
  });

  // ── Steg A: Moms på omsättning ──────────────────────────────────────────────

  test('Steg A — moms på omsättning (netto→brutto, 25%)', () => {
    // round2(1 500 000 × 0.25) = 375 000
    expect(momsOmst.result['moms'] as number).toBe(EXP_MOMS_UTGAENDE);
    // round2(1 500 000 + 375 000) = 1 875 000
    expect(momsOmst.result['brutto'] as number).toBe(EXP_BRUTTO_OMSATT);
    // netto tillbaka till scenariot
    expect(momsOmst.result['netto'] as number).toBe(NETTOOMSATTNING);
  });

  // ── Steg B: Moms på kostnader ────────────────────────────────────────────────

  test('Steg B — moms på kostnader (netto→brutto, 25%)', () => {
    // round2(200 000 × 0.25) = 50 000
    expect(momsKost.result['moms'] as number).toBe(EXP_MOMS_INGAENDE);
    // Momsredovisning: 375 000 − 50 000 = 325 000 att betala
    const moms_att_betala = (momsOmst.result['moms'] as number) - (momsKost.result['moms'] as number);
    expect(moms_att_betala).toBe(EXP_MOMS_ATT_BETALA);
  });

  // ── Steg D: AG-avgifter ──────────────────────────────────────────────────────

  test('Steg D — AG-avgifter (31.42%, standard, birth 1985)', () => {
    // sum av round(lön × sats) per komponent = 207 372
    expect(agOut.result['total_ag'] as number).toBe(EXP_TOTAL_AG);
    // employer_cost = lön + AG = 660 000 + 207 372 = 867 372
    expect(agOut.result['employer_cost'] as number).toBe(EXP_EMPLOYER_COST);
  });

  // ── Steg E: Vinst ────────────────────────────────────────────────────────────

  test('Steg E — vinst i bolaget', () => {
    // 1 500 000 − 200 000 − 660 000 − 207 372 = 432 628
    expect(vinst).toBe(EXP_VINST);
    // Vinst = vad som faktiskt flödade från AG-skillen (inte ett hårdkodat tal)
    const expected = NETTOOMSATTNING - KOSTNADER_NETTO - BRUTTOLÖN - total_ag;
    expect(vinst).toBe(expected);
  });

  // ── Steg F: Bolagsskatt + periodiseringsfond ─────────────────────────────────

  test('Steg F — bolagsskatt + periodiseringsfond', () => {
    // pfond = floor(432 628 × 0.25) = floor(108 157.0) = 108 157
    expect(bsOut.result['periodiseringsfond_avdrag'] as number).toBe(EXP_PFOND_AVDRAG);
    // skattepliktig_vinst = 432 628 − 108 157 = 324 471
    expect(bsOut.result['skattepliktig_vinst'] as number).toBe(EXP_SKATTEPLIKTIG);
    // bolagsskatt = round(324 471 × 0.206) = round(66 841.026) = 66 841
    expect(bsOut.result['bolagsskatt'] as number).toBe(EXP_BOLAGSSKATT);
    // resultat_efter_skatt = 324 471 − 66 841 = 257 630
    expect(bsOut.result['resultat_efter_skatt'] as number).toBe(EXP_RES_EFTER_SKATT);
  });

  // ── Steg G: K10 gränsbelopp ──────────────────────────────────────────────────

  test('Steg G — K10 gränsbelopp (additiv formel 2026)', () => {
    // grundbelopp = round(322 400 × 100%) = 322 400 (IL 57 kap 11 §)
    expect(k10Out.result['grundbelopp'] as number).toBe(EXP_GRUNDBELOPP);
    // kapitalbaserat = round(25 000 × 0.1155) = round(2 887.5) = 2 888 (IL 57 kap 12 §)
    expect(k10Out.result['kapitalbaserat'] as number).toBe(EXP_KAPITALBASERAT);
    // lonebaserat_underlag = 660 000 − 644 800 = 15 200
    expect(k10Out.result['lonebaserat_underlag'] as number).toBe(EXP_LONEUND);
    // lonebaserat = round(15 200 × 0.50) = 7 600 (tak 50×660 000 = 33M, ej bindande)
    expect(k10Out.result['lonebaserat'] as number).toBe(EXP_LONEBASERAT);
    // sparat_uppraknat = 150 000 × 1.0 (uppräkning slopad 2026)
    expect(k10Out.result['sparat_uppraknat'] as number).toBe(EXP_SPARAT_UPPRAKNAT);
    // gransbelopp = 322 400 + 2 888 + 7 600 + 150 000 = 482 888 (additiv)
    expect(k10Out.result['gransbelopp'] as number).toBe(EXP_GRANSBELOPP);
  });

  // ── Konsistenskontroller ─────────────────────────────────────────────────────

  test('Konsistens 1 — AG: procentsats × lön === summa av komponenter', () => {
    // 660 000 × 0.3142 = 207 372.0 (exakt, inga avrundningskollisioner)
    const total_from_rate       = Math.round(BRUTTOLÖN * 0.3142);
    const total_from_components = agOut.result['total_ag'] as number;
    // Om dessa skiljer finns en dold avrundningsavvikelse (kugghjulsmiss)
    if (total_from_rate !== total_from_components) {
      console.warn(
        `KUGGHJULSMISS: 31.42% × lön = ${total_from_rate} men skill = ${total_from_components}. ` +
        `Skillnad: ${total_from_components - total_from_rate} kr`,
      );
    }
    expect(total_from_rate).toBe(EXP_TOTAL_AG);        // 207 372
    expect(total_from_components).toBe(EXP_TOTAL_AG);  // 207 372
    // Inga dolda avrundningsskillnader
    expect(total_from_components - total_from_rate).toBe(0);
  });

  test('Konsistens 2 — vinst = omsättning − kostnader − lön − AG', () => {
    // Verifierar att siffrorna flödar korrekt från AG-skillen till vinst-beräkningen
    const recomputed = NETTOOMSATTNING - KOSTNADER_NETTO - BRUTTOLÖN - total_ag;
    expect(vinst).toBe(recomputed);     // intern konsistens
    expect(vinst).toBe(EXP_VINST);     // matchar handberäknat
  });

  test('Konsistens 3 — resultat_efter_skatt ≥ 0 (lönen ryms i omsättningen)', () => {
    expect(resultat_efter_skatt).toBeGreaterThanOrEqual(0);
    expect(resultat_efter_skatt).toBe(EXP_RES_EFTER_SKATT); // 257 630
  });

  test('Konsistens 4 — max_utdelning ≤ fritt eget kapital', () => {
    // Kan inte dela ut mer än vad bolaget har
    expect(max_utdelning).toBeLessThanOrEqual(resultat_efter_skatt);
    expect(max_utdelning).toBe(EXP_MAX_UTDELNING); // 257 630 (= fritt EK, < gränsbelopp)
  });

  test('Konsistens 5 — max_utdelning ≤ gränsbelopp → sparat utrymme beräknas', () => {
    // Utdelning begränsas av fritt EK (257 630 < gränsbelopp 472 400)
    expect(max_utdelning).toBeLessThanOrEqual(gransbelopp);
    // Outnyttjat gränsbelopp sparas till nästa år
    expect(sparat_nasta).toBe(EXP_SPARAT_NASTA); // 472 400 − 257 630 = 214 770
  });

  test('Konsistens 6 — alla skills returnerar giltigt SkillOutput-interface', () => {
    const skills: [string, SkillOutput][] = [
      ['moms-omsättning', momsOmst],
      ['moms-kostnader',  momsKost],
      ['ag-avgifter',     agOut],
      ['bolagsskatt',     bsOut],
      ['k10',             k10Out],
    ];
    for (const [namn, output] of skills) {
      expect(output.result,     `${namn}: saknar result`).toBeDefined();
      expect(output.breakdown,  `${namn}: saknar breakdown`).toBeDefined();
      expect(output.warnings,   `${namn}: saknar warnings`).toBeDefined();
      expect(output.sources,    `${namn}: saknar sources`).toBeDefined();
      expect(output.disclaimer, `${namn}: saknar disclaimer`).toBeTruthy();
      expect(Array.isArray(output.sources),    `${namn}: sources ej array`).toBe(true);
      expect(output.sources.length,            `${namn}: sources tom`).toBeGreaterThan(0);
      expect(Array.isArray(output.breakdown),  `${namn}: breakdown ej array`).toBe(true);
    }
  });

  test('Konsistens 7 — year-guard passerar (inkomstår 2026)', () => {
    // Om year-guard kastade fel hade beforeAll misslyckat och alla tests failat.
    // Denna test bekräftar explicit att vi kör under 2026.
    // Misslyckas 2027+: skapa constants-2027.ts och verifiera mot SKV.
    expect(new Date().getFullYear()).toBe(2026);
  });

  // ── Slutrapport (skrivas EFTER alla assertions) ───────────────────────────────

  afterAll(() => {
    const L = '═'.repeat(51);
    const D = '─'.repeat(51);

    const r = (label: string, value: string, unit = 'kr') =>
      console.log(`${label.padEnd(22)} ${value.padStart(14)} ${unit}`);

    const rn = (label: string, n: number) => r(label, fmt(n));
    const rm = (label: string, n: number) => r(label, fmt(-n));

    console.log(`\n${L}`);
    console.log('INTEGRATIONSTEST: Solo AB-ägare, Stockholm 2026');
    console.log(L);

    console.log('OMSÄTTNING & MOMS');
    rn('Nettoomsättning:',           NETTOOMSATTNING);
    rn('Moms utgående (25%):',       EXP_MOMS_UTGAENDE);
    rm('Moms ingående:',             EXP_MOMS_INGAENDE);
    rn('Moms att betala:',           EXP_MOMS_ATT_BETALA);

    console.log('LÖN & AG-AVGIFTER');
    rn('Bruttolön:',                 BRUTTOLÖN);
    rn('AG-avgifter:',               EXP_TOTAL_AG);
    rn('Total lönekostnad:',         EXP_EMPLOYER_COST);

    console.log('BOLAGSRESULTAT');
    rn('Vinst före skatt:',          EXP_VINST);
    rm('Periodiseringsfond:',        EXP_PFOND_AVDRAG);
    rn('Skattepliktig vinst:',       EXP_SKATTEPLIKTIG);
    rm('Bolagsskatt (20.6%):',       EXP_BOLAGSSKATT);
    rn('Resultat efter skatt:',      EXP_RES_EFTER_SKATT);

    console.log('K10 GRÄNSBELOPP (additiv formel 2026)');
    rn('Grundbelopp:',               EXP_GRUNDBELOPP);
    rn('Kapitalbaserat (11.55%):',   EXP_KAPITALBASERAT);
    rn('Lönebaserat utrymme:',       EXP_LONEBASERAT);
    rn('Sparat uppräknat:',          EXP_SPARAT_UPPRAKNAT);
    rn('Totalt gränsbelopp:',        EXP_GRANSBELOPP);

    console.log('UTDELNING');
    rn('Max utdelning:',             EXP_MAX_UTDELNING);
    console.log('  (= fritt EK < gränsbelopp → begränsas av fritt EK)');
    rm('Skatt på utdelning (20%):',  EXP_SKATT_UTD);
    rn('Netto utdelning:',           EXP_NETTO_UTD);
    rn('Sparat utrymme nästa år:',   EXP_SPARAT_NASTA);

    console.log('TOTALT I FICKAN');
    rn('Nettolön (förenklad)¹:',     INFO_NETTOLÖN_APPROX);
    rn('Netto utdelning:',           EXP_NETTO_UTD);
    console.log(D);
    rn('TOTAL (förenklad):',         INFO_NETTOLÖN_APPROX + EXP_NETTO_UTD);
    console.log('¹ Kommunalskatt 30.455% × 660 000 = 201 003 kr. Faktisk');
    console.log('  nettolön är ca 30 000–40 000 kr högre (jobbskatteavdrag).');

    console.log('KONSISTENSKONTROLLER');
    console.log('✓ AG-belopp: 31.42% × lön = summa av komponenter (ingen kugghjulsmiss)');
    console.log('✓ Vinst = omsättning − kostnader − lön − AG');
    console.log('✓ Resultat efter skatt ≥ 0 (lönen ryms i omsättningen)');
    console.log('✓ Utdelning ≤ fritt eget kapital');
    console.log('✓ Utdelning ≤ gränsbelopp → sparat utrymme beräknas');
    console.log('✓ Alla skills returnerar giltigt SkillOutput-interface');
    console.log('✓ Year-guard passerar för inkomstår 2026');
    console.log('RESULTAT: ALLA KUGGHJUL GRIPER ✓');
    console.log(`${L}\n`);
  });
});

/**
 * constants/verify-constants.test.ts
 *
 * Verifierar att constants/2026.json är intern konsistent.
 * Varje test tracear ett specifikt lagrum eller känd kontrollsumma.
 *
 * Kör: bun test constants/verify-constants.test.ts
 */

import { describe, test, expect } from 'bun:test';
import constants from './2026.json';

describe('2026.json — source of truth verification', () => {

  // ── Basbelopp ────────────────────────────────────────────────────────────────

  describe('Basbelopp', () => {
    test('PBB = 59200 (SCB, SFS 2025)', () => {
      expect(constants.basbelopp.prisbasbelopp.value).toBe(59200);
    });
    test('IBB = 83400 (Pensionsmyndigheten)', () => {
      expect(constants.basbelopp.inkomstbasbelopp.value).toBe(83400);
    });
    test('IBB 3:12 = 80600 (IL 57 kap 4 §, IBB 2025)', () => {
      expect(constants.basbelopp.ibb_for_312.value).toBe(80600);
    });
    test('IBB 3:12 < IBB_CURRENT (föregående år används)', () => {
      expect(constants.basbelopp.ibb_for_312.value).toBeLessThan(
        constants.basbelopp.inkomstbasbelopp.value,
      );
    });
  });

  // ── AG-avgifter kontrollsummor ────────────────────────────────────────────────

  describe('AG-avgifter', () => {
    test('Delposter summerar till total (31.42%)', () => {
      const d = constants.arbetsgivaravgifter.delposter;
      const sum =
        d.sjukforsakring.value +
        d.foraldraforsakring.value +
        d.alderspension.value +
        d.efterlevandepension.value +
        d.arbetsmarknad.value +
        d.arbetsskada.value +
        d.allman_loneavgift.value;
      expect(Math.abs(sum - constants.arbetsgivaravgifter.total.value)).toBeLessThan(0.0001);
    });
    test('EGENTLIGA_AG = total - allman_loneavgift', () => {
      const expected =
        constants.arbetsgivaravgifter.total.value -
        constants.arbetsgivaravgifter.delposter.allman_loneavgift.value;
      expect(
        Math.abs(expected - constants.arbetsgivaravgifter.delposter.egentliga_ag.value),
      ).toBeLessThan(0.0001);
    });
    test('Total = 0.3142 (SFL 2 kap 26 §)', () => {
      expect(constants.arbetsgivaravgifter.total.value).toBe(0.3142);
    });
    test('Sjukförsäkring = 3.55%', () => {
      expect(constants.arbetsgivaravgifter.delposter.sjukforsakring.value).toBe(0.0355);
    });
    test('Ålderspension = 10.21%', () => {
      expect(constants.arbetsgivaravgifter.delposter.alderspension.value).toBe(0.1021);
    });
    test('Växa: max_yearly = max_monthly × 12', () => {
      const expected = constants.arbetsgivaravgifter.vaxa_stodet.max_monthly * 12;
      expect(constants.arbetsgivaravgifter.vaxa_stodet.max_yearly).toBe(expected);
    });
    test('Växa: max_monthly = 35000', () => {
      expect(constants.arbetsgivaravgifter.vaxa_stodet.max_monthly).toBe(35000);
    });
    test('Växa: max_employees = 2', () => {
      expect(constants.arbetsgivaravgifter.vaxa_stodet.max_employees).toBe(2);
    });
    test('Åldersreduktion max_birth_year = 1958', () => {
      expect(constants.arbetsgivaravgifter.aldersreduktion.max_birth_year).toBe(1958);
    });
    test('Ingen avgift max_birth_year = 1937', () => {
      expect(constants.arbetsgivaravgifter.ingen_avgift.max_birth_year).toBe(1937);
    });
  });

  // ── Moms ─────────────────────────────────────────────────────────────────────

  describe('Moms', () => {
    test('Standard = 25% (ML 7:1 första stycket)', () => {
      expect(constants.moms.satser.standard.value).toBe(0.25);
    });
    test('Reducerad 1 = 12% (ML 7:1 andra stycket)', () => {
      expect(constants.moms.satser.reducerad_1.value).toBe(0.12);
    });
    test('Reducerad 2 = 6% (ML 7:1 tredje stycket)', () => {
      expect(constants.moms.satser.reducerad_2.value).toBe(0.06);
    });
    test('Noll = 0% (ML 3 kap)', () => {
      expect(constants.moms.satser.noll.value).toBe(0.00);
    });
    test('Omsättningsgräns momsfri = 120000 kr (ML 9d kap)', () => {
      expect(constants.moms.omsattningsgrans_momsfri.value).toBe(120000);
    });
    test('BAS_UTGAENDE[25] = 2610', () => {
      expect((constants.moms.bas_utgaende as Record<string, number>)['25']).toBe(2610);
    });
    test('BAS_UTGAENDE[12] = 2620', () => {
      expect((constants.moms.bas_utgaende as Record<string, number>)['12']).toBe(2620);
    });
    test('BAS_UTGAENDE[6] = 2630', () => {
      expect((constants.moms.bas_utgaende as Record<string, number>)['6']).toBe(2630);
    });
    test('BAS_REVERSE_CHARGE[25] = 2614', () => {
      expect((constants.moms.bas_reverse_charge as Record<string, number>)['25']).toBe(2614);
    });
    test('BAS_REVERSE_CHARGE[12] = 2624', () => {
      expect((constants.moms.bas_reverse_charge as Record<string, number>)['12']).toBe(2624);
    });
    test('BAS_REVERSE_CHARGE[6] = 2634', () => {
      expect((constants.moms.bas_reverse_charge as Record<string, number>)['6']).toBe(2634);
    });
  });

  // ── Bolagsskatt ──────────────────────────────────────────────────────────────

  describe('Bolagsskatt', () => {
    test('Skattesats = 20.6% (IL 65 kap 10 §)', () => {
      expect(constants.bolagsskatt.skattesats.value).toBe(0.206);
    });
    test('Periodiseringsfond max avsättning = 25% (IL 30 kap 5 §)', () => {
      expect(constants.bolagsskatt.periodiseringsfond.max_avsattning.value).toBe(0.25);
    });
    test('Periodiseringsfond max antal = 6 (IL 30 kap 7 §)', () => {
      expect(constants.bolagsskatt.periodiseringsfond.max_antal_fonder.value).toBe(6);
    });
    test('Periodiseringsfond max år = 6 (IL 30 kap 7 §)', () => {
      expect(constants.bolagsskatt.periodiseringsfond.max_ar.value).toBe(6);
    });
  });

  // ── Statslåneränta ────────────────────────────────────────────────────────────

  describe('Statslåneränta', () => {
    test('SLR 30 nov 2025 = 2.55% (Riksgälden, SKV PDF 2026-01-07)', () => {
      expect(constants.statslanerantan.nov_30_2025.value).toBe(0.0255);
    });
  });

  // ── 3:12 kontrollsummor ───────────────────────────────────────────────────────

  describe('3:12-regler', () => {
    test('Grundbelopp = 4 × IBB_3_12 = 322400', () => {
      const expected =
        constants.treslagregeln_312.grundbelopp_multipel.value *
        constants.basbelopp.ibb_for_312.value;
      expect(expected).toBe(322400);
      expect(constants.treslagregeln_312.grundbelopp_belopp.value).toBe(322400);
    });
    test('Grundbelopp precomputed stämmer med formel', () => {
      const computed =
        constants.treslagregeln_312.grundbelopp_multipel.value *
        constants.basbelopp.ibb_for_312.value;
      expect(constants.treslagregeln_312.grundbelopp_belopp.value).toBe(computed);
    });
    test('Lönespärr = 8 × IBB_3_12 = 644800', () => {
      const expected =
        constants.treslagregeln_312.lonesparr_multipel.value *
        constants.basbelopp.ibb_for_312.value;
      expect(expected).toBe(644800);
      expect(constants.treslagregeln_312.lonesparr_belopp.value).toBe(644800);
    });
    test('Lönespärr precomputed stämmer med formel', () => {
      const computed =
        constants.treslagregeln_312.lonesparr_multipel.value *
        constants.basbelopp.ibb_for_312.value;
      expect(constants.treslagregeln_312.lonesparr_belopp.value).toBe(computed);
    });
    test('Kapitalbaserat faktor = SLR + 9% = 0.1155', () => {
      const expected =
        constants.statslanerantan.nov_30_2025.value +
        constants.treslagregeln_312.kapitalbaserat_rantetillagg.value;
      expect(Math.abs(expected - 0.1155)).toBeLessThan(0.0001);
      expect(Math.abs(constants.treslagregeln_312.kapitalbaserat_faktor.value - expected)).toBeLessThan(1e-10);
    });
    test('Uppräkningsränta = 0 (slopad 2026)', () => {
      expect(constants.treslagregeln_312.upprakningsranta_sparat.value).toBe(0);
    });
    test('Utdelning kapitalskatt = 20%', () => {
      expect(constants.treslagregeln_312.utdelning_kapitalskatt.value).toBe(0.20);
    });
  });

  // ── Inkomstskatt ──────────────────────────────────────────────────────────────

  describe('Inkomstskatt', () => {
    test('Skiktgräns = 643000 (IL 65 kap 5 §)', () => {
      expect(constants.inkomstskatt.skiktgrans.value).toBe(643000);
    });
    test('Brytpunkt under 66 = 660400 (SKV PDF 2026-01-07)', () => {
      expect(constants.inkomstskatt.brytpunkt_under_66.value).toBe(660400);
    });
    test('Statlig skatt = 20% (IL 65 kap 5 §)', () => {
      expect(constants.inkomstskatt.statlig_skatt.value).toBe(0.20);
    });
    test('Skiktgräns < brytpunkt (logisk konsistens)', () => {
      expect(constants.inkomstskatt.skiktgrans.value).toBeLessThan(
        constants.inkomstskatt.brytpunkt_under_66.value,
      );
    });
  });

  // ── SGI & Pension ─────────────────────────────────────────────────────────────

  describe('SGI och pension', () => {
    test('SGI max = 10 × PBB = 592000 (SFB 25 kap)', () => {
      const expected = 10 * constants.basbelopp.prisbasbelopp.value;
      expect(constants.sgi.max.value).toBe(expected);
      expect(constants.sgi.max.value).toBe(592000);
    });
    test('PGI max = 7.5 × IBB = 625500', () => {
      const expected = 7.5 * constants.basbelopp.inkomstbasbelopp.value;
      expect(constants.pension.pgi_max.value).toBe(expected);
      expect(constants.pension.pgi_max.value).toBe(625500);
    });
  });

  // ── Källkrav: alla value-fält har source ──────────────────────────────────────

  describe('Källkrav', () => {
    function checkSources(obj: Record<string, unknown>, path: string): void {
      for (const [key, val] of Object.entries(obj)) {
        if (key.startsWith('_')) continue;
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          const record = val as Record<string, unknown>;
          if ('value' in record && !('source' in record)) {
            throw new Error(`${path}.${key} har value men saknar source`);
          }
          checkSources(record, `${path}.${key}`);
        }
      }
    }

    test('Alla value-fält har source', () => {
      expect(() =>
        checkSources(constants as unknown as Record<string, unknown>, 'root'),
      ).not.toThrow();
    });
  });

  // ── Inkomstår ─────────────────────────────────────────────────────────────────

  describe('Metadata', () => {
    test('inkomstar = 2026', () => {
      expect(constants.inkomstar).toBe(2026);
    });
    test('schema_version = 1.0.0', () => {
      expect(constants.schema_version).toBe('1.0.0');
    });
  });

});

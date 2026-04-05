// KOMMUN-SKATTESATSER 2026
// Source: SCB "Totala kommunala skattesatser 2026, kommunvis"
// Skatteverket "Belopp och procent 2026"
// KI = kommunalskatt + landstingsskatt (EXKLUSIVE kyrkoavgift och begravningsavgift)

export interface KommunSkattesats {
  kommun: string;
  kommunalskatt: number;
  begravningsavgift: number;
  kyrkoavgift_snitt: number;
}

export const KOMMUN_DATA: Record<string, KommunSkattesats> = {
  "stockholm": {
    kommun: "Stockholm",
    kommunalskatt: 0.3055,
    begravningsavgift: 0.0007,
    kyrkoavgift_snitt: 0.0100,
  },
  "göteborg": {
    kommun: "Göteborg",
    kommunalskatt: 0.3327,
    begravningsavgift: 0.00292,
    kyrkoavgift_snitt: 0.0100,
  },
  "malmö": {
    kommun: "Malmö",
    kommunalskatt: 0.3295,
    begravningsavgift: 0.00292,
    kyrkoavgift_snitt: 0.0100,
  },
  "uppsala": {
    kommun: "Uppsala",
    kommunalskatt: 0.3255,
    begravningsavgift: 0.00292,
    kyrkoavgift_snitt: 0.0100,
  },
  "linköping": {
    kommun: "Linköping",
    kommunalskatt: 0.3165,
    begravningsavgift: 0.00292,
    kyrkoavgift_snitt: 0.0100,
  },
  "örebro": {
    kommun: "Örebro",
    kommunalskatt: 0.3280,
    begravningsavgift: 0.00292,
    kyrkoavgift_snitt: 0.0100,
  },
  "västerås": {
    kommun: "Västerås",
    kommunalskatt: 0.3080,
    begravningsavgift: 0.00292,
    kyrkoavgift_snitt: 0.0100,
  },
  "helsingborg": {
    kommun: "Helsingborg",
    kommunalskatt: 0.3107,
    begravningsavgift: 0.00292,
    kyrkoavgift_snitt: 0.0100,
  },
  "norrköping": {
    kommun: "Norrköping",
    kommunalskatt: 0.3305,
    begravningsavgift: 0.00292,
    kyrkoavgift_snitt: 0.0100,
  },
  "jönköping": {
    kommun: "Jönköping",
    kommunalskatt: 0.3195,
    begravningsavgift: 0.00292,
    kyrkoavgift_snitt: 0.0100,
  },
  "lund": {
    kommun: "Lund",
    kommunalskatt: 0.3235,
    begravningsavgift: 0.00292,
    kyrkoavgift_snitt: 0.0100,
  },
  "umeå": {
    kommun: "Umeå",
    kommunalskatt: 0.3400,
    begravningsavgift: 0.00292,
    kyrkoavgift_snitt: 0.0100,
  },
  "sundsvall": {
    kommun: "Sundsvall",
    kommunalskatt: 0.3382,
    begravningsavgift: 0.00292,
    kyrkoavgift_snitt: 0.0100,
  },
  "karlstad": {
    kommun: "Karlstad",
    kommunalskatt: 0.3297,
    begravningsavgift: 0.00292,
    kyrkoavgift_snitt: 0.0100,
  },
  "dorotea": {
    kommun: "Dorotea",
    kommunalskatt: 0.3565,
    begravningsavgift: 0.00292,
    kyrkoavgift_snitt: 0.0100,
  },
};

export interface ResolvedRates {
  KI: number;
  burial: number;
  church: number;
  total: number;
}

export function resolveRates(
  kommun: string,
  churchMember: boolean,
  municipalTaxRateOverride?: number
): ResolvedRates {
  const data = KOMMUN_DATA[kommun.toLowerCase()];
  if (!data && municipalTaxRateOverride === undefined) {
    throw new Error(
      `Kommun "${kommun}" saknas i lookup. Ange municipal_tax_rate_override.`
    );
  }
  const KI = data?.kommunalskatt ?? municipalTaxRateOverride!;
  const burial = data?.begravningsavgift ?? 0.00292;
  const church = churchMember ? (data?.kyrkoavgift_snitt ?? 0.01) : 0;
  return { KI, burial, church, total: KI + burial + church };
}

# Moms — Skill
# Version: 2026-04-02-v1
# Kompatibel med: KAMMAREN verify >=1.0.0

Beräknar mervärdesskatt (moms) för svenska AB.
Deterministisk. Noll LLM. Alla siffror från constants.ts.

## Triggers
- "moms"
- "mervärdesskatt"
- "beräkna moms"
- "netto till brutto"
- "brutto till netto"
- "vad är momsen"
- "VAT"

## Input

| Fält           | Typ     | Required | Default | Beskrivning                                           |
|----------------|---------|----------|---------|-------------------------------------------------------|
| amount         | number  | ja       | —       | Beloppet att beräkna moms på (SEK)                   |
| vat_rate       | number  | ja       | —       | Momssats som heltal: 25, 12, 6 eller 0               |
| direction      | string  | ja       | —       | "netto_to_brutto" eller "brutto_to_netto"             |
| reverse_charge | boolean | nej      | false   | Omvänd skattskyldighet (ML 1 kap 2 §)                |

## Output (result-fält)

| Fält                  | Typ    | Beskrivning                                          |
|-----------------------|--------|------------------------------------------------------|
| netto                 | number | Belopp exklusive moms (SEK)                         |
| moms                  | number | Momsbelopp (SEK, 2 decimaler)                       |
| brutto                | number | Belopp inklusive moms (SEK)                         |
| bas_konto_utgaende    | number | BAS-konto för utgående moms (t.ex. 2610)            |
| reverse_charge_vat    | number | Belopp köparen ska redovisa (endast vid reverse_charge=true) |

## Formler

```
netto_to_brutto:
  moms   = round2(netto × rate)
  brutto = round2(netto + moms)

brutto_to_netto:
  netto  = round2(brutto / (1 + rate))
  moms   = round2(brutto − netto)

omvänd skattskyldighet:
  moms              = 0
  brutto            = netto (ingen påslag)
  reverse_charge_vat = round2(netto × rate)
```

Avrundning: `Math.round(x * 100) / 100` (2 decimaler, ören).

## Stödda scenarier

- 25% netto → brutto (ML 7:1 första stycket)
- 25% brutto → netto
- 12% netto → brutto och brutto → netto
- 6% netto → brutto och brutto → netto
- 0% (momsbefriad)
- Omvänd skattskyldighet (reverse_charge=true), ML 1 kap 2 §

## BAS-konton 2026

| Momssats | Utgående moms | Omvänd skattsk. |
|----------|--------------|-----------------|
| 25%      | 2610         | 2614            |
| 12%      | 2620         | 2624            |
| 6%       | 2630         | 2634            |
| 0%       | —            | —               |

## Ej stödda scenarier (TODO — fas 2)

- **Blandad momssats** (t.ex. faktura med 25% och 12%)
- **Periodredovisning** (kvartalsvis eller månadsvis)
- **Import/export-regler** (EU-handel, OSS-systemet)
- **Jämkningstid** (ML 9 kap — fastigheter)

## Avrundning

`Math.round(x * 100) / 100` per beräkningssteg.
Moms anges i ören (2 decimaler). Inga helkrona-avrundningar.

## Lagrum

- ML 7 kap 1 § (momssatser 25%, 12%, 6%)
- ML 3 kap (undantag — 0%)
- ML 1 kap 2 § (omvänd skattskyldighet)
- ML 9 d kap (omsättningsgräns 120 000 kr — ej implementerad i v1)

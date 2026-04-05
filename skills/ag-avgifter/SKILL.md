# AG-avgifter — Skill
# Version: 2026-04-02-v1
# Kompatibel med: KAMMAREN verify >=1.0.0

Beräknar arbetsgivaravgifter för svenska AB.
Deterministisk. Noll LLM. Alla siffror från constants.ts.

## Triggers
- "arbetsgivaravgifter"
- "AG-avgifter"
- "sociala avgifter"
- "vad kostar en anställd"
- "employer contributions"

## Input

| Fält           | Typ     | Required | Default | Beskrivning                              |
|----------------|---------|----------|---------|------------------------------------------|
| gross_salary   | number  | ja       | —       | Årslön brutto SEK                        |
| birth_year     | number  | ja       | —       | Anställds födelseår (t.ex. 1985)         |
| first_employee | boolean | nej      | false   | Växa-stödet (en av de två första)        |
| num_employees  | number  | nej      | 0       | Antal anställda (avgör om Växa gäller)   |

## Output (result-fält)

| Fält          | Typ    | Beskrivning                          |
|---------------|--------|--------------------------------------|
| total_ag      | number | Total arbetsgivaravgift (SEK)        |
| employer_cost | number | Total arbetsgivarkostnad (lön + AG)  |
| monthly_ag    | number | Månadsbelopp AG (total / 12)         |

## Breakdown (7 poster, alltid i denna ordning)

| Index | Namn                      | Normalfall |
|-------|---------------------------|-----------|
| 0     | Sjukförsäkringsavgift     | 3.55%     |
| 1     | Föräldraförsäkringsavgift | 2.00%     |
| 2     | Ålderspensionsavgift      | 10.21%    |
| 3     | Efterlevandepensionsavgift| 0.30%     |
| 4     | Arbetsmarknadsavgift      | 2.64%     |
| 5     | Arbetsskadeavgift         | 0.10%     |
| 6     | Allmän löneavgift         | 12.62%    |

## Stödda scenarier

- Standardfall: full avgift 31.42%
- Åldersreduktion: born ≤ 1958 (fyllt 67 vid 2026-01-01) → 10.21%
- Inga avgifter: born ≤ 1937
- Inga avgifter: bruttolön < 1 000 kr/år (tröskelvärde)
- Växa-stödet: de två första anställda, max 35 000 kr/mån = 420 000 kr/år

## Ej stödda scenarier (TODO — fas 2)

- **Ungdomsrabatt** (Lag 2026:100): 20.81% för 19-23 år (born 2003-2007),
  gäller 1 april 2026 – 30 september 2027. Kräver datumlogik.
- **Regionalt stöd**: stödområden, max 7 100 kr/mån nedsättning
- **FoU-avdrag**: 20% avdrag på AG-avgifter, max 3M kr/mån
- **Utsändning**: konventionsländer (olika regler per land)

## Avrundning

Math.round() per delpost. Total = summa av avrundade delposter (inte
avrundning av summan). Resultat alltid helkronor.

## Lagrum

- SFL 2 kap 26 § (grundavgifter, delposter)
- SFL 2 kap 27 § (åldersreduktion, 67 år fr.o.m. 2026)
- SFL 2 kap 31 § (Växa-stödet, två första anställda fr.o.m. 2026)
- Lag (1994:1920) om allmän löneavgift (12.62%)
- Prop. 2025/26:66 (ungdomsrabatt, ej implementerad)

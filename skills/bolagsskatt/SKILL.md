# Bolagsskatt — Skill
# Version: 2026-04-02-v1
# Kompatibel med: KAMMAREN verify >=1.0.0

Beräknar bolagsskatt för svenska AB.
Deterministisk. Noll LLM. Alla siffror från constants.ts.

## Triggers
- "bolagsskatt"
- "corporate tax"
- "skatt på vinst"
- "hur mycket skatt betalar bolaget"
- "periodiseringsfond"

## Input

| Fält                          | Typ    | Required | Default | Beskrivning                                                |
|-------------------------------|--------|----------|---------|------------------------------------------------------------|
| taxable_profit                | number | ja       | —       | Skattemässigt resultat (SEK, kan vara negativt)            |
| periodiseringsfond_avsattning | number | nej      | 0       | Önskad ny avsättning till periodiseringsfond (SEK)         |
| befintliga_fonder             | string | nej      | '[]'    | JSON-array: [{"year": 2023, "amount": 100000}, ...]        |
| underskott_foregaende_ar      | number | nej      | 0       | Ackumulerat underskott från tidigare år (SEK)              |

## Output (result-fält)

| Fält                       | Typ    | Beskrivning                                                  |
|----------------------------|--------|--------------------------------------------------------------|
| skattepliktig_vinst        | number | Skattemässig vinst efter alla avdrag (≥ 0)                  |
| bolagsskatt                | number | Bolagsskatt att betala (SEK)                                 |
| resultat_efter_skatt       | number | Ekonomiskt resultat efter skatt (kan vara negativt)          |
| periodiseringsfond_avdrag  | number | Faktisk avsättning (SEK, 0 om blockerad eller ingen begärd)  |
| aterforing                 | number | Obligatorisk återföring av gamla fonder (SEK)               |
| schablonintakt             | number | Schablonintäkt på befintliga fonder (SEK)                   |
| underskottsavdrag          | number | Avdraget underskott (SEK)                                    |
| skatteeffekt_pfond         | number | Uppskjuten skatt på ny avsättning (SEK, om avsattning > 0)  |
| underskott_att_rulla       | number | Nytt underskott att rulla (SEK, om förlust)                 |
| kvarvarande_underskott     | number | Ej använt underskott (SEK, om underskott > vinst)           |

## Beräkningsordning (IL-referens per steg)

```
1. Återföring:   adj += aterforing  (fonder ≥ 6 år)      (IL 30 kap 7 §)
2. Schablonintäkt: adj += fondbelopp_IB × 2.55%           (IL 30 kap 6a §)
3. Underskott:   adj -= min(underskott, max(0, adj))      (IL 40 kap)
4. Pfond:        adj -= min(begärd, floor(adj × 25%))     (IL 30 kap 5 §)
                 Blockeras om befintliga ≥ 6 (räknat FÖRE recovery)
5. Skattepliktig vinst = max(0, adj)
6. Bolagsskatt   = round(skattepliktig_vinst × 20.6%)     (IL 65 kap 10 §)
7. Resultat      = adj − bolagsskatt  (kan vara negativt)
8. Underskott att rulla = adj < 0 ? −adj : 0
```

## Stödda scenarier

- Grundberäkning: 20.6% av skattemässigt resultat
- Förlust: bolagsskatt = 0, underskott rullas till nästa år
- Periodiseringsfond: avdrag, max-kontroll, capping med warning
- Periodiseringsfond återföring: obligatorisk efter 6 år
- Schablonintäkt: på ingående balans av alla fonder × statslåneränta
- Max 6 fonder: blockering av ny avsättning (konservativt: räknat FÖRE recovery)
- Underskottsavdrag: kvittning mot vinst, rest rullas

## Ej stödda scenarier (TODO — fas 2)

- **Koncernbidrag** (IL 35 kap): moderbolag ↔ dotterbolag
- **Ägarförändringsspärr** (IL 40 kap 10 §): >50% ägarbyte
- **Ränteavdragsbegränsning** (EBITDA-regeln, IL 24 kap 24-29 §§)
- **Underprisöverlåtelse** (IL 23 kap)
- **Expansionsfond** (IL 34 kap): enbart enskild firma

## Avrundning

`Math.round()` på bolagsskatt och schablonintäkt (hela kronor).
`Math.floor()` på pfond-max (konservativ, ej mer än tillåtet).

## Lagrum

- IL 65 kap 10 § (bolagsskattesats 20.6%)
- IL 30 kap 5 § (periodiseringsfond max 25%)
- IL 30 kap 6a § (schablonintäkt = fondbelopp × statslåneränta)
- IL 30 kap 7 § (max 6 fonder, max 6 år)
- IL 40 kap (underskottsavdrag)
- SKV PDF 2026-01-07: statslåneränta 30 nov 2025 = 2.55%

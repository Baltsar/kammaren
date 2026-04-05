# K10 Gränsbelopp 2026

**ID:** k10
**Kategori:** tax
**Tier:** free
**Version:** 1.0.0

## Vad gör denna skill?

Beräknar K10-gränsbelopp (utdelningsutrymme) för fåmansföretagare enligt 3:12-reglerna (IL 57 kap). Deterministisk. Noll LLM.

Beräknar:
- Förenklingsregeln (IL 57:11)
- Omkostnadsbelopp med 9%-tillägg (IL 57:12)
- Lönebaserat utrymme med 4%-spärr och 50x-tak (IL 57:16)
- Sparat utrymme (nominellt, uppräkning slopad 2026) (IL 57:10)
- Gränsbelopp = max(förenkling, huvudregel) + sparat

## Triggers (CEO routar hit om input innehåller)

- K10
- gränsbelopp
- utdelningsutrymme
- förenklingsregel
- huvudregel
- lönebaserat utrymme

## Input

| Fält | Typ | Krav | Beskrivning |
|------|-----|------|-------------|
| `anskaffningsvarde` | number | **obligatoriskt** | Anskaffningsvärde för aktierna (SEK) |
| `agarandel_procent` | number | **obligatoriskt** | Ägarandel i procent (0.01–100) |
| `total_lonesumma` | number | valfritt (default 0) | Total kontant lönesumma inkl. dotterbolag (SEK) |
| `egen_lon` | number | valfritt (default 0) | Ägarens kontanta bruttolön (SEK) |
| `sparat_utrymme` | number | valfritt (default 0) | Sparat gränsbelopp från föregående år (SEK) |
| `inkomstar` | number | valfritt (default 2026) | Inkomstår |

## Output — result-fält

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| `forenklingsregel` | number | Förenklingsregeln (SEK) |
| `omkostnadsbelopp` | number | Omkostnadsbelopp inkl. eventuellt 9%-tillägg (SEK) |
| `lonebaserat_underlag` | number | Lönesumma − lönespärr, max 0 (SEK) |
| `lonebaserat_fore_tak` | number | Lönebaserat utrymme före 50x-tak (SEK) |
| `tak_50x` | number | 50x ägarens lön (SEK) |
| `lonebaserat` | number | Lönebaserat utrymme efter eventuell cappning (SEK) |
| `huvudregel_total` | number | Omkostnadsbelopp + lönebaserat (SEK) |
| `sparat_uppraknat` | number | Sparat utrymme (nominellt, uppräkning slopad 2026) (SEK) |
| `gransbelopp` | number | Årets gränsbelopp + sparat (SEK) |
| `anvand_forenkling` | number | 1 = förenklingsregeln använd, 0 = huvudregel |
| `vald_regel` | string | `"forenkling"` eller `"huvudregel"` |

## Konstanter 2026 (IL 57 kap)

| Konstant | Värde | Källa |
|----------|-------|-------|
| IBB (för 3:12, föregående år) | 80 600 kr | IL 57:4 |
| Förenklingsregel | 4 × IBB = 322 400 kr | IL 57:11, Prop. 2025/26:1 |
| Lönespärr | 8 × IBB = 644 800 kr | IL 57:16, Prop. 2025/26:1 |
| Lönebaserat andel | 50% | IL 57:16 |
| Lönebaserat tak | 50 × ägarens lön | IL 57:16 |
| 4%-spärr | < 4% ägarandel → inget lönebaserat | IL 57:16 |
| 9%-tillägg | > 100 000 kr → 9% på överskjutande del | IL 57:12 |
| Uppräkningsfaktor | 0% (slopad 2026) | TAX_CONSTANTS_2026 |

## Beräkningslogik

```
1. förenkling = FORENKLING_BELOPP × ägarandel_decimal

2. omkostnad = anskaffningsvarde × ägarandel_decimal
   om omkostnad > 100 000:
     tillägg = 9% × (omkostnad − 100 000)
   omkostnadsbelopp = round(omkostnad + tillägg)

3. om ägarandel < 4%:
     lonebaserat = 0  [4%-spärr]
   annars:
     underlag = max(0, total_lonesumma − 644 800)
     fore_tak = round(underlag × 50%)
     tak_50x = 50 × egen_lon
     lonebaserat = min(fore_tak, tak_50x)  [om tak_50x > 0]

4. huvudregel_total = omkostnadsbelopp + lonebaserat

5. sparat_uppraknat = sparat_utrymme  [nominellt, uppräkning slopad]

6. ars_gransbelopp = max(förenkling, huvudregel_total)
   gransbelopp = ars_gransbelopp + sparat_uppraknat
```

## Varningar (warnings)

- 4%-spärr aktiv om ägarandel < 4%
- Lönespärr aktiv om lönesumma < 644 800 kr
- 50x-tak om lönebaserat cappas
- Vilken regel som ger mer (alltid inkluderad)

## Exempel

**Minimal (förenklingsregel, 100% ägare):**
```
input: { anskaffningsvarde: 50000, agarandel_procent: 100 }
result.forenklingsregel = 322400
result.gransbelopp = 322400
result.anvand_forenkling = 1
```

**Med lönebaserat utrymme (50% ägare):**
```
input: { anskaffningsvarde: 200000, agarandel_procent: 50,
         total_lonesumma: 1200000, egen_lon: 600000 }
result.lonebaserat = 277600   (= round((1200000−644800) × 50%))
result.gransbelopp = 377600   (= 100000 + 277600)
result.anvand_forenkling = 0
```

## Disclaimer

KAMMAREN Skatteoptimering är ett beräkningsverktyg. Resultaten baseras på offentliga regler och de uppgifter du anger. Detta utgör inte skatte- eller juridisk rådgivning. Konsultera alltid en auktoriserad redovisningskonsult innan du fattar beslut.

## Källor

1. Inkomstskattelagen (1999:1229) 57 kap — Fåmansföretag
2. Prop. 2025/26:1 — Budgetpropositionen (nya 3:12-regler)
3. Skatteverket: Belopp och procentsatser 2026
4. Skatteverket: K10 — Blankett och anvisningar

# Skill: tax-optimizer

## Beskrivning

Beräknar optimal fördelning mellan lön och utdelning för fåmansföretagare
enligt 3:12-reglerna. Deterministisk. Noll LLM.

## Status

Skelett. Logiken finns i separat repo (TAX-OPTIMIZER/). Ej migrerad hit ännu.

## Triggers

- CEO Förmåga 8: proaktiv skatteoptimering (Q4 eller på begäran)
- Human: `npx zhc skill tax-optimizer`
- Pipeline: månadsrapport oktober-december

## Input

| Fält | Typ | Required | Beskrivning |
|------|-----|----------|-------------|
| bruttolön | number | ja | Årets ackumulerade bruttolön |
| revenue | number | ja | Bolagets totala intäkter |
| costs | number | ja | Bolagets totala kostnader (exkl lön) |
| church_member | boolean | ja | Medlem i Svenska kyrkan |
| kommun | string | ja | Kommun (för kommunalskattesats) |
| saved_dividend_space | number | nej | Sparat utdelningsutrymme från tidigare år |
| num_owners | number | nej | Antal delägare (default: 1) |

## Output

SkillOutput enligt skills/types.ts:
- `result`: optimal_salary, optimal_dividend, total_tax, effective_rate
- `breakdown`: steg-för-steg med varje delberäkning
- `warnings`: t.ex. "Nära brytpunkt för statlig inkomstskatt"
- `sources`: Skatteverket-länkar
- `disclaimer`: Obligatorisk (GUARDRAILS regel 11)

## Disclaimer

KAMMAREN Skatteoptimering är ett beräkningsverktyg.
Resultaten baseras på offentliga regler och de uppgifter du anger.
Detta utgör inte skatte- eller juridisk rådgivning.
Konsultera alltid en auktoriserad redovisningskonsult innan du fattar beslut.

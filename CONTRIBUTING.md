# Contributing to KAMMAREN

## The Rule

Every skill must pass verify before merge. No exceptions.

## Adding a New Skill

1. Write golden test cases FIRST
   - Hand-calculate expected values
   - Cite legal sources (SFL, IL, ML)
   - Add to verify/golden-cases/

2. Build the skill
   - skills/[name]/calculate.ts
   - skills/[name]/constants.ts
   - skills/[name]/SKILL.md
   - skills/[name]/sources.json

3. Run verify
   - bun run verify/run.ts [name]
   - ALL assertions must PASS

4. Run full suite
   - All existing tests must still PASS
   - Integration and stress tests must PASS

## Skill Interface

Every skill implements:

```typescript
calculate(input: SkillInput) → SkillOutput
```

See skills/ag-avgifter/ for a clean example.

## Constants

All numbers in constants.ts. Zero hardcoded.
Every value has a comment citing the law.
Import-time checksum validates consistency.

## What We Need

- Swedish tax rules and edge cases
- New calculation skills
- Golden test cases from official sources
- SIE4 real-world edge cases
- Documentation (Swedish + English)

## What We Don't Accept

- Skills without golden test cases
- Hardcoded numbers in calculate()
- LLM doing math (LLM classifies, code calculates)
- Breaking changes to SkillOutput interface

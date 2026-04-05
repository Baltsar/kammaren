# KAMMAREN

**The correctness layer for Swedish company administration.**

Every AI agent can talk about your taxes. None of them can prove they got it right.

KAMMAREN is an open source kernel that sits between your bookkeeping and your decisions. It reads Swedish tax law, calculates deterministically, and proves every answer with a cryptographic audit trail.

No AI does math. Code does math. AI classifies. You decide.

```
Any bookkeeping system (Fortnox, Bokio, gnubok, SIE4, Excel)
              │
        ┌─────▼──────┐
        │  KAMMAREN   │
        │             │
        │  skills/    │  1 live · 4 built · 29 planned
        │  verify/    │  258 assertions against official tables
        │  constants/ │  year-guarded, refuses outdated data
        │  vault/     │  SHA-256 hash chain, write-once
        └─────┬──────┘
              │
        "Set salary to 55,033 SEK/month.
         Dividend: 322,400 SEK in December.
         You save 47,000 SEK/year."
```

---

## What KAMMAREN Is

A deterministic calculation and verification layer for Swedish limited companies (aktiebolag).

Not a bookkeeping system. Not a chatbot. Not a SaaS.

A kernel. Like Linux is to Android, KAMMAREN is to whatever tax tool, AI agent, or accounting system you use. It handles the part that must never be wrong: the math.

## What KAMMAREN Is Not

- Not a bookkeeping system (Fortnox, gnubok, Bokio do that)
- Not an accountant (humans do that)
- Not a chatbot (chatbots guess, code calculates)
- Not a SaaS with a monthly fee
- Not a calculator (that's one feature, not the product)

---

## Quick Start

```bash
git clone https://github.com/Baltsar/kammaren
cd kammaren
bun install
bun test verify/
```

258 tests. All should pass. If they don't, [open an issue](https://github.com/Baltsar/kammaren/issues).

---

## The Principle

```
LLMs classify    →  WHAT category, type, priority
Code calculates  →  HOW MUCH, deterministically
Humans decide    →  WHETHER to act
```

This is non-negotiable. Every skill is pure TypeScript. No neural network touches a number. The audit log proves it.

---

## Three Ways In

### 1. MCP Server (live)

Any MCP client (Claude Desktop, Cursor, any agent framework):

```json
{
  "mcpServers": {
    "kammaren": { "url": "https://mcp.kammaren.nu/mcp" }
  }
}
```

Your agent asks "How should I optimize salary vs dividend?" KAMMAREN answers with exact numbers, legal references, and a disclaimer. Your agent presents it. KAMMAREN doesn't care about the channel. It cares about the correctness.

### 2. npm Package

```bash
npm install kammaren-tax-engine
```

```typescript
import { optimize } from 'kammaren-tax-engine';

const result = optimize({
  profit_before_salary: 1100000,
  municipal_tax_rate_override: 0.30455,
  salary_strategy: 'balanced',
  liquid_assets: 1100000,
});

// result.strategies → 3 strategies with net pay, tax, savings
// result.sources → legal references (IL 57 kap, SFL, etc.)
// result.disclaimer → always present
```

> **Note:** The npm package currently includes the 3:12 tax optimizer. Additional skills (AG, VAT, corporate tax, K10) are being published. See [Status](#current-status).

### 3. REST API (planned)

```
POST https://api.kammaren.nu/v1/skills/ag-avgifter
Content-Type: application/json

{ "gross_salary": 500000, "birth_year": 1990, "first_employee": false }

→ SkillOutput (deterministic, verified, sourced)
```

All three return the same `SkillOutput`. Same numbers. Same sources. Same disclaimer. Same version. The channel doesn't matter. The correctness does.

---

## Architecture

### Skills

Every calculation is a Skill. Pure function. No side effects. No LLM.

```
skills/
  tax-optimizer/        3:12 salary/dividend optimization       ✓ live
  ag-avgifter/          employer contributions (31.42%)         ✓ live
  moms/                 VAT (25/12/6/0%, reverse charge)        ✓ live
  bolagsskatt/          corporate tax + periodiseringsfond      ✓ live
  k10/                  K10 shareholder tax (new 2026 rules)    ✓ live
  löneberäkning/        net salary calculation                  planned
  representation/       deduction limits                        planned
  pensionsavsättning/   pension deduction                       planned
  kryptoskatt/          crypto K4 (FIFO)                        planned
  ... 35 total planned
```

Interface: `calculate(input) → SkillOutput`

Every output includes: result, breakdown, sources (legal references with URLs), disclaimer, version.

### Verify

The trust layer. Every skill must pass golden test cases before shipping.

- **258 golden case assertions** verified by hand against Skatteverket's published tables (SKV 433, SFL, IL, ML)
- **978,000 consistency tests** on the tax optimizer (same input always produces same output)
- **Cross-validation** between independent implementations catches logic bugs
- **Integration tests** verify that numbers flow correctly between skills
- **Stress tests** run 10 radically different company scenarios through the entire chain

Pattern: write golden cases FIRST, then build the skill. If the skill produces a different number than Skatteverket, the test fails. No exceptions.

```
$ bun test verify/

  regelversion      3/3   PASS
  ag-avgifter      19/19  PASS
  moms             34/34  PASS
  bolagsskatt      46/46  PASS
  k10              34/34  PASS
  integration      13/13  PASS
  cross-validation  6/6   PASS
  year-guard        3/3   PASS
  stress          100/100  PASS
  ──────────────────────────────
  258/258 PASS  0 FAIL  0 SKIP
```

### Constants

Year-specific. Version-controlled. Every number traced to its legal source.

The system **refuses** to calculate 2026 taxes with 2025 constants. `year-guard.ts` throws an error if the requested year doesn't match the loaded constants. When Skatteverket publishes new numbers each December, a new `constants-2027.ts` is created, verified, and shipped.

Every number comes from config, never hardcoded. Every config value has a comment citing the specific paragraph in Swedish law.

### Vault

Write-once. SHA-256 hash chain. Every calculation logged. Every entry hashed with the previous. Change one number retroactively and the entire chain breaks. Revision ready.

```
Hₙ = SHA256(Hₙ₋₁ ∥ Dataₙ)
```

### Agents

| Agent | Role | Status |
|-------|------|--------|
| Falk (orchestrator) | Routes questions to the right skill. Never calculates. | **Live** |
| Finance | Classifies transactions against BAS chart of accounts. | Architecture defined |
| Adler (auditor) | Independent review on a *separate* model. | Architecture defined |
| Researcher | Monitors Skatteverket, Riksdagen, BFN for regulatory changes. | Architecture defined |

Each agent has three files: `SOUL.md` (identity), `SKILL.md` (capabilities), `RULES.md` (constraints). The auditor always runs on a different LLM than the agent it reviews.

---

## Design Principles

1. **Kernel, not app.** Skills are apps. Vault is the filesystem. Orchestrator is the scheduler.
2. **Data source agnostic.** Fortnox, gnubok, Bokio, Excel, SIE4. We don't care where your books live.
3. **Featureless by default.** The base layer does one thing: understands where you stand.
4. **Extensions do everything else.** 35 skills planned. Community builds more. Every skill passes verify.
5. **Correctness before features.** 258 verified assertions. 978K consistency tests. 10 stress scenarios. That's the bar.
6. **Open source = trust layer.** You can't sell financial tools with a black box. AGPL-3.0.
7. **LLM classifies. Code calculates. Human decides.** No exceptions.

---

## The Endgame

A one-person company that runs like a 50-person company. Without the 50 people.

KAMMAREN is the foundation. Skills are the tools. The community builds what we haven't thought of. Every skill plugs into the same kernel, same vault, same verify pipeline. Every answer is deterministic, sourced, and proven.

Sweden first. Nordics next. The architecture is country-agnostic. Only the rules engine changes per jurisdiction.

---

## Why This Exists

~75,000 sole-owner limited companies in Sweden. Same tax code as companies with 50 employees. Zero infrastructure.

Six free 3:12 calculators exist online. All give you one number. None give you an action plan. None verify against official tables. None are open source. None have an audit trail.

Other agents do things. KAMMAREN proves they did them right.

---

## Contributing

We need:

- **Swedish tax rules** — domain knowledge, edge cases, corrections
- **New skills** — calculation modules following the Skill interface
- **Golden test cases** — hand-calculated, verified against official sources
- **SIE4 edge cases** — real-world files that break assumptions
- **Documentation** — Swedish and English

Every contribution must pass verify before merge. No exceptions.

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Current Status

| Component | Status |
|-----------|--------|
| 3:12 tax optimizer | **Live** (kammaren.nu + npm + MCP) |
| AG-avgifter (employer contributions) | **Built**, verify 19/19 PASS |
| Moms (VAT) | **Built**, verify 34/34 PASS |
| Bolagsskatt (corporate tax + periodiseringsfond) | **Built**, verify 46/46 PASS |
| K10 (shareholder gränsbelopp, 2026 additive model) | **Built**, verify 34/34 PASS |
| Year-guard | **Live**, refuses outdated constants |
| Integration test (full chain) | **PASS**, 13 tests |
| Cross-validation (tax-opt vs K10) | **PASS**, 6 scenarios |
| Stress test (10 company types) | **PASS**, 100/100 |
| Vault + SHA-256 hash chain | **Built** |
| Chat-handler (channel-agnostic) | **Built** |
| Telegram adapter | **Built** (64 lines) |
| CLI adapter | **Built** (37 lines) |
| npm package (kammaren-tax-engine) | **Published** (v1.0.4, tax-optimizer) |
| MCP server | **Live** (mcp.kammaren.nu) |
| REST API | Planned |
| Finance agent | Architecture defined |
| Auditor agent | Architecture defined |
| Researcher agent | Architecture defined |
| Sprint 2 skills (löneberäkning, representation, pension) | Planned |

Total verification: **258/258 PASS** across 9 test suites.

See [STATUS.md](STATUS.md) for detailed roadmap.

---

## Tech Stack

Bun · TypeScript (strict) · SHA-256 hash chain · MCP · Vercel · AGPL-3.0

---

## License

[AGPL-3.0-or-later](LICENSE). Run it, modify it, distribute it. Publish source if you distribute changes. Commercial license available for closed-source use. See [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md).

---

## Links

- [Calculator](https://kammaren.nu) — free tax optimization for Swedish AB
- [MCP Server](https://mcp.kammaren.nu) — plug into any agent
- [npm](https://www.npmjs.com/package/kammaren-tax-engine) — install the engine
- [Build Log](https://kammaren.nu/build) — follow the build in public

---

*The formulas are public. The data is yours. The correctness is proven.*

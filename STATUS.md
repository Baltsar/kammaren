# KAMMAREN Status

Last updated: April 2026

## Skills

| Skill | Status | Assertions | Version |
|-------|--------|------------|---------|
| 3:12 Tax Optimizer | Live (npm + MCP + web) | 978K consistency | 1.0.4 |
| AG-avgifter | Built, verified | 19/19 PASS | 1.0.0 |
| Moms | Built, verified | 34/34 PASS | 1.0.0 |
| Bolagsskatt | Built, verified | 46/46 PASS | 1.0.0 |
| K10 Gränsbelopp | Built, verified | 34/34 PASS | 1.0.0 |
| Löneberäkning | Planned | - | - |
| Representation | Planned | - | - |
| Pensionsavsättning | Planned | - | - |
| ... 26 more | Planned | - | - |

## Verification

| Suite | Assertions | Status |
|-------|------------|--------|
| Golden cases (5 skills) | 153 | PASS |
| Integration (full chain) | 13 | PASS |
| Cross-validation | 6 | PASS |
| Stress (10 scenarios) | 100 | PASS |
| Year-guard | 3 | PASS |
| **Total** | **258+** | **PASS** |

## Infrastructure

| Component | Status |
|-----------|--------|
| Vault + SHA-256 | Planned (empty in public repo) |
| Year-guard | Live |
| Chat-handler | WIP (depends on agent files not in public repo) |
| Telegram adapter | WIP (depends on chat-handler) |
| CLI adapter | WIP (depends on chat-handler) |
| MCP server | Live (mcp.kammaren.nu) |
| npm package | Published (1.0.4) |
| REST API (/api/verify) | Live on Vercel |
| Web calculator | Live (kammaren.nu) |

## Agents

| Agent | Status |
|-------|--------|
| Falk (orchestrator) | WIP — not in public repo |
| Finance | Architecture defined |
| Adler (auditor) | Architecture defined |
| Researcher | Architecture defined |

The agent layer (including SOUL.md/SKILL.md/RULES.md per agent) is under active development in a separate working tree and has not yet been synced to this public repository.

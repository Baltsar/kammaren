# Changelog

All notable changes to KAMMAREN will be documented in this file.

## [Unreleased]

### Added
- 3:12 tax optimizer (4 salary strategies, 290 municipalities)
- AG-avgifter skill (employer contributions, 19/19 verify)
- Moms skill (VAT calculation, 34/34 verify)
- Bolagsskatt skill (corporate tax + periodiseringsfond, 46/46 verify)
- K10 skill (2026 additive model, 34/34 verify)
- Year-guard (refuses outdated constants)
- Vault with SHA-256 hash chain
- MCP server at mcp.kammaren.nu
- npm package kammaren-tax-engine v1.0.4
- Chat-handler (channel-agnostic)
- Telegram adapter (64 lines)
- CLI adapter (37 lines)
- 258 golden case assertions
- 978,000 consistency tests
- Cross-validation between tax-optimizer and K10
- Integration tests (full chain, 13 scenarios)
- Stress tests (10 company types, 100 assertions)

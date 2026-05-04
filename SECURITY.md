# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in KAMMAREN, please report it responsibly.

**Email:** info@kammaren.nu

**Do not** open a public GitHub issue for security vulnerabilities.

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Scope

KAMMAREN is a calculation engine and a regulatory information service.
Security concerns include:

- Incorrect tax calculations that could cause financial harm
- Vault integrity issues (hash chain bypass)
- Dependency vulnerabilities
- Watcher pipeline: incorrect classifications, broken consent gating,
  delivery to unintended recipients
- Personuppgiftsincidenter (GDPR art. 33–34)

## Supported Versions

Only the latest version on `main` is supported.

## AI-disclosure-policy

Delar av källkoden i detta repo är genererade eller assisterade av
AI-verktyg (Anthropic Claude, Berget AI). All sådan kod granskas
manuellt av projektägaren före merge till `main`. Vi uppmuntrar
externa granskare att rapportera AI-relaterade fel — inklusive
hallucinationer i klassificeringar, felaktiga länkar i notiser och
felaktig escape-hantering — via samma kanal som säkerhetshål
(`info@kammaren.nu`).

Watcher Cloud levererar **aldrig** notiser utan att användaren har
bekräftat tre samtycken (TERMS, PRIVACY, B2B-positionering). Om en
notis levereras utan samtycke är det en säkerhetsincident. Rapportera
omedelbart.

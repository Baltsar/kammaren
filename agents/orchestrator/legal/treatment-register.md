# Behandlingsregister — KAMMAREN Watcher Cloud (artikel 30 GDPR)

**Senast uppdaterad:** 2026-05-04
**Personuppgiftsansvarig:** Gustaf Garnow, fysisk person i näringsverksamhet (enskild firma)
**Kontakt:** info@kammaren.nu
**Tillsynsmyndighet:** Integritetsskyddsmyndigheten (IMY), https://imy.se

> Detta register motsvarar GDPR artikel 30(1) — ett behandlingsregister för
> personuppgiftsansvarig. Skatte-engine (kalkylator-API på `kammaren.nu`)
> behandlar enbart IP-adress för rate-limiting; den behandlingen täcks i
> [PRIVACY.md § 2](../../../PRIVACY.md). Detta register avser **Watcher Cloud**.

---

## 1. Behandlings-aktiviteter

### 1.1 Onboarding och samtyckes­insamling

| Fält | Värde |
|---|---|
| Ändamål | Identifiera bolaget och samla in tre samtycken (TERMS, PRIVACY, B2B) före leverans |
| Rättslig grund | GDPR art. 6.1.a (samtycke) |
| Kategorier av personuppgifter | Telegram-användar-ID, organisationsnummer, profil-flaggor (moms-registrerad m.m.), bekräftelse-tidsstämplar (`consent_*_at`) |
| Kategorier av registrerade | Företrädare för svenska aktiebolag (B2B) |
| Mottagare | Telegram FZ-LLC (kanal); inga övriga |
| Lagringstid | Aktiv kund: så länge samtycke består. Återkallat samtycke: profil soft-deletas omedelbart, append-only-loggar bevaras i 30 dagar |
| Säkerhetsåtgärder | TLS, vault per orgnr, atomisk skrivning via `<file>.tmp`-rename |

### 1.2 Klassificering av regulatoriska händelser

| Fält | Värde |
|---|---|
| Ändamål | Avgöra vilka offentliga regulatoriska händelser som är relevanta för en kund-profil (profilering enligt art. 4.4) |
| Rättslig grund | GDPR art. 6.1.a (samtycke) |
| Kategorier av personuppgifter | Profil-flaggor (orgnr-pseudonymiserat); ingen direkt identifierande personuppgift skickas till AI-leverantör |
| Kategorier av registrerade | Aktiva, samtyckta kunder |
| Mottagare (underbiträden) | Berget AI (Berget Cloud AB), Anthropic PBC (fallback) |
| Lagringstid | `classifications.jsonl` är append-only; bevaras i 30 dagar efter återkallat samtycke och raderas/pseudonymiseras därefter |
| Säkerhetsåtgärder | Inga personuppgifter inkluderas i AI-promptar (verifierat manuellt). Berget AI har zero-retention. Anthropic täcks av SCC. |

### 1.3 Leverans av notiser

| Fält | Värde |
|---|---|
| Ändamål | Skicka relevanta notiser till samtyckta kunder via Telegram |
| Rättslig grund | GDPR art. 6.1.a (samtycke) |
| Kategorier av personuppgifter | Telegram-användar-ID, notisinnehåll (offentlig myndighetsinformation) |
| Kategorier av registrerade | Aktiva, samtyckta kunder |
| Mottagare | Telegram FZ-LLC |
| Lagringstid | `deliveries.jsonl` är append-only; bevaras 30 dagar efter återkallat samtycke |
| Säkerhetsåtgärder | Consent-gate i `delivery.ts` blockerar leverans utan tre satta samtycken; TLS via Telegram Bot API |

---

## 2. Underbiträden (artikel 28)

| Leverantör | Funktion | Region | DPA-länk | Överföringsmekanism |
|---|---|---|---|---|
| Berget AI (Berget Cloud AB) | Klassificering av regulatoriska händelser (95 % av LLM-anrop) | Sverige (Stockholm) | https://berget.ai/dpa | EU-intern, ej tillämpligt |
| Anthropic PBC | Fallback-LLM | USA (AWS/GCP) | https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa | SCC (GDPR art. 46.2.c) |
| Telegram FZ-LLC | Notisleverans | EU (Nederländerna) / Förenade Arabemiraten | https://core.telegram.org/api/terms | Telegram Bot Platform Terms |
| GitHub Inc. | Källkod-hosting + scheduled GitHub Actions (cron-trigger för poller) | EU/USA | https://docs.github.com/site-policy/privacy-policies/github-data-protection-agreement | DPA + SCC |

---

## 3. Bevisbaserade due diligence-åtgärder

KAMMAREN Watcher kan bevisa följande vid eventlig tillsynsförfrågan:

- **`events.jsonl`** loggar `fetched_at` + `source_url` per event — bevis för att
  Watcher hämtat data från officiella myndighetsflöden, ej från användares data.
- **`classifications.jsonl`** loggar `provider`, `model`, `cost_eur` per anrop —
  bevis för att klassificeringen är spårbar till en specifik LLM-leverantör.
- **Dedupe via id-hash** + append-only-loggar — historiska beslut kan inte
  retroaktivt skrivas om utan att hash-kedjan bryts.
- **Git-historik** bevarar varje ändring i policyer, koden och behandlingsregistret.
- **`agents/watcher/research/`** innehåller citerade primärkällor för de juridiska
  klausulerna i TERMS.md och PRIVACY.md.
- **GDPR-CLI** (`bun run gdpr export <orgnr>`) producerar en komplett kund-export
  inom sekunder — bevis för att artikel 15-rättigheter kan uppfyllas inom
  GDPR:s 30-dagarsfrist.
- **Consent-gate** i `agents/orchestrator/delivery.ts` blockerar leverans när
  något av `consent_terms_accepted_at`, `consent_privacy_accepted_at` eller
  `consent_b2b_acknowledged_at` saknas — bevis för att samtycke är obligatoriskt.

---

## 4. Återkallelse av samtycke och radering

- Återkallelse sker via `info@kammaren.nu` eller Telegram-bot-kommando `/glömmig`.
- `bun run gdpr delete <orgnr>` utför omedelbar soft-delete:
  - `telegram_chat_id` → `null`
  - `consent_terms_accepted_at` → `null`
  - `consent_privacy_accepted_at` → `null`
  - `consent_b2b_acknowledged_at` → `null`
  - `meta.deleted_at` → ISO-tidsstämpel
- Append-only-loggar (`classifications.jsonl`, `deliveries.jsonl`) bevaras i
  **30 dagar** efter `deleted_at` för att uppfylla artikel 30-skyldigheten,
  och raderas eller pseudonymiseras därefter.

---

## 5. Personuppgifts-incidenter (artikel 33–34)

Vid misstänkt personuppgiftsincident (t.ex. läckta `telegram_chat_id`,
felaktig leverans utan consent, bruten consent-gate):

1. Rapportera till `info@kammaren.nu`.
2. Personuppgiftsansvarig bedömer risken inom 24 timmar.
3. Vid hög risk: anmäl till IMY inom 72 timmar enligt artikel 33.
4. Vid hög risk för registrerade: underrätta dem enligt artikel 34.

Berget AI har enligt avtal 24-timmars-notifieringsskyldighet vid incident
som påverkar inferenstjänsten.

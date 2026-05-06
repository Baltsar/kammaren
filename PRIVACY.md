# Integritetspolicy — KAMMAREN

**Senast uppdaterad:** 2026-05-06
**Version:** 2.1

---

## 1. Personuppgiftsansvarig

Gustaf Garnow, kammaren.nu
Kontakt för GDPR-ärenden: info@kammaren.nu

Tjänsten drivs av en fysisk person i näringsverksamhet
(enskild firma).

KAMMAREN består av två separata tjänster — **Skatte-engine** och
**Watcher Cloud**. Behandlingen av personuppgifter skiljer sig mellan
tjänsterna och beskrivs i separata sektioner nedan. Tillsynsmyndighet
är Integritetsskyddsmyndigheten (IMY, https://imy.se).

---

## 2. Skatte-engine — vad behandlas

KAMMAREN:s skatte-engine har syftet **deterministisk skatteberäkning** —
**ingen användarprofil skapas**. Följande personuppgifter behandlas tekniskt:

### 2.1 IP-adress (vid API-anrop)

- **Vad:** Den IP-adress som anropar `/api/verify`.
- **Varför:** Rate-limiting (60 anrop/minut) för att skydda mot missbruk.
- **Rättslig grund:** Berättigat intresse, art. 6.1.f GDPR. Intresse: tjänstens tillgänglighet. Avvägning: IP-adresser är nödvändiga för rate-limiting, ingen profilering sker, lagringen är kortvarig.
- **Lagring:** Maximalt 24 timmar, sedan raderas den automatiskt av rate-limit-motorn (Upstash Redis TTL).
- **Mottagare:** Upstash Inc. (personuppgiftsbiträde, EU-region). Vercel Inc. (infrastrukturleverantör, EU/USA).

### 2.2 Input-payload

- **Vad:** Data som skickas i POST-body till `/api/verify`.
- **Behandling:** Används endast för att beräkna svaret i stunden. **Loggas inte.** Skrivs inte till disk.
- **Personuppgifter i input:** Om användaren skickar personuppgifter (t.ex. personnummer, namn) behandlas dessa endast som indata för beräkningen och försvinner när svaret skickats. **Användaren ombeds att inte skicka personuppgifter.**

### 2.3 Request-metadata

- **User-Agent, Origin:** Kan loggas tillfälligt av Vercel för drift. Raderas enligt Vercels retention policy (se vercel.com/legal).

### 2.4 Anonyma aggregerade räknare

- **Vad:** Två heltal i Upstash Redis: `kammaren:counter:total` (totalt antal lyckade beräkningar sedan start) och `kammaren:counter:daily:YYYY-MM-DD` (antal lyckade beräkningar per dag, Stockholm-tid).
- **Varför:** Publik transparens — kammaren.nu visar hur tjänsten används. Hjälper också drift att upptäcka avvikelser.
- **Personuppgifter:** **Inga.** Räknarna är rena heltal utan koppling till IP, payload, User-Agent eller annan identifierande metadata. De utgör inte personuppgifter enligt GDPR art. 4.1 eftersom registrerade inte är direkt eller indirekt identifierbara.
- **Rättslig grund:** Ej tillämpligt (ingen personuppgiftsbehandling). Driften som sådan vilar på berättigat intresse, art. 6.1.f GDPR — tjänstens drift och transparens.
- **Lagring:** `total` saknar utgångsdatum. `daily:*` raderas automatiskt efter 90 dagar (Redis TTL).
- **Mottagare:** Upstash Inc. (samma personuppgiftsbiträde som rate-limiting, EU-Frankfurt). Räknarna är publikt läsbara via `GET /api/verify` under fältet `stats`.

### 2.5 Skatte-engine — mottagare / personuppgiftsbiträden

| Leverantör | Syfte | Region | DPA |
|-----------|-------|--------|-----|
| Vercel Inc. | Hosting, serverless functions | EU/USA | Data Processing Addendum (DPA) |
| Upstash Inc. | Rate-limiting (Redis) | EU (Frankfurt) | DPA |

Inga personuppgifter överförs till tredje land utanför EU/EES utöver vad som omfattas av Vercels DPA och Standard Contractual Clauses (SCC) / EU-US Data Privacy Framework.

---

## 3. Watcher Cloud — vad behandlas

Watcher Cloud är en B2B-tjänst som riktas till svenska aktiebolag och deras
företrädare i näringsverksamhet (se [TERMS.md § 9](./TERMS.md)). Följande
personuppgifter behandlas:

### 3.1 Kategorier av personuppgifter

| Kategori | Syfte | Källa |
|---|---|---|
| Telegram-användar-ID (`telegram_chat_id`) | Leverans av notiser | Användarens `/start`-kommando i Telegram-bot |
| Organisationsnummer (orgnr) | Identifiering av aktiebolaget | Användarinmatning vid onboarding |
| Bolagsprofil-flaggor (t.ex. moms-registrerad, arbetsgivar-registrerad) | Klassificering: avgör vilka händelser som är relevanta | Användarinmatning |
| Bekräftelse-tidsstämplar (`consent_*_at`) | Bevis på samtycke till TERMS, PRIVACY, B2B-positioning | Användarens onboarding-flöde |

### 3.2 Rättslig grund

Samtycke (GDPR artikel 6.1.a). Användaren lämnar samtycke vid registrering
genom att aktivt bekräfta TERMS, PRIVACY och B2B-positioning. Samtycket
kan återkallas när som helst utan att det påverkar lagligheten av behandling
som skett dessförinnan. Återkallelse sker via `info@kammaren.nu` eller via
Telegram-botens `/glömmig`-kommando.

### 3.3 Automatiserad behandling och profilering

KAMMAREN Watcher använder automatiserad behandling av dina
profil-uppgifter (bolagstyp, valda bevakningsämnen, geografisk region)
för att avgöra vilka regulatoriska notiser som är relevanta för dig.
Denna behandling utgör profilering i enlighet med GDPR artikel 4.4.

Behandlingen innebär INTE automatiserat beslutsfattande enligt
GDPR artikel 22 — ingen behandling fattar beslut med rättsliga följder
för dig. Du mottar alltid notiser baserat på din konfiguration och
kan när som helst ändra dina profil-inställningar.

**Logiken bakom profileringen:** Systemet jämför händelse-taggar
från myndighetskällor (t.ex. "skatt:moms", "bolag:årsredovisning")
mot de bevakningsprofiler du har konfigurerat. Matchande taggar
utlöser en notis. Ingen känslig personuppgift (artikel 9)
behandlas i profileringssteget.

### 3.4 Lagringstid

- Aktiv kund: så länge samtycke består.
- Vid återkallelse av samtycke / radering: profil tas bort omedelbart;
  `telegram_chat_id` raderas. Klassificerings- och leveranshistorik bevaras
  i append-only-loggar (`classifications.jsonl`, `deliveries.jsonl`)
  i högst **30 dagar** efter radering för att uppfylla artikel 30-skyldigheten.
- Efter 30 dagar: alla spår av användaren raderas eller pseudonymiseras.

### 3.5 AI-behandling och underbiträden

KAMMAREN Watcher använder följande AI-leverantörer för behandling
av data:

| Leverantör | Funktion | Dataplacering | DPA | Överföringsmekanism |
|---|---|---|---|---|
| Berget AI (Berget Cloud AB) | Klassificering av regulatoriska händelser (95 % av LLM-anrop) | Sverige (Stockholm) | [berget.ai/dpa](https://berget.ai/dpa) | EU-intern, ej tillämpligt |
| Anthropic PBC | Fallback-klassificering | USA (AWS/GCP) | Ingår i Commercial API Terms | SCC (GDPR art. 46.2.c) |

Inga personuppgifter om slutanvändare (Telegram-ID, bolagsdata)
skickas till AI-leverantörerna. API-anrop innehåller enbart
offentlig myndighetsinformation (lagtext, nyhetsflöden).
AI-leverantörerna agerar därför som **underbiträden** enbart
avseende eventuell teknisk loggning, inte avseende behandling
av slutanvändardata.

### 3.6 Watcher Cloud — mottagare / personuppgiftsbiträden

| Leverantör | Syfte | Region | DPA |
|---|---|---|---|
| Telegram FZ-LLC | Leverans av notiser | EU (Nederländerna) / Förenade Arabemiraten | Telegram Bot Platform Terms |
| Berget AI (Berget Cloud AB) | LLM-tagging av events | Sverige | [berget.ai/dpa](https://berget.ai/dpa) |
| Anthropic PBC | Fallback-LLM | USA | Commercial API DPA + SCC |
| GitHub Inc. | Hosting av källkod och scheduled GitHub Actions | EU/USA | DPA + SCC |

Telegram tar emot innehållet i notisen (myndighetsinformation, ingen
profil-info) samt mottagarens `chat_id`. Ingen profil-data lämnar
KAMMAREN:s vault.

---

## 4. Vad KAMMAREN INTE gör

- ❌ Inga cookies (skatte-engine API)
- ❌ Ingen användartracking (ingen Google Analytics, Plausible, eller liknande). Endast anonyma aggregerade anropsräknare enligt § 2.4 — utan IP- eller payload-koppling.
- ❌ Ingen automatiserad beslutfattning enligt art. 22 GDPR
- ❌ Ingen marknadsföring
- ❌ Ingen vidareförsäljning av personuppgifter
- ❌ Inga personuppgifter skickas i AI-prompts (varken Skatte-engine eller Watcher)

## 5. Registrerades rättigheter (GDPR kap. III)

Som registrerad har du rätt att:

- Begära **tillgång** till uppgifter om dig (art. 15)
- Begära **rättelse** (art. 16)
- Begära **radering** (art. 17)
- Begära **begränsning** av behandling (art. 18)
- **Invända** mot behandling (art. 21)
- Begära **dataportabilitet** (art. 20)
- Lämna klagomål till **Integritetsskyddsmyndigheten** (imy.se)

**Watcher Cloud:** Begäran om tillgång eller radering hanteras via
GDPR-CLI eller via `info@kammaren.nu`. Tjänsteleverantören tillhandahåller
en JSON-export inom 30 dagar (`bun run gdpr export <orgnr>`) och
genomför radering inom 7 dagar (`bun run gdpr delete <orgnr>`).

**Skatte-engine:** Då tjänsten endast lagrar IP-adress ≤24 h och inte kan
identifiera dig utan ytterligare information (t.ex. din ISP:s loggar) är
vissa rättigheter i praktiken begränsade.

Kontakta oss via `info@kammaren.nu` för frågor.

## 6. Registerförteckning (art. 30 GDPR)

KAMMAREN för en registerförteckning enligt art. 30 GDPR. Se
[agents/orchestrator/legal/treatment-register.md](./agents/orchestrator/legal/treatment-register.md)
för detaljerna.

## 7. Säkerhet

- HTTPS/TLS obligatoriskt (inga HTTP-anrop).
- Inga personuppgifter persisteras i KAMMAREN:s skatte-engine-databas (ingen sådan finns).
- Watcher Cloud: profil-vault sparas pseudonymiserat per orgnr i versionerade
  filer; `telegram_chat_id` är den enda direkt identifierande uppgiften och
  raderas omedelbart vid återkallelse av samtycke.
- Upstash Redis är krypterad at rest.

## 8. Cookies

KAMMAREN använder **inga cookies** på API-nivå. Docs-sajten (`https://kammaren.nu`) kan använda tekniskt nödvändiga cookies (t.ex. för att komma ihåg språkval) — se docs-sidans footer.

## 9. Kontakt och klagomål

- **Operatör:** info@kammaren.nu
- **Tillsynsmyndighet:** Integritetsskyddsmyndigheten (IMY), https://imy.se

## 10. Ändringar

Denna policy kan uppdateras. Gällande version anges av datum överst. Väsentliga ändringar meddelas på `https://kammaren.nu/privacy`.

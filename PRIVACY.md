# Integritetspolicy — KAMMAREN

**Senast uppdaterad:** 2026-04-18
**Version:** 1.0

---

## 1. Personuppgiftsansvarig

- **Operatör:** Gustaf Garnow, privatperson, Sverige
- **Kontakt:** info@kammaren.nu
- **Tjänst:** KAMMAREN (`https://kammaren.nu`)

## 2. Vilka personuppgifter behandlas

KAMMAREN:s syfte är deterministisk skatteberäkning — **ingen användarprofil skapas**. Följande personuppgifter behandlas tekniskt:

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

## 3. Vad KAMMAREN INTE gör

- ❌ Inga cookies
- ❌ Ingen tracking (ingen Google Analytics, Plausible, etc. i API-skiktet)
- ❌ Ingen profilering
- ❌ Ingen vidareförsäljning
- ❌ Ingen automatiserad beslutfattning enligt art. 22 GDPR
- ❌ Ingen marknadsföring

## 4. Mottagare / personuppgiftsbiträden

| Leverantör | Syfte | Region | DPA |
|-----------|-------|--------|-----|
| Vercel Inc. | Hosting, serverless functions | EU/USA | Data Processing Addendum (DPA) |
| Upstash Inc. | Rate-limiting (Redis) | EU (Frankfurt) | DPA |

Inga personuppgifter överförs till tredje land utanför EU/EES utöver vad som omfattas av Vercels DPA och Standard Contractual Clauses (SCC) / EU-US Data Privacy Framework.

## 5. Registrerades rättigheter (GDPR kap. III)

Som registrerad har du rätt att:

- Begära **tillgång** till uppgifter om dig (art. 15)
- Begära **rättelse** (art. 16)
- Begära **radering** (art. 17)
- Begära **begränsning** av behandling (art. 18)
- **Invända** mot behandling (art. 21)
- Begära **dataportabilitet** (art. 20)
- Lämna klagomål till **Integritetsskyddsmyndigheten** (imy.se)

**Obs:** Då KAMMAREN endast lagrar IP-adress ≤24 h och inte kan identifiera dig utan ytterligare information (t.ex. din ISP:s loggar) är vissa rättigheter i praktiken begränsade. Kontakta oss via info@kammaren.nu för frågor.

## 6. Registerförteckning (art. 30 GDPR)

KAMMAREN för en registerförteckning enligt art. 30:

| Behandling | Ändamål | Rättslig grund | Kategorier | Mottagare | Lagringstid |
|-----------|---------|----------------|------------|-----------|-------------|
| Rate-limiting | Missbruksskydd | Art. 6.1.f | IP-adress | Upstash (EU) | ≤24 h |
| API-drift | Tjänsteleverans | Art. 6.1.f | Request-metadata | Vercel | Enligt Vercel |

## 7. Säkerhet

- HTTPS/TLS obligatoriskt (inga HTTP-anrop).
- Inga personuppgifter persisteras i KAMMAREN:s egen databas (ingen sådan finns).
- Upstash Redis är krypterad at rest.

## 8. Cookies

KAMMAREN använder **inga cookies** på API-nivå. Docs-sajten (`https://kammaren.nu`) kan använda tekniskt nödvändiga cookies (t.ex. för att komma ihåg språkval) — se docs-sidans footer.

## 9. Kontakt och klagomål

- **Operatör:** info@kammaren.nu
- **Tillsynsmyndighet:** Integritetsskyddsmyndigheten (IMY), https://imy.se

## 10. Ändringar

Denna policy kan uppdateras. Gällande version anges av datum överst. Väsentliga ändringar meddelas på `https://kammaren.nu/privacy`.

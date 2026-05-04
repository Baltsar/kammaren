# KAMMAREN Watcher — Juridisk analys 2026
**Utarbetad:** 2026-05-04 | **Tillämplig jurisdiktion:** Sverige/EU | **Tjänstebeskrivning:** Kostnadsfri open source (AGPL-3.0) regulatorisk informationstjänst via Telegram

> **Forskningsdokument** — utgör inte juridisk rådgivning.
> Klausuler citerade i [TERMS.md](../../../TERMS.md) och [PRIVACY.md](../../../PRIVACY.md)
> är härledda från denna analys. Granska med advokat före publik launch.

> **Viktigt förbehåll:** Denna analys är en juridisk research-sammanfattning och utgör inte juridisk rådgivning. Rådgör med en licensierad advokat, särskilt för områden 4 och 5, innan publik lansering.

***

## Område 1 — Ansvar: Informationstjänst vs. Rådgivning

### Per-område-summary

Lag (2003:862) om finansiell rådgivning till konsumenter är sannolikt **inte direkt tillämplig** på KAMMAREN Watcher. Lagens § 1 avgränsar tillämpningsområdet till "rådgivning som en näringsidkare tillhandahåller en konsument och som **omfattar placering av konsumentens tillgångar i finansiella instrument** eller i livförsäkringar med sparmoment." KAMMAREN klassificerar regulatoriska händelser och skickar informationsnotiser — det är inte detsamma som att rekommendera placeringar. Den centrala juridiska distinktionen formuleras träffsäkert av Korling: **"Råd är information men inte all information är rådgivning."**[^1][^2]

Marknadsföringslagen (2008:486) och konsumentköplagen (2022:260) är dock relevanta. Marknadsföringslagen förbjuder vilseledande framställningar oavsett form, och automatiserade klassificeringar som systematiskt är felaktiga kan falla under detta. Skatteverket, Bolagsverket och Riksdagen driver egna RSS-flöden/API:er och betraktas som ren informationsspridning — de gör uttryckligen inga ansvarsutfästelser om aktualitet eller fullständighet. Wint och Bokio använder liknande avgränsningar i sin automatiserade bokföringstjänst.[^3][^4][^5][^6]

### Concrete clauses to copy-paste

**TOS § X — Informationstjänst, ej rådgivning (svenska)**

```markdown
KAMMAREN Watcher tillhandahåller automatiserad sammanfattning och 
klassificering av offentligt tillgänglig information från svenska 
myndighetskällor. Tjänsten utgör inte finansiell rådgivning, 
juridisk rådgivning, skatterådgivning eller investeringsrekommendation 
i den mening som avses i lag (2003:862) om finansiell rådgivning till 
konsumenter, MiFID II (Direktiv 2014/65/EU), eller tillämplig 
värdepapperslagstiftning.

Informationen är avsedd som ett hjälpmedel för bevakning av 
regulatoriska händelser och ska inte ensamt ligga till grund för 
affärsbeslut. Användaren ansvarar självständigt för att inhämta 
professionell rådgivning vid behov.
```

**Notis-footer (varje Telegram-meddelande)**

```
⚠️ Informationsnotis — ej rådgivning. Verifiera alltid mot 
primärkälla: [länk till källa]. KAMMAREN Watcher AB/enskild firma 
ansvarar inte för beslut fattade på grundval av denna notis.
```

**Konsumentköplagen-friskrivning (TOS)**

```markdown
Tjänsten tillhandahålls "i befintligt skick" (as-is) avseende 
informationens fullständighet och aktualitet. Tjänsteleverantören 
friskriver sig från ansvar för skador som uppkommer till följd av 
tekniska fel, förseningar i myndighetskällornas publicering, 
felaktiga AI-klassificeringar eller avbrott i tjänsten, i den 
utsträckning detta är tillåtet enligt tvingande konsumentskyddslagstiftning.
```

### Risk ranking: **6/10**

**Motivering:** Tjänsten berör regulatoriska skattehändelser (t.ex. deklarationsfrister), vilket gränsar till skatterådgivning. Risk uppstår om notisen "Viktig deklarationshändelse" tolkas som en rekommendation att agera. Friskrivning + tydlig källhänvisning minskar risken avsevärt. Inga kända ARN-avgöranden specifikt om automatiserade regulatoriska notis-tjänster finns publicerade, men ARN-beslut om banker som automatiskt tecknat aktier utan tydlig information (avtalsvillkor som "medfört att banken automatiskt tecknat aktier för konsumenten" bedömdes oskäliga) visar att automatiserade åtgärder utan klar information ses allvarligt på.[^7]

### Att INTE göra

- ❌ Använd aldrig ordet "rekommenderar" eller "bör" i notistext — det aktiverar rådgivningsdistinktionen
- ❌ Skicka inte notiser med subjektiv bedömning ("Hög prioritet — du riskerar böter") utan klart disclaimerblock
- ❌ Undvik att kalla tjänsten "smart skattebevakning" eller liknande — marknadsföringslagen täcker även sådana formuleringar
- ❌ Förlita dig inte på att konsumentköplagens as-is-friskrivning eliminerar all risk — sedan 2022 är generella friskrivningar kraftigt begränsade för digitala tjänster[^6]

### Källor

- Riksdagen: [Lag (2003:862)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2003862-om-finansiell-radgivning-till_sfs-2003-862/) om finansiell rådgivning till konsumenter
- Konsumentverket: [Digitala tjänster och digitalt innehåll](https://www.konsumentverket.se/varor-och-tjanster/digitala-tjanster-och-digitalt-innehall/)
- Moll Wendén: [Ny konsumentköplag — digitalt innehåll](https://mollwenden.se/aktuellt/ny-konsumentkoplag-digitalt-innehall-och-digitala-tjanster-far-storre-utrymme/)
- Wint TOS: [wint.se/faq](https://www.wint.se/faq), [Wint Integritetspolicy](https://www.wint.se/info/integritetspolicy)
- Korling, Fredric: *Rådgivningsansvar* — "Råd är information men inte all information är rådgivning"[^2]

***

## Område 2 — GDPR-compliance för automatiserad behandling

### Per-område-summary

IMY:s vägledning (senast uppdaterad 21 augusti 2025) är tydlig: Artikel 22 GDPR om automatiserat individuellt beslutsfattande gäller **enbart** när beslut saknar mänsklig inblandning **och** beslutet har rättsliga följder eller i "betydande grad påverkar" den registrerade. Att matcha event-tags mot kundprofiler för att avgöra **relevans** av en notis (t.ex. "ska denna händelse skickas till denna användare?") är **automatiserad behandling och profilering** (artikel 4.4), men **inte** automatiserat beslutsfattande enligt artikel 22 — eftersom det inte fattas något beslut med rättslig innebörd. IMY bekräftar explicit: "Om en AI-modell används som stöd i beslutsfattandet men det är en fysisk person som fattar själva beslutet är det inte fråga om ett sådant automatiskt, individuellt beslutsfattande som avses i GDPR."[^8][^9]

Relevansfiltrering är alltså **automatiserad profilering** som kräver information i integritetspolicyn, men inte human-in-the-loop. Rättslig grund kan vara **samtycke** (artikel 6.1.a) vid registrering, eller **berättigat intresse** (artikel 6.1.f) om tjänsten är gratis och profileringen är nödvändig för att leverera tjänsten. IMY kräver inte IMY-notification vid profilering med samtycke, men behandlingsregistret (artikel 30) måste upprätthållas.[^10]

### Concrete clauses to copy-paste

**PRIVACY.md § 3 — Automatiserad profilering**

```markdown
## Automatiserad behandling och profilering

KAMMAREN Watcher använder automatiserad behandling av dina 
profil-uppgifter (bolagstyp, valda bevakningsämnen, geografisk region) 
för att avgöra vilka regulatoriska notiser som är relevanta för dig. 
Denna behandling utgör profilering i enlighet med GDPR artikel 4.4.

Behandlingen innebär INTE automatiserat beslutsfattande enligt 
GDPR artikel 22 — ingen behandling fattar beslut med rättsliga följder 
för dig. Du mottar alltid notiser baserat på din konfiguration och 
kan när som helst ändra dina profil-inställningar.

**Rättslig grund:** Samtycke (GDPR artikel 6.1.a). Du lämnar samtycke 
vid registrering och kan återkalla det när som helst utan att 
det påverkar lagligheten av behandling som skett dessförinnan.

**Logiken bakom profileringen:** Systemet jämför händelse-taggar 
från myndighetskällor (t.ex. "skatt:moms", "bolag:årsredovisning") 
mot de bevakningsprofiler du har konfigurerat. Matchande taggar 
utlöser en notis. Ingen känslig personuppgift (artikel 9) 
behandlas i profileringssteget.
```

**Samtyckesbanner vid onboarding (Telegram-bot)**

```
Välkommen! Innan vi börjar behöver du godkänna vår 
integritetspolicy: [länk]. KAMMAREN Watcher behandlar ditt 
Telegram-ID och bolagsprofil för att skicka relevanta 
regulatoriska notiser. Svara JA för att godkänna och starta.
```

### Risk ranking: **4/10**

**Motivering:** Riskprofilen är låg eftersom tjänstens profilering inte fattar beslut med rättsliga följder, och IMY:s vägledning är tydlig. IMY:s tillsynsprioriteringar 2026 fokuserar på brottsbekämpning, barn/unga och AI i **offentlig sektor** — inte på privata informationstjänster av denna typ. Resterande risk är processuell: behandlingsregistret och integritetspolicyn måste vara upprättade och korrekta.[^9][^8][^10]

### Att INTE göra

- ❌ Behandla Telegram-användar-ID som anonym — IMY betraktar det som personuppgift om det kan kopplas till en fysisk person
- ❌ Ange berättigat intresse som rättslig grund utan dokumenterad avvägning (LIA) — för en gratis tjänst till aktiebolagsägare är samtycke enklare och säkrare
- ❌ Glöm behandlingsregistret (artikel 30) — det krävs oavsett om du är enskild firma och oavsett om du har färre än 250 anställda, när behandlingen medför risk för den registrerades rättigheter
- ❌ Formulera profil-matchningen som "AI beslutar vilka notiser du får" — det signalerar automatiserat beslutsfattande

### Källor

- IMY: [Dina rättigheter vid automatiserade beslut](https://www.imy.se/privatperson/dataskydd/dina-rattigheter/automatiserade-beslut/)
- IMY vägledning GDPR och AI (uppdaterad aug 2025): [Svarta lådan och rätten till information](https://www.imy.se/verksamhet/dataskydd/innovationsportalen/vagledning-om-gdpr-och-ai/gdpr-och-ai/svarta-ladan-och-ratten-till-information/)
- IMY: [Tillsyns- och vägledningsprioriteringar 2025/2026](https://www.imy.se/publikationer/tillsyns--och-vagledningsprioriteringar-2025/)
- IMY: [Samtycke som rättslig grund](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/rattslig-grund/samtycke/)
- GDPR art 22 (svenska): [gdpr-text.com](https://gdpr-text.com/sv/read/article-22/)

***

## Område 3 — DPA-krav mot AI-leverantörer

### Per-område-summary

GDPR artikel 28 kräver ett **skriftligt personuppgiftsbiträdesavtal (DPA)** när en personuppgiftsansvarig anlitar en leverantör att behandla personuppgifter. Avtalet måste enligt artikel 28.3 innehålla: ändamål, varaktighet, art, kategorier av personuppgifter, underbiträdesskyldigheter, säkerhetsåtgärder och instruktionskrav.[^11]

**Berget AI:** Berget AI är svensk och EU-hostad i Stockholm, med zero retention-policy (ingen data sparas efter inferens). Berget AI publicerar ett DPA på [berget.ai/dpa](https://berget.ai/dpa) som ingår som del av kundavtalet. Eftersom inga personuppgifter lämnar Sverige, och eftersom Berget AI inte tränar på kunddata, är riskprofilen mycket låg. Berget AI:s standard-DPA bör vara tillräcklig för typisk KAMMAREN-användning (event-klassificering), **förutsatt att** dina API-prompts inte innehåller personuppgifter om slutanvändarna. Undvik att inkludera Telegram-ID eller bolagsdata i promptarna.[^4][^12][^13]

**Anthropic Claude (US-baserat):** Anthropics DPA med Standard Contractual Clauses (SCC) ingår **automatiskt** i de kommersiella villkoren (API/Claude for Work). Anthropic lagrar data på AWS och Google Cloud i USA — dataöverföringen täcks av SCC-mekanismen under GDPR artikel 46. Användning av **konsumentkonto** (claude.ai) ger inget DPA-skydd och är otillåtet för personuppgiftsbehandling.[^14][^15][^16]

Fortnox dokumenterar underbiträden i sitt integritetsmeddelande och har avtal med samtliga underbiträden. Bokio lägger tydlig rollfördelning (Bokio som biträde/ansvarig beroende på datakategori). KAMMAREN bör anta samma tydlighet.[^17][^18]

### Concrete clauses to copy-paste

**PRIVACY.md § 5 — AI-leverantörer och DPA-stack**

```markdown
## AI-behandling och underbiträden

KAMMAREN Watcher använder följande AI-leverantörer för behandling 
av data:

| Leverantör | Funktion | Dataplacering | DPA | Överföringsmekanism |
|---|---|---|---|---|
| Berget AI (Berget Cloud AB) | Klassificering av regulatoriska händelser (95 % av LLM-anrop) | Sverige (Stockholm) | [berget.ai/dpa](https://berget.ai/dpa) | EU-intern, ej tillämpligt |
| Anthropic PBC | Chat-funktion | USA (AWS/GCP) | Ingår i Commercial API Terms | SCC (GDPR art. 46.2.c) |

Inga personuppgifter om slutanvändare (Telegram-ID, bolagsdata) 
skickas till AI-leverantörerna. API-anrop innehåller enbart 
offentlig myndighetsinformation (lagtext, nyhetsflöden). 
AI-leverantörerna agerar därför som **underbiträden** enbart 
avseende eventuell teknisk loggning, inte avseende behandling 
av slutanvändardata.

Vid chat-funktionen (Anthropic) kan användarens text innehålla 
personuppgifter. Anthropics DPA är tillämpligt och täcker denna 
behandling.
```

**Addendum-klausul för Berget AI (om standard-DPA behöver kompletteras)**

```markdown
Kompletterande instruktion till Berget AI DPA § [X]:

Personuppgiftsbiträdet (Berget AI) får inte behandla personuppgifter 
som ingår i anrop för andra ändamål än att leverera den begärda 
inferenstjänsten. Zero-retention-policyn ska tillämpas på samtliga 
anrop. Vid en personuppgiftsincident ska personuppgiftsansvarig 
underrättas utan onödigt dröjsmål och senast inom 24 timmar 
för att möjliggöra GDPR artikel 33-notifiering till IMY inom 72 timmar.
```

### Risk ranking: **3/10**

**Motivering:** Kombinationen Berget AI (zero retention, EU, standard-DPA) och Anthropic (SCC + inbyggt DPA) täcker GDPR:s grundkrav väl. Risken är låg om personuppgifter **inte** inkluderas i AI-promptarna. DSA (Digital Services Act) tillkommer men är inte primärt tillämplig på en tjänst av KAMMAREN:s storlek (under tröskelvärdena för "very large platforms"). EU AI Act 2025-2026: händelselassificering faller troligtvis under **minimal risk** (rekommendationssystem utan känslig data). Hög risk (artikel 6, Annex III) gäller inte utan kreditscoring/anställning/utbildning.[^15][^19][^4][^14]

### Att INTE göra

- ❌ Använd aldrig Anthropics gratis konsumentkonto (claude.ai) för produktion — inget DPA, sämre säkerhet[^16]
- ❌ Inkludera inte Telegram-ID, personnummer eller bolagsspecifik data i AI-promptarna — det aktiverar DPA-kraven på leverantörsnivå
- ❌ Förutsätt att Berget AI:s standard-DPA täcker allt — kontrollera att zero retention gäller API-tier du använder (verifiera i pricing/plan-villkoren)
- ❌ Glöm att lista Berget AI och Anthropic som underbiträden i PRIVACY.md — IMY kräver transparens om underbiträdenskedja[^11]

### Källor

- IMY: [Personuppgiftsbiträdesavtal](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/personuppgiftsansvariga-och-personuppgiftsbitraden/personuppgiftsbitra/)
- Berget AI DPA: [berget.ai/dpa](https://berget.ai/dpa)
- Anthropic DPA (auto-inkluderat): [privacy.claude.com](https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa)
- AIkompassen: [GDPR-säker AI 2026](https://aikompassen.com/artiklar/gdpr-saker-ai-svenska-foretag/)
- Satori: [GDPR och Claude](https://www.satoriml.se/blog/gdpr-claude-guide-svenska-foretag)
- Bokio: [Dataskydd och villkor](https://www.bokio.se/villkor-och-gdpr/)

***

## Område 4 — Personligt ansvar pre-bolagsbildning

### Per-område-summary

Som enskild firma/fysisk person har du **obegränsat personligt ansvar** för verksamhetens alla skulder och förpliktelser — inga undantag. Din privata egendom kan tas i anspråk. Skadeståndslagen (1972:207) innehåller dock en avgörande inskränkning: utomobligatorisk ersättning för **ren förmögenhetsskada** (t.ex. missad deklarationsfrist pga. felaktig notis) utgår enligt **2 kap. 2 § SkL** normalt **enbart om den orsakats genom brott**. En enskild, icke-brottslig kodningsfel eller AI-hallucination räknas inte som brott.[^20][^21][^22][^23]

Dock: om en användare ingår ett avtal med dig (TOS-acceptans), och du uppfyller inte leveransen, kan **kontraktuellt skadeståndsansvar** uppstå — och det kräver inte brott. Det gäller även ren förmögenhetsskada. En tydlig **ansvarsbegränsningsklausul i TOS** är din primära skyddsmekanism. Konsumentskyddsregler (konsumentköplagen 2022) begränsar dock möjligheten att friskriva sig helt mot konsumenter.[^24][^6]

**Timing för AB-bildning:** Den dominerande rekommendationen är att bilda AB **innan publik lansering**, inte vid testfas med 2-3 kända vänner utan ersättning. Skäl: (1) AB:t bryter den personliga skadeståndstråden prospektivt från bolagsregistreringsdatum; (2) med publik launch ökar risken för att fler användare ingår avtal och förlitar sig på tjänsten; (3) AB:t är nödvändigt för att ingå B2B-avtal och för framtida investeringar.[^23]

### Concrete clauses to copy-paste

**TOS § Y — Ansvarsbegränsning (svenska)**

```markdown
## Ansvarsbegränsning

I den utsträckning som tillåts enligt tillämplig lagstiftning 
ansvarar Tjänsteleverantören inte för:

(a) indirekta skador, följdskador, utebliven vinst, utebliven 
    intäkt eller förlust av affärsmöjlighet;

(b) skador till följd av att information från KAMMAREN Watcher 
    är ofullständig, felaktig, försenad eller saknas, inklusive 
    men inte begränsat till missade skattedeklarationer, 
    förseningsavgifter eller böter;

(c) skador till följd av avbrott, tekniska fel eller 
    force majeure-händelser som påverkar myndighetskällorna 
    eller tjänstens infrastruktur.

Tjänsteleverantörens totala skadeståndsansvar under detta avtal 
är begränsat till det belopp som användaren erlagt för tjänsten 
under de senaste tolv (12) månaderna, dock lägst noll (0) kronor 
för gratis-tier. Ingenting i dessa villkor begränsar 
Tjänsteleverantörens ansvar för uppsåtlig skada eller grov 
vårdslöshet, eller i den mån tvingande lagstiftning förbjuder 
en sådan begränsning.
```

**README disclaimer (KAMMAREN Watcher)**

```markdown
> **Disclaimer:** This project contains AI-assisted code. 
> All outputs, classifications and notifications are provided 
> "as-is" without warranty of accuracy or fitness for a 
> particular purpose. This is an information service, not 
> legal, tax or investment advice. See [TERMS.md](TERMS.md).
```

### Risk ranking: **8/10**

**Motivering:** Detta är den **högsta riskfaktorn** i hela stacken. Ren förmögenhetsskada via brott är osannolik, men kontraktuellt ansvar via TOS-acceptans är fullt möjlig om en användare kan bevisa att de förlitat sig på en felaktig notis och lidit ekonomisk skada. Som enskild firma saknas den bolagsrättsliga ansvarsbarriären. TOS-friskrivningen minskar risken men utplånar den inte. **Bilda AB före publik launch — det är den enda fullständiga skyddsmöjligheten.** Känd prejudikat: HD har konsekvent upprätthållit restriktiv hållning mot utomobligatorisk ren förmögenhetsskada utan brott (NJA 2003 s. 390), men TOS-acceptans skapar ett avtal och aktiverar kontraktuellt ansvar.[^21][^23]

### Att INTE göra

- ❌ Kör aldrig publik betaljänst som enskild firma — AB är obligatoriskt vid verklig risk
- ❌ Skicka aldrig notiser med explicit tidsgräns ("Sista dag att lämna in X är imorgon") utan dubbel käll-verifiering — det ökar fideliansen och därmed den upplevda förpliktelsen
- ❌ Förväxla inte "gratis = inget ansvar" — TOS-acceptans skapar ett avtal även utan ekonomisk motprestation
- ❌ Vänta inte med AB-bildning tills du "har intäkter" — riskerna uppstår från dag ett av publik tjänst

### Källor

- SkL (1972:207): [riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/skadestandslag-1972207_sfs-1972-207/)
- lagen.nu SkL: [lagen.nu/1972:207](https://lagen.nu/1972:207)
- Ren förmögenhetsskada SVT: [svjt.se 2017/820](https://svjt.se/svjt/2002/955)
- NJA 2003 s. 390 (ren förmögenhetsskada + brott): [lagen.nu](https://lagen.nu/dom/nja/2003s390)
- Contus: [Enskild näringsverksamhet — personligt ansvar](https://contus-accounting.se/sv/starta-foretag/enskild-naringsverksamhet/)
- Bolagsverket: [Krav på enskild näringsidkare](https://bolagsverket.se/foretag/enskildnaringsverksamhet/startaenskildnaringsverksamhet/kravpaenskildnaringsidkare.823.html)

***

## Område 5 — Open source + service-villkor split (AGPL-3.0)

### Per-område-summary

AGPL-3.0 är specifikt utformat för nätverkstjänster: § 13 kräver att **alla som interagerar med tjänsten via nätverk** ska ha tillgång till källkoden för modifierad version. Det innebär att källkoden (din GitHub-repo) måste vara publik och inkludera eventuella modifieringar — men det påverkar **inte** dina servicevillkor eller hur du driver tjänsten kommersiellt. Modellen "AGPL kod + proprietär service" används av Plausible Analytics (AGPL cloud + separata TOS/Privacy), Mattermost (AGPL edition + Enterprise) och Metabase.[^25][^26][^27]

**Dokumentstruktur (rekommenderad):**

```
LICENSE          → AGPL-3.0 boilerplate (FSF standard)
TERMS.md         → Servicevillkor för hosted cloud-tjänst
PRIVACY.md       → GDPR-policy + DPA-referenslista
README.md        → Produktbeskrivning + AI-disclaimer + källkodsänk
SECURITY.md      → Ansvarsfull disclosure-policy
```

Plausible separerar explicit "These Terms apply to Plausible Analytics Cloud. Self-hosted usage is governed solely by the license." — exakt samma separation bör KAMMAREN använda.[^27]

### Concrete clauses to copy-paste

**LICENSE (rot-mapp, fullständig fil)**

```
KAMMAREN Watcher
Copyright (C) 2026 [Ditt namn / BitNomad]

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
```

**TERMS.md — inledning (servicevillkor split)**

```markdown
# KAMMAREN Watcher — Servicevillkor

Dessa servicevillkor ("Villkoren") gäller för användning av 
**KAMMAREN Watcher Cloud** — den hanterade tjänst som drivs av 
[Ditt namn/Bolag] ("Tjänsteleverantören"). 

Dessa Villkor gäller INTE för självhostad (self-hosted) användning 
av källkoden. Källkoden är tillgänglig under GNU Affero General 
Public License v3.0 (AGPL-3.0) och regleras enbart av den licensen. 
Se [github.com/[repo]/LICENSE](https://github.com/[repo]/LICENSE).

Genom att använda KAMMAREN Watcher Cloud accepterar du dessa Villkor.
```

**PRIVACY.md — inledning (GDPR-ansvarig)**

```markdown
# KAMMAREN Watcher — Integritetspolicy

**Personuppgiftsansvarig:**  
[Namn], [Adress], [E-post för GDPR-ärenden]  
Org.nr / Personnummer: [XXX]  
(Aktiebolag bildas under Q3 2026 — denna policy uppdateras vid bolagsbildning)

Denna integritetspolicy gäller för KAMMAREN Watcher Cloud-tjänsten.  
Self-hosted installationer av källkoden behandlar inga personuppgifter 
via oss och omfattas inte av denna policy.

Senast uppdaterad: 2026-05-04
```

**README.md — disclaimer-sektion**

```markdown
## Disclaimer

KAMMAREN Watcher är en informationstjänst för bevakning av 
regulatoriska händelser. Tjänsten utgör inte skatterådgivning, 
juridisk rådgivning eller investeringsrådgivning.

Delar av källkoden i detta repository är genererade eller 
assisterade av AI-verktyg (Anthropic Claude, Berget AI). 
Koden har granskats av projektägaren men kan innehålla fel. 
Använd källkoden på eget ansvar.

**Hosted service:** Se [TERMS.md](TERMS.md) och [PRIVACY.md](PRIVACY.md)  
**Licens:** [AGPL-3.0](LICENSE)
```

### Risk ranking: **2/10**

**Motivering:** AGPL-3.0 + tydlig split är en välbeprövad modell med minimal juridisk risk. Plausible Analytics har drivit exakt denna modell utan juridiska problem sedan 2020. Den enda AGPL-specifika risken är att du glömmer att publicera källkod för en modifierad version — men eftersom du driver tjänsten själv och koden finns på GitHub är det hanterbart.[^28][^26]

### Att INTE göra

- ❌ Blanda inte AGPL-3.0 med villkor som säger "all rights reserved" — det skapar kontradiktion i LICENSE-filen
- ❌ Lägg inte servicevillkoren i LICENSE-filen — håll dem strikt separerade (LICENSE = kodlicens, TERMS.md = servicevillkor)
- ❌ Glöm inte att länka till källkodsrepo från tjänstens gränssnitt/bot — AGPL § 13 kräver att nätverksanvändare kan hitta källkoden
- ❌ Publicera inte "AI-genererad kod" utan att ha granskat den — det påverkar inte AGPL-skyldigheten, men det påverkar din ansvarssituation under TOS och SkL

### Källor

- AGPL-3.0 fulltext: [gnu.org/licenses/agpl-3.0](https://www.gnu.org/licenses/agpl-3.0.html)
- Plausible Analytics TOS (AGPL cloud split): [plausible.io/terms](https://plausible.io/terms)
- Plausible Privacy Policy: [plausible.io/privacy](https://plausible.io/privacy)
- Plausible DPA: [plausible.io/dpa](https://plausible.io/dpa)
- Wikipedia AGPL: [GNU Affero General Public License](https://en.wikipedia.org/wiki/GNU_Affero_General_Public_License)
- Cloudron forum (AGPL hosted service): [AGPLv3 + commercial hosting](https://forum.cloudron.io/topic/10896/license-warning)

***

## Samlad riskranking

| Område | Riskpoäng | Huvudrisk | Åtgärd |
|--------|-----------|-----------|--------|
| 1 — Info vs. rådgivning | **6/10** | Notis tolkas som skattedeklarationsråd | Disclaimer i varje notis + källlänk |
| 2 — GDPR profilering | **4/10** | Processuell brist (artikel 30-register) | Behandlingsregister + integritetspolicy |
| 3 — DPA AI-leverantörer | **3/10** | Personuppgifter i AI-promptar | Inga PII i promptar + verifiera DPA |
| 4 — Personligt ansvar | **8/10** | Kontraktuellt skadestånd enskild firma | **Bilda AB före publik launch** |
| 5 — AGPL split | **2/10** | Glömd källkodslänk i tjänsten | AGPL § 13-länk i bot-gränssnittet |

***

## Jämförelse: Svenska informationstjänsters juridiska hantering

| Aspekt | Wint | Bokio | Skatteverket RSS | KAMMAREN (rekommenderat) |
|---|---|---|---|---|
| Disclaimer i tjänst | Ja, tydlig "ej rådgivning" | Ja, per funktion | Ingen (myndighet) | Ja, i varje notis |
| DPA med AI-leverantör | Ja (egna system) | Ja, dokumenterat[^17] | Ej tillämpligt | Berget AI DPA + Anthropic DPA |
| GDPR-grund för profilering | Berättigat intresse | Samtycke + avtal | Ej tillämpligt | Samtycke (rekommenderat) |
| Ansvarsbegränsning | Bolagsrättslig (AB) | Bolagsrättslig (AB) | Myndighetsansvar | TOS-klausul (enskild) → AB |
| Open source | Nej | Nej | Ej tillämpligt | AGPL-3.0 |

***

## Prioriterade nästa steg (innan publik launch)

1. **Omedelbart (testfas):** Implementera disclaimer-footer i varje Telegram-notis och infotext vid /start-kommandot
2. **Inom 2 veckor:** Skriv TERMS.md, PRIVACY.md och upprätthåll behandlingsregistret (artikel 30)
3. **Innan publik launch:** Bilda aktiebolag — det är den enda fullständiga skyddsåtgärden för personligt ansvar (Område 4)
4. **Advokatkonsultation (5 000–10 000 SEK):** Fokusera på Område 1 (notis vs. rådgivning) och Område 4 (AB-timing + TOS-friskrivning) — dessa är de mest kontextspecifika och riskintensiva frågorna

---

## References

1. [Lag (2003:862) om finansiell rådgivning till konsumenter - Riksdagen](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2003862-om-finansiell-radgivning-till_sfs-2003-862/) - 1 § Denna lag gäller finansiell rådgivning som en näringsidkare tillhandahåller en konsument och som...

2. [[PDF] Investeringsrådgivning och portföljförvaltning enligt MiFID II](https://www.diva-portal.org/smash/get/diva2:1129059/FULLTEXT01.pdf) - Korling konstaterar bland annat att “Råd är information men inte all information är rådgivning” 37 v...

3. [FAQ – Få svar på de vanligaste frågorna om Wint](https://www.wint.se/faq) - Här hittar du svar på vanliga frågor om hur Wint fungerar, hur det är att vara kund hos oss och hur ...

4. [GDPR-säker AI 2026: vilka verktyg funkar faktiskt? - AIkompassen](https://aikompassen.com/artiklar/gdpr-saker-ai-svenska-foretag/) - GDPR-säker AI finns, men inte alla klarar granskning. Här är fem EU-hostade alternativ som faktiskt ...

5. [Dataskydd och villkor | Bokio](https://www.bokio.se/villkor-och-gdpr/) - Vi prioriterar din integritet och att skydda såväl dina personuppgifter som ditt företags data. Vi a...

6. [digitalt innehåll och digitala tjänster får större utrymme - Moll Wendén](https://mollwenden.se/aktuellt/ny-konsumentkoplag-digitalt-innehall-och-digitala-tjanster-far-storre-utrymme/) - För avtal om digitalt innehåll och digitala tjänster ska företagaren säkerställa att konsumenten inf...

7. [Vägledande beslut - Allmänna reklamationsnämnden](https://www.arn.se/om-arn/vagledande-beslut/) - ARN kom fram till att det av parternas avtal klart och tydligt framgick att de avtalat om en rörlig ...

8. [Svarta lådan och rätten till information – Vägledning om GDPR och AI](https://www.imy.se/verksamhet/dataskydd/innovationsportalen/vagledning-om-gdpr-och-ai/gdpr-och-ai/svarta-ladan-och-ratten-till-information/) - Automatiserat, individuellt beslutsfattande regleras särskilt i GDPR och är som huvudregel förbjudet...

9. [Frågor och svar om AI och GDPR - IMY](https://www.imy.se/blogg/fragor-och-svar-om-ai-och-gdpr/) - Med regulatorisk sandlåda om dataskydd avser IMY en fördjupad vägledning om hur gällande dataskyddsr...

10. [Tillsyns- och vägledningsprioriteringar 2025 - IMY](https://www.imy.se/publikationer/tillsyns--och-vagledningsprioriteringar-2025/) - IMY har fokus på tre områden i sin vägledning och tillsyn under 2026. Områdena är brottsbekämpning, ...

11. [Personuppgiftsbiträdesavtal - IMY](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/personuppgiftsansvariga-och-personuppgiftsbitraden/personuppgiftsbitradesavtal/) - Vi arbetar för att skydda alla dina personuppgifter, till exempel om hälsa och ekonomi, så att de ha...

12. [Data Processing Agreement - Berget AI](https://berget.ai/dpa) - This Data Processing Agreement (“DPA”) is an integral part of the Agreement between Berget and the C...

13. [Berget AI - We champion AI sovereignty to unlock innovation and ...](https://berget.ai) - Why choose Berget AI? No dependencies, no legal exposure, no data retention. European innovation and...

14. [GDPR och Claude: Pragmatisk guide för svenska företag - Satori](https://www.satoriml.se/blog/gdpr-claude-guide-svenska-foretag) - GDPR och Claude behöver inte vara komplicerat. Praktisk checklista med 6 steg, AI-policy, och realis...

15. [How do I view and sign your Data Processing Addendum (DPA)?](https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa) - Anthropic's DPA with Standard Contractual Clauses (SCCs) is automatically incorporated into our Comm...

16. [GDPR och AI-verktyg: det är lättare än du tror att bryta mot reglerna](https://www.ampliflow.se/artiklar/gdpr-ai-verktyg-privata-konton/) - AI-verktyg i sig bryter inte mot GDPR. Men det räcker med ett mejl med ett namn i ett privat konto, ...

17. [Integritetspolicy - Bokio](https://www.bokio.se/villkor-och-gdpr/integritetspolicy/) - Denna integritetspolicy innehåller information om den behandling av personuppgifter som Bokio är per...

18. [Dataskydd - Fortnox](https://www.fortnox.se/integritet-och-sakerhet/gdpr) - Fortnox ska som personuppgiftsbiträde ge tillräckliga garantier om att skyldigheterna i Dataskyddsfö...

19. [EU AI Act 2026: what your website needs to comply - Webbfabriken](https://www.webbfabriken.com/en/blog/eu-ai-act-2026-website-compliance) - The EU AI Act came into full effect during 2025 and 2026. For most websites it does not require dram...

20. [Skadestånd för ren förmögenhetsskada utan lagstöd](https://svjt.se/svjt/2017/820) - Ren förmögenhetsskada är den enda skadetyp som har en definition i lagen. I 1 kap. 2 § stadgas att e...

21. [NJA 2003 s. 390 - lagen.nu](https://lagen.nu/dom/nja/2003s390) - Även medverkan till brott kan medföra skadeståndsskyldighet för ren förmögenhetsskada. I förarbetena...

22. [Vad är det viktigaste att tänka på när man ska starta en enskild ...](https://lawline.se/answers/vad-ar-det-viktigaste-att-tanka-pa-nar-man-ska-starta-en-enskild-naringsverksamhet) - Vill du veta mer om dina skyldigheter och vad det innebär att ha en enskild näringsverksamhet kan du...

23. [Bildande av enskild näringsverksamhet - Contus](https://contus-accounting.se/sv/starta-foretag/enskild-naringsverksamhet/) - En viktig nackdel med denna form är att ägaren personligen ansvarar för företagets skulder och åtaga...

24. [12.5 Skadestånd - Avtalslagen 2020](https://www.avtalslagen2020.se/Section/12.5) - (1) En part som drabbas av avtalsbrott har rätt till skadestånd med undantag för vad som följer av n...

25. [GNU Affero General Public License - Wikipedia](https://en.wikipedia.org/wiki/GNU_Affero_General_Public_License) - The GNU Affero General Public License (GNU AGPL) is a free, copyleft license published by the Free S...

26. [Open source licensing and why we're changing Plausible to the ...](https://plausible.io/blog/open-source-licenses) - Plausible Analytics has now changed the license from the MIT to a newer licensing scheme called GNU ...

27. [Plausible Analytics Terms of Service](https://plausible.io/terms) - These Terms apply to Plausible Analytics Cloud. Self-hosted usage is ... More details are available ...

28. [License warning | Cloudron Forum](https://forum.cloudron.io/topic/10896/license-warning) - The GNU Affero General Public License Version 3 (AGPLv3) does not preclude you from selling access t...


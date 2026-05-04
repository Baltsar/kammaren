# Användarvillkor — KAMMAREN

**Senast uppdaterad:** 2026-05-04
**Version:** 2.0
**Tillämplig lag:** Svensk rätt
**Forum:** Stockholms tingsrätt

---

## 1. Parter och identitet (E-handelslagen 8 §)

- **Tjänst:** KAMMAREN (`https://kammaren.nu`), ett privat open source-projekt.
- **Operatör:** Gustaf Garnow, fysisk person i näringsverksamhet (enskild firma), Sverige.
- **Kontakt:** info@kammaren.nu
- **Källkod:** https://github.com/Baltsar/kammaren (publik, AGPL-3.0-or-later)

KAMMAREN **har ingen koppling** till Kammarkollegiet, Kammarrätten, Skatteverket eller någon annan svensk myndighet. Namnlikheten är slumpmässig.

---

## 2. Tjänsterna

KAMMAREN består av två separata, kostnadsfria tjänster:

**Skatte-engine** (`https://kammaren.nu`, `kammaren-tax-engine` på npm, MCP-server):
deterministisk skatteberäkning för svenska aktiebolag (arbetsgivaravgifter, moms,
bolagsskatt, K10-gränsbelopp). Reglerna i §§ 3–8 och § 18 gäller denna tjänst.

**Watcher Cloud** (Telegram-notiser om regulatoriska händelser från svenska
myndighetskällor): automatiserad informationstjänst som skickar notiser baserat
på din bolagsprofil. Reglerna i §§ 9–14 gäller denna tjänst.

Dessa Villkor gäller **inte** för självhostad (self-hosted) användning av
källkoden. Källkoden är tillgänglig under [AGPL-3.0-or-later](./LICENSE) och
regleras enbart av den licensen.

---

## 3. Skatte-engine — tjänstens natur

KAMMAREN tillhandahåller en **deterministisk skatteberäkning** för svenska skatter 2026 (arbetsgivaravgifter, moms, bolagsskatt, K10-gränsbelopp). Samma input ger samma output.

**Detta är INTE:**
- Skatterådgivning
- Finansiell rådgivning i mening av lag (2003:862)
- Revision eller revisionsbiträde enligt Revisorslagen (2001:883)
- Personligt anpassade rekommendationer
- Värdepappersrådgivning enligt lag (2007:528)
- Rådgivning enligt DAC6 / SFL 33 b kap.

Tjänsten är en generisk kalkylator baserad på offentliga skattesatser.

## 4. Skatte-engine — ingen garanti

Tjänsten tillhandahålls **"as is"**. Ingen garanti lämnas — uttrycklig eller underförstådd — för:

- Korrekthet
- Fullständighet
- Aktualitet
- Lämplighet för användarens specifika syfte
- Felfrihet eller oavbruten tillgänglighet

Reglerna speglar lagstiftning per det datum som anges i `legislation_as_of` i varje API-svar. Senare lagändringar kan göra beräkningen felaktig.

## 5. Skatte-engine — ansvarsbegränsning

Tjänsten är gratis. Användning sker på användarens **egen risk**.

- Operatören ansvarar **inte** för direkt eller indirekt skada som uppkommer av användning.
- Operatören ansvarar **inte** för skattetillägg, ränta, försenings­avgifter eller andra myndighetssanktioner.
- Operatören ansvarar **inte** för ren förmögenhetsskada.
- Samlad ersättningsskyldighet är **0 SEK**.

**Begränsning enligt svensk tvingande rätt:** Ansvar för skada orsakad av grov oaktsamhet eller uppsåt kan enligt 36 § Avtalslagen inte avtalas bort. I den utsträckning lagen kräver annat ansvar gäller sådant tvingande ansvar — inget annat.

## 6. Skatte-engine — användarens ansvar

Användaren åtar sig att:

1. **Verifiera** samtliga beräkningar mot Skatteverket (skatteverket.se) innan deklaration eller beslut.
2. **Anlita auktoriserad rådgivare** (auktoriserad redovisningskonsult, revisor eller skattejurist) för alla skattemässigt betydelsefulla beslut.
3. **Inte skicka personuppgifter** (personnummer, namn, adresser m.m.) i API-input. KAMMAREN lagrar inga request-bodies, men skickade personuppgifter behandlas inte av operatören.
4. **Förmedla denna friskrivning i sin helhet** om tjänsten används via AI-agent eller annan förmedlande tjänst.

## 7. Skatte-engine — AI-agent-användning

Om KAMMAREN anropas via AI-agent (t.ex. ChatGPT, Claude) eller annan automatiserad tjänst, åtar sig API-konsumenten att:

- Förmedla fältet `disclaimer` och `legal`-sektionen **i sin helhet** till slutanvändaren.
- Inte presentera KAMMAREN:s resultat som auktoriserad skatterådgivning.
- Dokumentera sin egen användning för möjlig tvist.

Brott mot denna bestämmelse är API-konsumentens ensamma ansvar.

## 8. Skatte-engine — målgrupp

Tjänsten riktar sig i första hand till **näringsidkare, utvecklare och fackligt kunniga användare** (redovisningskonsulter, revisorer, skattejurister). Konsumenter rekommenderas att **ej förlita sig på resultatet utan att konsultera auktoriserad rådgivare**.

Detta begränsar inte konsumentens lagstadgade rättigheter enligt Konsumentköplagen (2022:260) eller annan tvingande konsumentskyddsrätt.

---

## 9. Watcher Cloud — B2B-only positioning

Tjänsten riktas till svenska aktiebolag och deras företrädare i
sin näringsverksamhet. Tjänsten är inte avsedd för konsumenter.
Genom att acceptera dessa villkor bekräftar du att du agerar i
egenskap av företrädare för ett aktiebolag och i näringssyfte.

Före leverans av Watcher-notiser kräver Tjänsteleverantören att användaren
aktivt bekräftar (i) dessa Villkor, (ii) [Integritetspolicyn](./PRIVACY.md), och
(iii) B2B-positioneringen ovan. Saknas någon av dessa bekräftelser levereras
inga notiser.

## 10. Watcher Cloud — informationstjänst, ej rådgivning

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

## 11. Watcher Cloud — kostnadsfri tjänst

Tjänsten tillhandahålls kostnadsfritt utan motprestation från användaren.

## 12. Watcher Cloud — ansvarsbegränsning

Tjänsteleverantörens totala skadeståndsansvar enligt detta avtal är
begränsat till noll (0) kronor. Detta inkluderar direkta skador,
indirekta skador, följdskador, utebliven vinst, utebliven intäkt
eller förlust av affärsmöjlighet, oavsett rättslig grund.

Ingenting i dessa villkor begränsar Tjänsteleverantörens ansvar
för uppsåtlig skada eller grov vårdslöshet.

## 13. Watcher Cloud — as-is-friskrivning

Tjänsten tillhandahålls "i befintligt skick" (as-is) avseende
informationens fullständighet och aktualitet. Tjänsteleverantören
friskriver sig från ansvar för skador som uppkommer till följd av
tekniska fel, förseningar i myndighetskällornas publicering,
felaktiga AI-klassificeringar eller avbrott i tjänsten, i den
utsträckning detta är tillåtet enligt tvingande konsumentskyddslagstiftning.

## 14. Watcher Cloud — open source-licens (AGPL-split)

Dessa Villkor gäller INTE för självhostad (self-hosted) användning
av källkoden. Källkoden är tillgänglig under GNU Affero General
Public License v3.0 (AGPL-3.0) och regleras enbart av den licensen.
Se [github.com/Baltsar/kammaren/LICENSE](https://github.com/Baltsar/kammaren/blob/main/LICENSE).

Delar av källkoden i repot är genererade eller assisterade av AI-verktyg
(Anthropic Claude, Berget AI). Koden granskas av projektägaren men kan
innehålla fel. Använd källkoden på eget ansvar.

Genom att använda KAMMAREN Watcher Cloud accepterar du dessa Villkor.

---

## 15. Marknadsföring — korrekthet

Påståenden som "deterministisk" avser teknisk determinism (samma input → samma output), **inte** juridisk korrekthet. Uttryck som "X regressionstest godkända" avser interna tester mot förväntade värden — inte extern juridisk granskning.

För Watcher-notiser gäller att klassificeringar och sammanfattningar produceras
automatiskt och kan vara felaktiga. Verifiera alltid mot den primärkälla som
länkas i varje notis.

## 16. Immaterialrätt

- Källkod: AGPL-3.0-or-later (se `LICENSE`).
- Lagtext och myndighetsbeslut som citeras är fria enligt 9 § Upphovsrättslagen (1960:729).
- Kommersiell licens möjlig på förfrågan.

## 17. Integritet och personuppgifter (GDPR)

Se separat [Integritetspolicy](./PRIVACY.md). Policyn täcker båda tjänsterna —
Skatte-engine (IP-adress vid API-anrop) och Watcher Cloud (Telegram-ID, orgnr,
profil-flaggor) — i separata sektioner.

## 18. Skatte-engine — rate-limiting och missbruk

Operatören förbehåller sig rätten att blockera IP-adresser, API-nycklar eller användare vid:
- Överskridande av tillåten anropsfrekvens
- Missbruk (t.ex. mass-scraping, överbelastning)
- Användning i strid med dessa villkor

## 19. Ändringar

Dessa villkor kan uppdateras. Gällande version anges av datum överst i detta dokument. Väsentliga ändringar meddelas på `https://kammaren.nu`. Fortsatt användning efter ändring utgör godkännande.

## 20. Severability

Om en bestämmelse i dessa villkor visar sig ogiltig enligt tvingande lag ska bestämmelsen ersättas av närmaste giltiga bestämmelse med samma syfte. Övriga villkor påverkas ej.

## 21. Tillämplig lag och forum

Svensk rätt tillämpas. Tvist avgörs av Stockholms tingsrätt som första instans, om inte tvingande konsumentskyddsrätt föreskriver annat forum.

---

**Frågor:** info@kammaren.nu

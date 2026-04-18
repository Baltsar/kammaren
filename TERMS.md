# Användarvillkor — KAMMAREN

**Senast uppdaterad:** 2026-04-18
**Version:** 1.0
**Tillämplig lag:** Svensk rätt
**Forum:** Stockholms tingsrätt

---

## 1. Parter och identitet (E-handelslagen 8 §)

- **Tjänst:** KAMMAREN (`https://kammaren.nu`), ett privat open source-projekt.
- **Operatör:** Gustaf Garnow, privatperson, Sverige.
- **Kontakt:** kontakt@kammaren.nu
- **Källkod:** https://github.com/Baltsar/kammaren (publik, AGPL-3.0-or-later)

KAMMAREN **har ingen koppling** till Kammarkollegiet, Kammarrätten, Skatteverket eller någon annan svensk myndighet. Namnlikheten är slumpmässig.

## 2. Tjänstens natur

KAMMAREN tillhandahåller en **deterministisk skatteberäkning** för svenska skatter 2026 (arbetsgivaravgifter, moms, bolagsskatt, K10-gränsbelopp). Samma input ger samma output.

**Detta är INTE:**
- Skatterådgivning
- Finansiell rådgivning i mening av lag (2003:862)
- Revision eller revisionsbiträde enligt Revisorslagen (2001:883)
- Personligt anpassade rekommendationer
- Värdepappersrådgivning enligt lag (2007:528)
- Rådgivning enligt DAC6 / SFL 33 b kap.

Tjänsten är en generisk kalkylator baserad på offentliga skattesatser.

## 3. Ingen garanti

Tjänsten tillhandahålls **"as is"**. Ingen garanti lämnas — uttrycklig eller underförstådd — för:

- Korrekthet
- Fullständighet
- Aktualitet
- Lämplighet för användarens specifika syfte
- Felfrihet eller oavbruten tillgänglighet

Reglerna speglar lagstiftning per det datum som anges i `legislation_as_of` i varje API-svar. Senare lagändringar kan göra beräkningen felaktig.

## 4. Ansvarsbegränsning

Tjänsten är gratis. Användning sker på användarens **egen risk**.

- Operatören ansvarar **inte** för direkt eller indirekt skada som uppkommer av användning.
- Operatören ansvarar **inte** för skattetillägg, ränta, försenings­avgifter eller andra myndighetssanktioner.
- Operatören ansvarar **inte** för ren förmögenhetsskada.
- Samlad ersättningsskyldighet är **0 SEK**.

**Begränsning enligt svensk tvingande rätt:** Ansvar för skada orsakad av grov oaktsamhet eller uppsåt kan enligt 36 § Avtalslagen inte avtalas bort. I den utsträckning lagen kräver annat ansvar gäller sådant tvingande ansvar — inget annat.

## 5. Användarens ansvar

Användaren åtar sig att:

1. **Verifiera** samtliga beräkningar mot Skatteverket (skatteverket.se) innan deklaration eller beslut.
2. **Anlita auktoriserad rådgivare** (auktoriserad redovisningskonsult, revisor eller skattejurist) för alla skattemässigt betydelsefulla beslut.
3. **Inte skicka personuppgifter** (personnummer, namn, adresser m.m.) i API-input. KAMMAREN lagrar inga request-bodies, men skickade personuppgifter behandlas inte av operatören.
4. **Förmedla denna friskrivning i sin helhet** om tjänsten används via AI-agent eller annan förmedlande tjänst.

## 6. AI-agent-användning

Om KAMMAREN anropas via AI-agent (t.ex. ChatGPT, Claude) eller annan automatiserad tjänst, åtar sig API-konsumenten att:

- Förmedla fältet `disclaimer` och `legal`-sektionen **i sin helhet** till slutanvändaren.
- Inte presentera KAMMAREN:s resultat som auktoriserad skatterådgivning.
- Dokumentera sin egen användning för möjlig tvist.

Brott mot denna bestämmelse är API-konsumentens ensamma ansvar.

## 7. Målgrupp

Tjänsten riktar sig i första hand till **näringsidkare, utvecklare och fackligt kunniga användare** (redovisningskonsulter, revisorer, skattejurister). Konsumenter rekommenderas att **ej förlita sig på resultatet utan att konsultera auktoriserad rådgivare**.

Detta begränsar inte konsumentens lagstadgade rättigheter enligt Konsumentköplagen (2022:260) eller annan tvingande konsumentskyddsrätt.

## 8. Marknadsföring — korrekthet

Påståenden som "deterministisk" avser teknisk determinism (samma input → samma output), **inte** juridisk korrekthet. Uttryck som "X regressionstest godkända" avser interna tester mot förväntade värden — inte extern juridisk granskning.

## 9. Immaterialrätt

- Källkod: AGPL-3.0-or-later (se `LICENSE`).
- Lagtext och myndighetsbeslut som citeras är fria enligt 9 § Upphovsrättslagen (1960:729).
- Kommersiell licens möjlig på förfrågan.

## 10. Integritet och personuppgifter (GDPR)

Se separat [Integritetspolicy](./PRIVACY.md). I korthet:

- Inga request-bodies loggas.
- IP-adress lagras temporärt (≤24 h) för rate-limiting (berättigat intresse, art. 6.1.f GDPR).
- Inga cookies.
- Inga personuppgifter vidarebefordras till tredje part utöver Upstash (EU-region) och Vercel.

## 11. Rate-limiting och missbruk

Operatören förbehåller sig rätten att blockera IP-adresser, API-nycklar eller användare vid:
- Överskridande av tillåten anropsfrekvens
- Missbruk (t.ex. mass-scraping, överbelastning)
- Användning i strid med dessa villkor

## 12. Ändringar

Dessa villkor kan uppdateras. Gällande version anges av datum överst i detta dokument. Väsentliga ändringar meddelas på `https://kammaren.nu`. Fortsatt användning efter ändring utgör godkännande.

## 13. Severability

Om en bestämmelse i dessa villkor visar sig ogiltig enligt tvingande lag ska bestämmelsen ersättas av närmaste giltiga bestämmelse med samma syfte. Övriga villkor påverkas ej.

## 14. Tillämplig lag och forum

Svensk rätt tillämpas. Tvist avgörs av Stockholms tingsrätt som första instans, om inte tvingande konsumentskyddsrätt föreskriver annat forum.

---

**Frågor:** kontakt@kammaren.nu

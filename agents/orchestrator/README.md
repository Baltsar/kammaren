# Orchestrator

## Vad

Tunn pipeline som kör `watcher → classifier → delivery` sekventiellt en gång
per körning. Entry point: `pipeline.ts`.

## Status

Watcher (Fas 1), **classifier deterministisk v1** (Fas 2 första steget) och
**delivery via Telegram** är implementerade. LLM-fallback för okända events
är reserverad för en uppföljnings-PR.

## Hur man kör

```bash
bun run agents/orchestrator/pipeline.ts
```

Vid framgång loggas:

```json
{
  "watcher":    { "skv": 0, "riksdagen": N, "total": N, "skv_feeds": { ... } },
  "classifier": {
    "processed": 37, "skipped": 0, "relevant": 1, "irrelevant": 36,
    "unknown_only": 36, "skipped_existing": 0, "skipped_broken_profile": 0,
    "events_loaded": 37, "customers_loaded": 1,
    "by_severity": { "info": 37, "warning": 0, "action_required": 0 }
  },
  "delivery": {
    "attempted": 1, "sent": 1,
    "skipped_existing": 0, "skipped_severity": 36,
    "skipped_no_chat_id": 0, "skipped_no_customer": 0, "skipped_no_event": 0,
    "errors": 0
  }
}
```

## Krasch-säkerhet

Varje pipeline-steg körs i en `try/catch`. Misslyckande loggas till stderr
men blockerar inte nästa steg. Stegets fält i resultatet ersätts av
`{ "error": "<meddelande>" }`. Hela `runPipeline()` exit code 0 så länge
runtime själv inte kraschar.

Internt i classifier:

- Tom eller saknad `events.jsonl` → `events_loaded: 0`, ingen krasch.
- Trasig profil-fil för en kund loggas och hoppas över
  (`skipped_broken_profile`); andra kunders processing fortsätter.
- Trasig `classifications.jsonl`-rad loggas och ignoreras vid dedupe-läsning.
- Saknat orgnr i en profil → hoppas över, ingen krasch.

## Datafiler

Append-only JSONL, samma mönster som watcher.

| Fil | Skrivs av |
|---|---|
| `../watcher/data/events.jsonl` | watcher |
| `data/classifications.jsonl` | classifier (en rad per event×kund-par) |
| `data/deliveries.jsonl` | delivery (en rad per skickad notis) |

`pipeline.ts` säkerställer att tomma filer existerar innan stegen körs så att
`loadExistingIds`-anropen inte ENOENT:ar.

## Classifier — tvåstegs deterministisk klassificering

```
agents/orchestrator/
  classifier.ts             # runClassifier(): tagga + matcha + dedupe + append JSONL
  schema/
    classification.ts       # Classification + makeClassificationId()
  rules/
    categories.ts           # CATEGORY_KEYWORDS + ACTION_KEYWORDS
    event-tagger.ts         # tagEvent(event) → Tag[]
    customer-matcher.ts     # matchCustomer(event, tags, profile) → relevant + severity + rules
```

**Steg 1 — tagging.** `event-tagger.tagEvent()` normaliserar
`title + url + raw.summary` (lowercase, å→a, ä→a, ö→o) och matchar mot
`CATEGORY_KEYWORDS` för 10 kategorier (moms, arbetsgivare, ag-avgifter,
k10, bolagsskatt, arsredovisning, revisionsplikt, gdpr, punktskatt,
anstallning). Tomt resultat → `['okand']` (kandidat för LLM-fallback).

**Steg 2 — customer-matching.** `customer-matcher.matchCustomer()` plockar
boolean-flaggor ur kundprofilen (`is_vat_registered`,
`is_employer_registered`, `employee_count`, `pays_salary_to_owner`,
`processes_personal_data`, …) och kollar om någon flagga aktiverar någon av
eventets tags. Aktiverade taggar blir `matched_rules`.

`severity` defaultar till `info`. Om eventet är relevant **och** innehåller
något action-keyword (`deklaration`, `anmäl`, `registrera`, `betala`) blir
det `action_required`. `warning` reserveras för framtida regler
(t.ex. deadline-närhet).

## Output-schema

```json
{
  "id": "ab12cd34ef56gh78",
  "event_id": "53c8c1375f92d03f",
  "customer_orgnr": "556677-8899",
  "relevant": true,
  "severity": "info",
  "tags": ["gdpr"],
  "matched_rules": ["gdpr: gdpr.processes_personal_data"],
  "summary": "Berör gdpr — Förordning om dataskydd",
  "classified_at": "2026-05-04T12:00:00.000Z",
  "method": "deterministic"
}
```

`id = sha256(event_id + ':' + customer_orgnr).slice(0, 16)`. Deterministisk —
samma par ger samma id varje körning, vilket gör append-only-dedupe trivial.

## Dedupe

`loadExistingIds()` (delas med watcher) läser hela `classifications.jsonl`
och bygger ett `Set<string>`. Befintliga par hoppas över
(`skipped_existing`). Krasch-säker: trasiga rader loggas och ignoreras.

## Delivery — Telegram

```
agents/orchestrator/
  delivery.ts                # runDelivery(): filtrera + slå upp + formattera + skicka
  delivery/
    telegram.ts              # sendTelegram(chatId, message) — wrappar grammy Bot
    format.ts                # formatNotification() + escapeMarkdownV2()
  schema/
    delivery.ts              # Delivery + makeDeliveryId()
```

**Severity-strategi.** Endast classifications med
`relevant === true` och `severity` i `{action_required, warning}` levereras.
`severity: info` skippas (`skipped_severity++`) — för bullriga för att
notifiera om dagligen.

**Idempotens.** `delivery_id = sha256(classification_id + ':telegram').slice(0,16)`.
`loadExistingIds(deliveries.jsonl)` ger en `Set<string>` som filtrerar bort
redan levererade par. Andra körningen samma dag → noll Telegram-anrop.

**Krasch-säkerhet.** En misslyckad `sendTelegram` (Telegram 400, chat
not found, rate-limit) loggas till stderr och räknas som `errors++`.
Pipeline fortsätter med nästa kund. Saknat event eller saknad profil
räknas separat (`skipped_no_event`, `skipped_no_customer`) så drift kan
diagnosticeras.

**Mottagar-mappning.** `vault/customers/<orgnr>.json` har ett top-level
`telegram_chat_id: string | null`. `null` (eller fältet saknas) → kunden
hoppas över och `skipped_no_chat_id++` ticks. Operatören sätter värdet
manuellt efter att kunden bundit sin bot.

**Format.** MarkdownV2 med severity-emoji (`⚠️ action_required`,
`📌 warning`, `ℹ️ info`). All dynamisk text escapas via `escapeMarkdownV2`
för att inte krascha Telegrams parser. URL inom `[label](url)` får sin
egen escape (endast `(`, `)`, `\\`).

**Secrets.** `TELEGRAM_BOT_TOKEN` i `.env` lokalt eller som GitHub Actions
secret. Klienten byggs lazy — körningar utan severity-träffar öppnar
ingen koppling till Telegram alls.

## Vad nästa PR fyller i

1. **LLM-fallback** för events där alla tags är `okand` (just nu räknas de
   under `unknown_only` i resultatet — se loggraden i konsolen).
2. **Fler keywords** per kategori; kör mot 30 dagars events.jsonl och se
   vilka som missas.
3. **`severity: 'warning'`** för deadline-events nära ikraftträdande
   (kräver datum-extraktion ur `raw.summary`).
4. **Per-kund severity-konfig** — vissa kunder vill kanske ha `info`
   också, andra bara `action_required`. Idag hårdkodas filtret.
5. **Fler kanaler** (e-post via SMTP, eventuellt Slack). `Delivery.channel`
   är förberett — `makeDeliveryId(classification_id, channel)` ger
   icke-kolliderande dedupe per kanal.

## Filer som är read-only från denna PR

- `agents/watcher/**` (Fas 1 immutable).
- `agents/{ceo,finance,auditor,researcher}/**`.
- `skills/**`.
- `vault/customers/<orgnr>.json` förutom `556677-8899.json` (test-kund).
- `policies.json`, `audit.log`, `package.json`.

# Orchestrator

## Vad
Tunn pipeline som kör `watcher → classifier → delivery` sekventiellt en gång
per körning. Entry point: `pipeline.ts`.

## Status
Skeleton. Endast watcher är implementerad (Fas 1). Classifier och delivery
är no-op-stubs som returnerar tomma räknare och inte skriver något. Stubsen
läser dock sina input-filer för att verifiera att I/O-vägarna fungerar.

## Hur man kör
```bash
bun run agents/orchestrator/pipeline.ts
```

Vid framgång loggas:
```json
{
  "watcher":    { "skv": 0, "riksdagen": N, "total": N, "skv_feeds": { ... } },
  "classifier": { "processed": 0, "skipped": 0 },
  "delivery":   { "sent": 0, "skipped": 0 }
}
```

## Krasch-säkerhet
Varje steg körs i en `try/catch`. Misslyckande loggas till stderr men
blockerar inte nästa steg. Stegets fält i resultatet ersätts av
`{ "error": "<meddelande>" }`. Hela `runPipeline()` exit code 0 så länge
runtime själv inte kraschar.

## Datafiler
Append-only JSONL, samma mönster som watcher.

| Fil | Skrivs av |
|---|---|
| `../watcher/data/events.jsonl` | watcher |
| `data/classifications.jsonl` | classifier (stub: tom) |
| `data/deliveries.jsonl` | delivery (stub: tom) |

`pipeline.ts` säkerställer att tomma filer existerar innan stegen körs så
att stubsens `loadExistingIds`-anrop inte ENOENT:ar.

## Schema
- `schema/classification.ts` — minimal `Classification`-typ. Fas 2 utökar.
- `schema/delivery.ts` — minimal `Delivery`-typ. Fas 3 utökar.

## Vad nästa PR fyller i
1. **Real classifier** — matchar `WatcherEvent` mot kundprofiler i
   `vault/customers/` och skill-registry. Skriver `Classification`-rader
   till `data/classifications.jsonl`.
2. **Real delivery** — skickar relevanta classifications till Telegram
   (eller annan kanal). Skriver `Delivery`-rader till `data/deliveries.jsonl`.

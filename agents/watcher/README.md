# Watcher

## Vad
Regulatorisk poller. Skriver råhändelser till JSONL.

## Vad det INTE är
- Ingen klassificering
- Ingen matchning mot kund eller skill
- Ingen leverans (Telegram, e-post, dashboard)

Det här är hämtning + lagring. Inget annat.

## Hur man kör
```bash
bun run agents/watcher/poller/index.ts
```

Kör från repo-roten. Vid framgång loggas:
```json
{
  "skv": <N>,
  "riksdagen": <M>,
  "total": <N+M>,
  "skv_feeds": {
    "attempted": <antal feeds försökt>,
    "delivered": <antal som returnerade items>,
    "timeouts": <antal som hängde 30s+>,
    "empty": <antal utan items>,
    "errors": <antal HEAD/GET-fel>
  }
}
```

`skv_feeds` är användbar när SKV:s portlet-RSS beter sig oregelbundet —
delivered/timeouts visar vilka feeds som faktiskt levererat data.

## Vart datat lagras
`agents/watcher/data/events.jsonl`

Append-only. En rad per event. Inga uppdateringar, inga raderingar.
Filen skapas automatiskt vid första körningen.

Schema definieras i `agents/watcher/schema/event.ts` (`WatcherEvent`).

## Dedup
`id = sha256(url + published_at).slice(0, 16)`. Vid varje körning läses
befintliga `id` från JSONL och nya events filtreras mot dem. Samma event
skrivs aldrig två gånger.

## Källor
- **Skatteverket RSS** — Hämtas via index-discovery: två index-sidor
  parsas (`prenumererapanyheterviarss` + `prenumererapanyheterrattsinformation`),
  alla `state=rss`-portlet-länkar extraheras, och alla feeds från
  rättsinformation-indexet pollas. Varje feed HEAD-checkas (8s timeout)
  innan GET (30s timeout). Hängande feeds loggas som `feed timeout` och
  hoppas över — watcher kraschar aldrig på enskild feed. Parsas med
  `fast-xml-parser`. `type=rattsinfo` för alla feeds från
  rättsinformation-indexet.
- **Riksdagen open data** — `dokumentlista` med `doktyp=sfs` (sfs) och
  `doktyp=prop` (proposition), senaste 30 dagarna.

## Felhantering
Misslyckad poll loggas till stderr, kraschar inte. En källa kan vara nere
utan att blockera den andra. `runWatcher()` returnerar exit code 0 även om
en enskild poller returnerar tomt.

## Status
Fas 1 av M4.5. Fas 2 (classifier) och Fas 3 (delivery) kommer senare.

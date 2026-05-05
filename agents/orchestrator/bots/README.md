# KAMMAREN Watcher — Bots

Två separata Telegram-bots som tillsammans driver onboarding och daglig
notifiering. Inspirerat av ClawBuddy's tvåbotsmönster.

## Översikt

| Bot                   | Filename            | Token-env                       | Syfte                                                                                                       |
| --------------------- | ------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@kammarenverifyBOT`  | `verifier-bot.ts`   | `TELEGRAM_BOT_TOKEN_VERIFIER`   | Returnerar chat_id på `/start`. Ingen state, inga andra commands. Används bara under web-onboardingen.      |
| `@KammarenWatcherBot` | `watcher-bot.ts`    | `TELEGRAM_BOT_TOKEN`            | Driver alla commands (`/status`, `/pause`, `/resume`, `/legal`, `/forget`, `/help`) och välkomst-notisen.    |

> **Notera:** `agents/orchestrator/delivery.ts` (cron, daglig leverans)
> använder _samma_ `TELEGRAM_BOT_TOKEN` som watcher-boten. Notiserna
> kommer alltså från `@KammarenWatcherBot` — användaren ser bara en
> avsändare för både notiser och commands.

## Lokalt

```bash
# .env behöver dessa
TELEGRAM_BOT_TOKEN=...                  # @KammarenWatcherBot
TELEGRAM_BOT_TOKEN_VERIFIER=...         # @kammarenverifyBOT

bun run bot:verifier   # eller: tsx agents/orchestrator/bots/verifier-bot.ts
bun run bot:watcher    # eller: tsx agents/orchestrator/bots/watcher-bot.ts
```

Båda kör long-polling. Stäng med `Ctrl+C` (graceful shutdown).

## Deployment — Railway

Två separata Railway-services:

1. **`kammaren-bot-verifier`** — root command: `tsx agents/orchestrator/bots/verifier-bot.ts`
   Env: `TELEGRAM_BOT_TOKEN_VERIFIER`
2. **`kammaren-bot-watcher`** — root command: `tsx agents/orchestrator/bots/watcher-bot.ts`
   Env: `TELEGRAM_BOT_TOKEN`

Båda läser från `vault/customers/` som versioneras i repot. Deploy-
trigger: push till `main` på GitHub. Cron-pipen (daglig delivery) körs
fortsatt på GitHub Actions, inte Railway.

Procfile:
```
verifier: tsx agents/orchestrator/bots/verifier-bot.ts
watcher: tsx agents/orchestrator/bots/watcher-bot.ts
```

Eller `railway.json` per service om du föredrar det.

## Onboarding-flöde

1. Användaren landar på `kammaren.nu/watcher/start` → fyller i e-post.
2. Klickar "Hämta mitt Telegram-ID" → öppnar
   `t.me/kammarenverifyBOT?start=onboard`.
3. Verifier-boten svarar med chat_id i `<code>`-block.
4. Användaren går tillbaka till webben, klistrar in chat_id, fyller i
   profil + 3 consent → POST `/api/onboard`.
5. API-route skriver profilen till `vault/customers/<orgnr>.json` via
   Octokit, skickar välkomst-notis via watcher-botens token.

## Commands (watcher-bot)

| Command   | Beteende                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------- |
| `/start`  | Om registrerad → "redan registrerad". Om inte → returnera chat_id + onboarding-länk.              |
| `/help`   | Lista över alla commands.                                                                         |
| `/status` | Profil-sammanfattning + senaste notis + total levererade.                                         |
| `/pause`  | `is_paused = true` på profilen. Delivery skip:ar paused-profiler.                                 |
| `/resume` | `is_paused = false`.                                                                              |
| `/legal`  | Länkar till TERMS, PRIVACY, källkod (AGPL).                                                       |
| `/forget` | Tre-stegs bekräftelse (`RADERA` versaler, 5 min timeout). Anropar `gdprDelete` från `cli.ts`.     |

Okänd text → `/help`-hint. Texten `RADERA` accepteras endast om en
pending forget-bekräftelse är aktiv för chat_id.

## Test

```bash
npx vitest run agents/orchestrator/bots/
```

Tester:
- `verifier-bot.lib.test.ts` — escape + meddelande-byggare
- `watcher-bot.lib.test.ts` — alla command-meddelanden + tids-formatering
- `watcher-bot.test.ts` — smoke-test för bot-fabriker

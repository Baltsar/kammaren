# KAMMAREN Dashboard

Next.js 14-app som driver onboarding-flödet på `kammaren.nu/watcher/*`.

## Stack

- Next.js 14 (App Router)
- Tailwind + egen "kammaren"-palett (extraherad från live `kammaren.nu`)
- Radix UI primitiver (Checkbox, Label, Slot)
- React Hook Form + Zod
- Octokit för att committa kund-profiler till `vault/customers/`

## Lokal utveckling

```bash
cd dashboard
npm install
cp ../.env.example ../.env   # om inte redan finns
# Sätt minst TELEGRAM_BOT_TOKEN i ../.env för att testa välkomst-notisen
npm run dev
```

Öppna http://localhost:3000/watcher/start.

För att testa onboard-API:t mot ett riktigt repo behövs `GITHUB_PAT`
i miljön. Annars stannar flödet vid commit-steget och returnerar 502.
För ren UI-iteration: kommentera ut `commitProfile`-anropet i
`app/api/onboard/route.ts` lokalt.

### Markdown-rendering

`/watcher/terms` och `/watcher/privacy` läser `TERMS.md` respektive
`PRIVACY.md` från repo-roten via `lib/markdown.ts`. På Vercel följer
filerna med build-artefakten via `outputFileTracingIncludes` i
`next.config.mjs`.

## Vercel-deployment

Dashboard:en är ett **separat Vercel-projekt** för att inte krocka med
den existerande static-buildens `vercel.json` i repo-roten (som servar
`public/index.html` på `kammaren.nu/`).

Setup:

1. Skapa nytt Vercel-projekt → samma GitHub-repo (`Baltsar/kammaren`)
2. **Root Directory:** `dashboard`
3. **Framework Preset:** Next.js (auto-detekterat)
4. **Environment Variables:**
   - `TELEGRAM_BOT_TOKEN` — Watcher-bottens token
   - `GITHUB_PAT` — Personal Access Token, `contents: write`
   - (optional) `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` om
     du committar till en fork
5. **Domain routing** — tilldela en sub-path eller subdomän:
   - **Path-baserat:** Konfigurera Vercel-projektets domän till
     `kammaren.nu` med "Path Prefix" `/watcher` (då hanteras
     `/watcher/*` här och `/` av landing-projektet).
   - **Subdomän-baserat (enklare för Fas 1):** Använd
     `watcher.kammaren.nu` för dashboard, `kammaren.nu` för landing.
     Update `agents/orchestrator/bots/watcher-bot.lib.ts`-konstanterna
     om subdomän väljs.

Default i koden: path-baserat (`https://kammaren.nu/watcher/start`).

## API-routes

| Route                      | Method | Syfte                                              |
| -------------------------- | ------ | -------------------------------------------------- |
| `/api/onboard`             | POST   | Tar emot full profil, validerar, committar via Octokit, skickar välkomst-notis. |
| `/api/profile/[orgnr]`     | GET    | Minimal profil-vy för status-page (ingen consent-data exponerad). |

Onboard-route är idempotent: returnerar `409 already_exists` om
profilen redan finns. För att registrera om sig måste användaren
köra `/forget` i Telegram-boten först.

## Filstruktur

```
dashboard/
  app/
    layout.tsx                 # root + IBM Plex/Playfair fonts
    page.tsx                   # redirect till /watcher/start (för dev)
    globals.css                # tailwind + kammaren-tokens
    watcher/
      start/page.tsx           # mountar OnboardingWizard
      terms/page.tsx           # renderar TERMS.md
      privacy/page.tsx         # renderar PRIVACY.md
    api/
      onboard/route.ts         # POST handler
      profile/[orgnr]/route.ts # GET handler
  components/
    ui/                        # button, input, label, checkbox, field-error
    onboarding/                # progress-dots, step-email, step-telegram, step-profile, step-success, wizard
  lib/
    luhn.ts                    # svensk orgnr-validering
    validation.ts              # Zod-schemas
    storage.ts                 # Octokit wrapper
    markdown.ts                # mini MD → HTML
    telegram.ts                # tunn Telegram Bot API-klient
    utils.ts                   # cn() helper
```

## Verifiering

Tills vidare manuell QA — kör `npm run dev`, gå igenom flödet i en
mobil-emulator (DevTools → 414×896) samt desktop. Cypress/Playwright-
suite tillkommer i separat issue.

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # full prod build
```

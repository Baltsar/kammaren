# Customer Profile Store

Per-customer profile storage for the watcher classifier (Fas 2). Lagras i Supabase EU (eu-north-1 Stockholm) i tabellen `public.customer_profiles` bakom RLS deny-all + service-role-bypass.

Schema source-of-truth: [`agents/watcher/research/swedish-ab-regulatory-profile-schema.md`](../research/swedish-ab-regulatory-profile-schema.md).

## API

```ts
import {
  read,
  upsert,
  patch,
  exists,
  list,
  listActiveCustomers,
  remove,
} from './customer-profile/store.js';

await upsert('559123-4567', fullProfile);
await patch('559123-4567', { tax_profile: { is_vat_registered: true } });
const profile = await read('559123-4567');
const orgnrs = await list();
const active = await listActiveCustomers(); // ej raderade, ej pausade
await remove('559123-4567'); // HARD DELETE FROM customer_profiles
```

Samtliga funktioner accepterar en valfri `{ client }`-option (en `SupabaseClient`-instans). Default är en lazy-init env-backed singleton som läser `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` från `process.env`.

## Semantics

- **`upsert`** — full replace. Validerar orgnr och att payload-orgnr matchar parameter-orgnr. `updated_at` sätts av Supabase-triggern.
- **`patch`** — JSON Merge Patch (RFC 7396): objekt deep-mergar, arrayer och primitiver ersätter. Auto-skapar en tom skeleton om profilen inte finns.
- **`read`** — returnerar `null` om profilen inte finns.
- **`list`** — returnerar alla orgnrs (sorterade i SQL).
- **`listActiveCustomers`** — `deleted_at IS NULL AND is_paused = false`. Används av delivery-pipen.
- **`remove`** — **HARD DELETE** `DELETE FROM customer_profiles WHERE orgnr = $1`. Returnerar `true` om en rad togs bort, `false` om ingen rad fanns. Använd för GDPR-radering.

## Schema

```sql
create table public.customer_profiles (
  orgnr                          text primary key,    -- "556677-8899" format
  company_name                   text not null,
  contact_email                  text,
  telegram_chat_id               text,
  consent_terms_accepted_at      timestamptz,
  consent_privacy_accepted_at    timestamptz,
  consent_b2b_acknowledged_at    timestamptz,
  is_paused                      boolean default false,
  deleted_at                     timestamptz,         -- soft-delete-kolumn, används ej
  business_activity              jsonb default '{}',
  tax_profile                    jsonb default '{}',
  accounting_reporting_profile   jsonb default '{}',
  governance_profile             jsonb default '{}',
  employment_profile             jsonb default '{}',
  gdpr_profile                   jsonb default '{}',
  workplace_safety_profile       jsonb default '{}',
  cyber_nis2_profile             jsonb default '{}',
  schema_version                 text default '1.2.0',
  created_at                     timestamptz default now(),
  updated_at                     timestamptz default now()  -- auto-update-trigger
);
alter table public.customer_profiles enable row level security;
-- anon + authenticated: DENY ALL. service_role bypassar RLS.
```

## GDPR-radering

Radera en kund manuellt — operatörens väg:

```bash
bun run gdpr delete 556677-8899
# → { "orgnr": "556677-8899", "status": "deleted", "rows_deleted": 1, ... }
# Skriver "deleted 1 rows" till stderr som confirmation.
```

Eller direkt i Supabase Dashboard → Table Editor → `customer_profiles` → välj rad → Delete.

## Miljövariabler

| Var | Krav | Syfte |
|-----|------|-------|
| `SUPABASE_URL` | obligatorisk | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | obligatorisk | Bypassar RLS. **Endast serverside.** |

Anon/publishable-nyckeln behövs inte serverside men dokumenteras i `.env.example`.

## Migration från fil-baserad lagring (historik)

Tidigare lagrades profiler som `vault/customers/<orgnr>.json` i repot. Eftersom `github.com/Baltsar/kammaren` är publikt + AGPL-3.0 läckte detta PII (telegram_chat_id, orgnr, consent-stämplar) på GitHub. Migration genomförd i feature/supabase-customer-storage (test-kunden flyttades till Supabase och `vault/customers/*.json` togs bort).

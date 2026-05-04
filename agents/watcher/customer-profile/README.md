# Customer Profile Store

Per-customer profile storage for the watcher classifier (Fas 2). One JSON file per customer at `vault/customers/<orgnr>.json`, where `<orgnr>` matches `^\d{6}-\d{4}$`.

Schema source-of-truth: [`agents/watcher/research/swedish-ab-regulatory-profile-schema.md`](../research/swedish-ab-regulatory-profile-schema.md).

## API

```ts
import {
  read,
  upsert,
  patch,
  exists,
  list,
  remove,
} from './customer-profile/store.js';

await upsert('559123-4567', fullProfile);
await patch('559123-4567', { tax_profile: { is_vat_registered: true } });
const profile = await read('559123-4567');
const orgnrs = await list();
await remove('559123-4567');
```

All functions accept an optional `{ vaultDir }` to override the default `<cwd>/vault/customers`.

## Semantics

- **`upsert`** — full replace. Validates orgnr and orgnr/payload match. Stamps `meta.profile_last_updated_at`.
- **`patch`** — JSON Merge Patch (RFC 7396): objects deep-merge, arrays and primitives replace. Auto-creates an empty skeleton if the profile does not exist. Stamps `meta.profile_last_updated_at`.
- **`read`** — returns `null` if the profile does not exist.
- **`list`** — returns sorted orgnrs from the vault directory; ignores non-orgnr filenames.
- **`remove`** — hard delete. Returns `true` if removed, `false` if it did not exist.

## Validation

Light validation only:
- `company_identity.company_registration_number` must match `^\d{6}-\d{4}$`
- Filename orgnr must match payload orgnr

Full JSON Schema validation against the regulatory profile schema is deferred until the Fas 2 classifier needs it. See `// CONTRACT:` markers in `store.ts`.

## Atomicity

`upsert` and `patch` write to `<file>.tmp` and rename — concurrent writers do not see partial JSON.

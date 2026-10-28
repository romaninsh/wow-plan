# Populating production (from this machine)

Production data is loaded from this machine only. Nothing in the cloud imports, seeds or
migrates on its own: Cloud Run only reads (and writes plans through the API's actions).

| Store | What | Loaded by |
|---|---|---|
| Cloud SQL `wow-plan-pg`, database `wow`, schema `wow` | reference data (one client build) | Data page → **Import build** (`pipeline/import.sh prod`) |
| Atlas cluster `vantage`, database `wowplan` | guides (plans, characters, brackets, to-dos) | Data page → **Update guides schema**, Plans page → **Reset sample plans** (`mongo/guides.sh prod …`) |

## The prod profile

Switch the desktop to the `prod` profile (beside the settings cog). Every button then acts on
production: `TARGET=prod` in `.env.prod` tells them which databases, and the Data page says so
in a warning line. Under `local` the same buttons act on the composer stack.

`.env.prod` (git-ignored, mode 600, never printed) holds:

| key | what |
|---|---|
| `TARGET` | `prod` |
| `SECRET_WOW_URL` | Cloud SQL as the read-only `wow_reader`, over the public IP with TLS: what the desktop pages read |
| `WOW_PG_OWNER_URL` | Cloud SQL as the owner `wow`, over the public IP with TLS: what the import publishes as |
| `SECRET_PLANS_URL` | Atlas, database `wowplan` |

Cloud Run doesn't read this file: its `SECRET_WOW_URL` (the `/cloudsql` socket) and
`SECRET_PLANS_URL` come from Secret Manager.

**Network access.** Cloud SQL accepts direct connections only from the addresses in
`admin_networks` (`~/Work/vantage-terraform/modules/wow-plan-gcp/main.tf`, applied with
`tofu apply`), always with TLS and a password. Atlas allows the addresses on its Network
Access list. A VPN changes this machine's address: turn it off, or add its address to both.

## Postgres (Cloud SQL)

### Each import

1. Fetch the build if it isn't in `refs/wago/` (Data page → Fetch build; the same for every
   profile).
2. Under `prod`: Data page → **Import build** (empty build = newest fetched). The terminal shows
   dbt building and testing in DuckDB on this machine, then the swap in Cloud SQL. A failing
   test stops before the swap: production keeps the previous build. From a shell:
   `pipeline/import.sh prod [build]`.
3. The import re-grants `USAGE` on schema `wow` and `SELECT` on its tables to `wow_reader`
   inside the swap (`pipeline/publish.py`, `WOW_PG_READER`), since every import builds a new
   schema.

4. Every import and rollback adds a row to `wow_meta.import_history` in that database (build,
   product, opendata commit, this project's commit, duration, row counts, outcome, failed runs
   too). The **Import history** page lists them; it works once the first recorded import has
   run on that database. The schema `wow_meta` is never swapped, so the history survives.

When a new client build turns out broken:

- Data page → **Roll back import** (`pipeline/import.sh prod rollback`): swaps `wow` and
  `wow_prev` in one transaction, so the previous import is live again at once. Running it
  again undoes it.
- Import history → a run → **Re-import this build**: rebuilds that build from its fetched
  files in `refs/wago/<build>/` with today's transforms and the current opendata (Fetch build
  that build first if its files are gone).

### Once: users and grants (done 2026-10-28)

The two users are made by hand so their passwords never reach Terraform state:

- `wow`, the owner, through the Cloud SQL Admin API (member of `cloudsqlsuperuser`, so it can
  create schemas and the reader role).
- `wow_reader`, in SQL as `wow` (not with `gcloud sql users create`, which would make it a
  `cloudsqlsuperuser` member):

  ```sql
  CREATE ROLE wow_reader LOGIN NOCREATEDB NOCREATEROLE;
  \password wow_reader
  GRANT CONNECT ON DATABASE wow TO wow_reader;
  ALTER ROLE wow_reader SET default_transaction_read_only = on;
  ALTER ROLE wow_reader SET search_path = wow;
  ```

psql without installing it: `docker run --rm -it postgres:17-alpine psql
"host=<public IP> user=wow dbname=wow sslmode=require"` (asks for the password).

## MongoDB (Atlas)

| button | script | does |
|---|---|---|
| Data page → **Update guides schema** | `mongo/guides.sh prod schema` | `schema.js` (validators, indexes; deletes nothing) and `views.js` (the read-only views the desktop plan pages read; dropped and re-created) |
| Plans page → **Reset sample plans** | `mongo/guides.sh prod samples` | `seed.js`: deletes and re-inserts only the plans it lists (marked `sample: true`) with their characters, brackets and to-dos; no other plan is touched |

Both run mongosh in the `mongo:7` image with only `SECRET_PLANS_URL` forwarded from
`.env.prod`, and stop unless the URL selects database `wowplan`. Inside the container the URL
is mongosh's argument (mongosh takes it no other way). Atlas is already a replica set.

The sample plans' edit codes are published in `mongo/README.md`, so anyone can edit those
plans on the live site. Reset them when they need it; add more samples to the list in
`seed.js`.

The Atlas user needs `collMod` for schema updates ("Atlas admin", or `dbAdmin` on `wowplan`).
Cloud Run should get its own user with `readWrite` on `wowplan` only.

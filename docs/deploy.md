# Deploying wow-plan.com

What goes online is the `wowplan` API (`api/wowplan.yaml`) with its frontend (`web/wowplan/`),
in one container on `vantage-server`, on Cloud Run in project `inlaid-agility-461020-e4`,
region `europe-west2`. The desktop app and its pages stay on the machine.

Under the `prod` profile the API reads game data from Cloud SQL (`wow-plan-pg`, database `wow`,
schema `wow`, as `wow_reader`) and guides from MongoDB Atlas (database `wowplan`). Auth is
`session` with anonymous sessions (`application.yaml`): every visitor gets an in-memory session;
every entity is read-only, and plans change only through the API's actions, which the plans
datasource's rule refuses for a plan the session hasn't unlocked with its edit key.

The cloud resources (Cloud SQL, Artifact Registry repo `wow-plan`, the two secrets, the
`wow-plan-run` service account and the `wow-plan` Cloud Run service) come from Terraform:
module `wow_plan_gcp` in `~/Work/vantage-terraform` (`modules/wow-plan-gcp/README.md` there has
the apply order and the by-hand steps). Secret values are added by hand, never in
Terraform or git. Loading the data (Postgres users and imports, the MongoDB schema) is in
[docs/populate-prod.md](populate-prod.md).

**In one step:** `./deploy.sh` builds the image (tag `<date>-<commit>`, `-dirty` with
uncommitted changes), refuses to push one with an `.env` file inside, pushes it, deploys it and
checks the live service (`/v1/ready`, the page title, the schema). `./deploy.sh --check` only
checks. The sections below are the same steps by hand.

## Build

```sh
docker build --platform linux/amd64 --build-arg API=wowplan -t wow-plan:local .
docker run --rm --entrypoint sh wow-plan:local -c 'ls -a /app/project /app/web'   # no .env anywhere
```

The image copies `application.yaml`, `datasource/`, `table/`, `api/`, `action/` and the built
frontend. `.dockerignore` keeps `.env*`, the pipeline, dbt, seeds, refs and data out.
`pipeline/Dockerfile` is a different image (the fetch/import pipeline).

## Run it locally as production would

Production profile, secrets from the environment, port from `PORT`, but pointed at the local
compose stack (check its ports with `docker ps`; they change when the stack restarts):

```sh
docker run -d --name wow-plan-check --platform linux/amd64 -p 127.0.0.1:8093:8080 \
  -e PORT=8080 -e VANTAGE_PROFILE=prod \
  -e 'SECRET_WOW_URL=postgres://wow:<local pw>@host.docker.internal:<pg port>/wow?sslmode=disable&options=-c%20search_path%3Dwow' \
  -e 'SECRET_PLANS_URL=mongodb://host.docker.internal:<mongo port>/wowplan?directConnection=true' \
  wow-plan:local
curl -s http://127.0.0.1:8093/v1/ready                 # {"ready":true}
curl -s http://127.0.0.1:8093/v1/schema                # 13 tables, actions create_plan, unlock_plan, add_target …
curl -s http://127.0.0.1:8093/ | grep '<title>'        # wow-plan.com
docker logs wow-plan-check 2>&1 | grep '"started"'     # "profile":"prod"
node .agents/skills/vantage-api/scripts/smoke.mjs http://127.0.0.1:8093
node tests/api_actions.mjs http://127.0.0.1:8093       # creates an "api test …" plan
docker rm -f wow-plan-check
```

The smoke script's "flash to a column outside `columns`" step reports FAIL with "no writable
entity lists `columns`": every entity here is read-only, so there is nothing to test. Expected.

## Push

```sh
gcloud auth configure-docker europe-west2-docker.pkg.dev --quiet
TAG=$(date +%Y%m%d-%H%M)          # a new tag every build
IMG=europe-west2-docker.pkg.dev/inlaid-agility-461020-e4/wow-plan/wow-plan:$TAG
docker build --platform linux/amd64 --build-arg API=wowplan -t "$IMG" .
docker push "$IMG"
```

## Deploy

```sh
gcloud run deploy wow-plan --project inlaid-agility-461020-e4 --region europe-west2 --image "$IMG" \
  --service-account wow-plan-run@inlaid-agility-461020-e4.iam.gserviceaccount.com \
  --add-cloudsql-instances inlaid-agility-461020-e4:europe-west2:wow-plan-pg \
  --set-env-vars VANTAGE_PROFILE=prod \
  --set-secrets SECRET_WOW_URL=wow-plan-wow-url:latest,SECRET_PLANS_URL=wow-plan-plans-url:latest \
  --allow-unauthenticated --timeout 3600 --min-instances 1 --max-instances 1 \
  --concurrency 1000 --cpu 1 --memory 512Mi --cpu-boost
```

- `--min-instances 1`: sessions, and with them every unlock, live in the instance's memory.
  At `0` Cloud Run scales an idle service down and every browser and agent finds its plans
  locked again (the page shows the padlock closed; the key unlocks again). One idle instance
  costs little with CPU throttled; `0` is fine if losing unlocks after a quiet spell is.
- `trust_forwarded: true` in `api/wowplan.yaml` is right for Cloud Run reached directly: the
  per-address limits (unlock, create_plan, new sessions) key on the caller's address from
  `X-Forwarded-For`. Behind a Google HTTP(S) load balancer set it to `2`. Locally there is
  no header and the socket's peer counts.
- CPU is throttled outside requests (Cloud Run's default; an open WebSocket counts as a
  request), so it bills only while someone is connected. Don't add `--no-cpu-throttling`.
- `--timeout 3600`: a WebSocket is one request; the default 300 s drops every client each
  five minutes.
- `--max-instances 1`: live views live in the server's memory and aren't shared between
  instances. `--concurrency 1000`: each open page holds one request.
- `--add-cloudsql-instances` mounts the Cloud SQL socket at `/cloudsql`, which is what
  `SECRET_WOW_URL` points at:
  `postgres://wow_reader:<pw>@localhost/wow?host=/cloudsql/inlaid-agility-461020-e4:europe-west2:wow-plan-pg&options=-c%20search_path%3Dwow`
- For a new version, build with the next tag, run it locally, push and deploy with the new
  `--image`; the other flags stay.

## MCP for AI agents

`api/wowplan.yaml` has `mcp: { mount: main }`: the same API as an MCP server (`/mcp`,
Streamable HTTP) on the API's own port, beside the page and `/v1/ws`. So the one `wow-plan`
service above serves agents too; nothing more to deploy:

```sh
claude mcp add --transport http wowplan "$(gcloud run services describe wow-plan \
  --project inlaid-agility-461020-e4 --region europe-west2 --format='value(status.url)')/mcp"
```

- One process serves the browsers and the agents, so they share sessions and rate limits: a
  New edit key (`rotate_edit_key`) from the page locks out an agent that had unlocked the plan
  at its next call, and a key rotated by an agent locks out the browsers.
- Locally too: `vantage-server --api wowplan` serves MCP at `http://127.0.0.1:8090/mcp` (the
  API's port); Vantage's Services row shows the URL. There is no second port to pick
  (`--mcp-port` / `VANTAGE_MCP_PORT` is ignored, with a warning).
- The alternative, MCP on a port of its own (`mcp: { port: 4390 }`) run as a second Cloud Run
  service of the image, is two processes: a rotated key would revoke sessions only in the
  service that ran it, the others keeping the plan until they end (idle 1 h), and each service
  would keep its own rate limits. Not worth it here.

## Atlas must let Cloud Run in

Atlas only admits addresses on its Network Access list, and Cloud Run's outgoing addresses
aren't on it. Until they are, `/v1/ready` stays 503 or the first read of a guide fails, and
the logs show `received fatal alert: InternalError`. Two options (Security -> Network Access
in Atlas, done by the account owner; keep the existing entries):

- allow `0.0.0.0/0` (the password in the URL is then the only lock). Only with a Cloud Run
  Atlas user scoped to `readWrite` on `wowplan` (vantage-terraform's modules/wow-plan-gcp/README.md, step 3), never with the
  shared pizza-1 user, which reaches every database on the cluster; or
- (preferred) give the service a fixed outgoing address (Cloud NAT with a reserved IP, see
  `.agents/skills/vantage-deploy/references/cloud-run.md`, "A fixed outgoing address") and
  allow only that one.

Cloud SQL needs no allow-list: the service reaches it through the Cloud SQL connector as
`wow-plan-run` (`roles/cloudsql.client`).

## Check after deploy

```sh
URL=$(gcloud run services describe wow-plan --project inlaid-agility-461020-e4 \
  --region europe-west2 --format='value(status.url)')
curl -s "$URL/v1/ready"                                  # {"ready":true}
curl -s "$URL/" | grep '<title>'                         # wow-plan.com
node .agents/skills/vantage-api/scripts/smoke.mjs "$URL"  # every table opens with rows
gcloud run services logs read wow-plan --project inlaid-agility-461020-e4 \
  --region europe-west2 --limit 50                       # the "started" line, profile prod
```

`tests/api_actions.mjs` and the smoke script's `--action` write real plans to production
Atlas: only with a clear test name, and delete them afterwards.

## Delete

Terraform manages the service, so remove it there (vantage-terraform's modules/wow-plan-gcp/README.md, "Removing it"):

```sh
cd ~/Work/vantage-terraform
tofu destroy -target=module.wow_plan_gcp.google_cloud_run_v2_service.service
```

Deleting it with `gcloud run services delete` would leave Terraform's state behind, and the next
`tofu apply` would recreate it on the placeholder image. Use gcloud only for a service Terraform
does not manage. Cloud SQL has deletion protection on and keeps billing until it is removed
through Terraform.

# syntax=docker/dockerfile:1
# The wowplan API with its web frontend (wow-plan.com) on vantage-server.
#   docker build --platform linux/amd64 --build-arg API=wowplan -t wow-plan:local .
# pipeline/Dockerfile is a different image (the fetch/import pipeline).
# 1.10.1: anonymous sessions, MCP at /mcp and offset() in action bodies (find_game_data).
ARG WEB_DEV=romaninsh/vantage-web-dev:1.10.0
ARG SERVER=romaninsh/vantage-server:1.10.1

# The built site is plain files, so this stage runs natively even when the
# image is for another platform.
FROM --platform=$BUILDPLATFORM ${WEB_DEV} AS web
ARG API
RUN test -n "$API" || { echo "pass --build-arg API=<name> (api/<name>.yaml)" >&2; exit 1; }
COPY --chown=node:node web/${API} /app
RUN node /opt/vantage/entrypoint/main.mjs build --out /app/out

FROM ${SERVER}
ARG API
COPY application.yaml /app/project/application.yaml
COPY datasource /app/project/datasource
COPY table /app/project/table
COPY api /app/project/api
COPY action /app/project/action
COPY --from=web /app/out /app/web
ENV VANTAGE_API=${API}
CMD ["--static", "/app/web"]

#!/usr/bin/env bash
# Refresh IP databases for the running echo-app container.
#
# Downloads into a staging directory first, verifies every MMDB opens, swaps the
# files in atomically, then restarts the container so providers reload.
# A failed download or verification leaves the live data untouched.
set -euo pipefail

DATA_DIR=${ECHO_DATA_DIR:-/data/echo/data}
STAGING=${ECHO_STAGING_DIR:-/data/echo/staging}
CONTAINER=${ECHO_CONTAINER:-echo-app}

IMAGE=$(docker inspect "$CONTAINER" --format '{{.Image}}')

mkdir -p "$DATA_DIR" "$STAGING"
find "$STAGING" -mindepth 1 -delete

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e IPDB_DIR=/data \
  -v "$STAGING":/data \
  -w /app/packages/ip-service \
  "$IMAGE" bun run scripts/ipdb-fetch.ts --verify

for file in "$STAGING"/*; do
  mv -f "$file" "$DATA_DIR/"
done
find "$STAGING" -mindepth 1 -delete

docker restart "$CONTAINER"
docker exec "$CONTAINER" bun -e \
  'fetch("http://127.0.0.1:7010/api/live").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'

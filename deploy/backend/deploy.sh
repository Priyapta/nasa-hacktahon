#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

image=${1:?Pass the release image digest}
registry_user=${2:?Pass the GitHub registry username}
image_pattern='^ghcr\.io/[a-z0-9._/-]+@sha256:[0-9a-f]{64}$'
if [[ ! $image =~ $image_pattern ]]; then
  echo "Expected a ghcr.io image pinned to a sha256 digest." >&2
  exit 1
fi
if [[ ! -r backend.env ]]; then
  echo "Create backend.env on the VPS before deploying." >&2
  exit 1
fi

exec 9>.deploy.lock
flock -w 300 9
previous_image=
if [[ -f .release.env ]]; then
  previous_image=$(sed -n 's/^BACKEND_IMAGE=//p' .release.env)
  if [[ ! $previous_image =~ $image_pattern ]]; then
    echo "The saved release image is invalid; inspect .release.env." >&2
    exit 1
  fi
fi

# The workflow supplies a short-lived registry token over SSH stdin.
registry_config=$(mktemp -d)
trap 'rm -rf -- "$registry_config"' EXIT
export DOCKER_CONFIG=$registry_config
docker login ghcr.io --username "$registry_user" --password-stdin >/dev/null

compose() {
  docker compose -f compose.yaml "$@"
}

export BACKEND_IMAGE=$image
compose pull api
if compose up -d --wait --wait-timeout 120 api; then
  if [[ -f .release.env ]]; then
    cp .release.env .previous.env
  fi
  printf 'BACKEND_IMAGE=%s\n' "$image" > .release.env.next
  mv .release.env.next .release.env
  echo "Backend is healthy: $image"
else
  compose logs --tail 60 api >&2 || true
  if [[ -n $previous_image ]]; then
    echo "New release failed; restoring the previous image." >&2
    export BACKEND_IMAGE=$previous_image
    if ! compose up -d --wait --wait-timeout 120 api; then
      echo "Rollback failed. Inspect the container logs on the VPS." >&2
    fi
  else
    echo "First release failed; stopping the unhealthy container." >&2
    compose stop api || true
  fi
  exit 1
fi

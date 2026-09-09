#!/usr/bin/env bash
set -euo pipefail

readonly STUB_IMAGE='busybox@sha256:73aaf090f3d85aa34ee199857f03fa3a95c8ede2ffd4cc2cdb5b94e566b11662'
readonly READY_ATTEMPTS=30

usage() {
  echo 'Usage: tools/ci/container-smoke.sh --image <image-ref> --mode <success|invalid-config>' >&2
  exit 2
}

image=''
mode=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --image) image="${2:-}"; shift 2 ;;
    --mode) mode="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done
[[ -n "$image" && ( "$mode" == success || "$mode" == invalid-config ) ]] || usage

run_id="${GITHUB_RUN_ID:-local}-${RANDOM}-${RANDOM}"
network="gateway-smoke-${run_id}"
gateway="gateway-smoke-${run_id}"
downstream="gateway-smoke-downstream-${run_id}"
workdir="$(mktemp -d)"

cleanup() {
  docker rm --force "$gateway" "$downstream" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf "$workdir"
}
trap cleanup EXIT

diagnostics() {
  echo 'Gateway smoke diagnostics (last 100 container log lines):' >&2
  docker logs --tail 100 "$gateway" 2>&1 | sed -E 's/(Password|Token|Secret|Dsn)=?[^[:space:]]*/\1=[REDACTED]/gi' >&2 || true
}

if [[ "$mode" == invalid-config ]]; then
  container_id="$(docker run -d --name "$gateway" -e ASPNETCORE_ENVIRONMENT=Smoke "$image")"
  for _ in $(seq 1 10); do
    if ! docker inspect --format '{{.State.Running}}' "$container_id" | grep -qx true; then
      echo 'Invalid production TLS configuration was rejected as expected.'
      exit 0
    fi
    sleep 1
  done
  diagnostics
  echo 'Invalid production TLS configuration unexpectedly started.' >&2
  exit 1
fi

openssl req -x509 -newkey rsa:2048 -nodes -keyout "$workdir/key.pem" -out "$workdir/cert.pem" -days 1 -subj '/CN=localhost' >/dev/null 2>&1
openssl pkcs12 -export -out "$workdir/gateway-smoke.pfx" -inkey "$workdir/key.pem" -in "$workdir/cert.pem" -passout pass:gateway-smoke >/dev/null 2>&1

docker network create "$network" >/dev/null
docker run -d --name "$downstream" --network "$network" --network-alias homebudget-rates-api "$STUB_IMAGE" \
  sh -c 'mkdir -p /www && printf "gateway-smoke-response\n" > /www/smoke && exec httpd -f -p 80 -h /www' >/dev/null

docker run -d --name "$gateway" --network "$network" \
  -p 127.0.0.1::8080 -p 127.0.0.1::8443 \
  -v "$workdir:/certs:ro" \
  -e ASPNETCORE_ENVIRONMENT=Smoke \
  -e SslOptions__HttpPort=8080 \
  -e SslOptions__HttpsPort=8443 \
  -e SslOptions__CertificatePath=/certs \
  -e SslOptions__CertificateName=gateway-smoke.pfx \
  -e SslOptions__Password=gateway-smoke \
  -e ObservabilityOptions__TelemetryEndpoint= \
  -e ObservabilityOptions__LogsEndpoint= \
  -e ElasticSearchOptions__IsEnabled=false \
  -e ElasticApm__ServerUrls= \
  -e SeqOptions__IsEnabled=false \
  -e Sentry__Dsn= \
  "$image" >/dev/null

http_port="$(docker port "$gateway" 8080/tcp | awk -F: 'NR == 1 { print $NF }')"
https_port="$(docker port "$gateway" 8443/tcp | awk -F: 'NR == 1 { print $NF }')"
[[ -n "$http_port" && -n "$https_port" ]] || { diagnostics; exit 1; }

for _ in $(seq 1 "$READY_ATTEMPTS"); do
  if curl --silent --show-error --fail --max-time 2 "http://127.0.0.1:${http_port}/health" >/dev/null; then
    break
  fi
  sleep 1
done
curl --silent --show-error --fail --max-time 5 "http://127.0.0.1:${http_port}/health" >/dev/null || { diagnostics; exit 1; }

response="$(curl --silent --show-error --fail --insecure --max-time 5 "https://127.0.0.1:${https_port}/gateway/smoke")"
[[ "$response" == 'gateway-smoke-response' ]] || { diagnostics; echo 'Forwarded smoke response did not match.' >&2; exit 1; }
echo 'Gateway container smoke passed: startup, HTTP health, HTTPS, and an Ocelot-forwarded response were verified.'

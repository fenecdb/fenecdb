#!/bin/sh
# fennec-server for Kestrel: a tenant node (a file per site in data/tenants),
# the node's own token, JWTs checked against policy.txt and bound to their
# tenant, the change stream kept for the rollup worker, and an audit log.
#
#   FENNEC_SERVER  the binary (default: this repository's target/release, then target/debug)
#   FENNEC_PORT    8080; 0 takes a port the system picks, which the server's
#                  `listening on: http://<address>` line names
#   FENNEC_DIR     data/tenants
#   FENNEC_SYNC    250: a write is on disk within 250 ms. Events are
#                  counted, not money; `always` costs ingest an fsync a batch
#   FENNEC_TOKEN, FENNEC_ADMIN_TOKEN, FENNEC_JWT_SECRET   as src/config.ts reads them
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
root=$(cd "$here/../.." && pwd)
server=${FENNEC_SERVER:-}
if [ -z "$server" ]; then
    for b in "$root/target/release/fennec-server" "$root/target/debug/fennec-server"; do
        if [ -x "$b" ]; then server=$b; break; fi
    done
fi
[ -n "$server" ] || { echo "no fennec-server: cargo build --release -p fennec-server, or set FENNEC_SERVER" >&2; exit 1; }
dir=${FENNEC_DIR:-$here/data/tenants}
mkdir -p "$dir"
umask 077
secret="$dir/../jwt.secret"
printf '%s' "${FENNEC_JWT_SECRET:-kestrel-dev-jwt-secret-of-at-least-32-bytes}" >"$secret"
# --replication-token keeps each tenant's change stream (/t/<site>/_changes)
# for the rollup worker; no replica need follow it. --replication-buffer is
# how far behind the worker may fall before it rebuilds from the raw events.
# --warm builds a site's indexes as it opens rather than in the first
# dashboard request after a restart.
FENNEC_HTTP_TOKEN=${FENNEC_TOKEN:-kestrel-dev-operator} exec "$server" \
    --dir "$dir" \
    --http "127.0.0.1:${FENNEC_PORT:-8080}" \
    --admin-token "${FENNEC_ADMIN_TOKEN:-kestrel-dev-node-admin}" \
    --replication-token "${FENNEC_REPLICATION_TOKEN:-kestrel-dev-replication}" \
    --replication-buffer "${FENNEC_REPLICATION_BUFFER:-256}" \
    --jwt-secret-file "$secret" \
    --policy "$here/policy.txt" \
    --audit "${FENNEC_AUDIT:-$dir/../audit.log}" \
    --warm all \
    --sync "${FENNEC_SYNC:-250}"

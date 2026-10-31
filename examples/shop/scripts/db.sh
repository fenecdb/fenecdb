#!/bin/sh
# fennec-server for the shop: the file in data/, the shop's token, shoppers'
# tokens checked against policy.txt, and the browser's live stock let in
# from the site's origin. Every index is built after the open, beside the
# first requests (`--warm`, the default for a file, written out here): the
# first search page after a start took 2.68 s to its largest paint while
# its text index was built inside it, against 1.40 s warm.
#
#   FENNEC_SERVER  the binary (default: this repository's target/release, then target/debug)
#   FENNEC_PORT    8080; 0 takes a port the system picks, which the server's
#                  `listening on: http://<address>` line names
#   FENNEC_FILE    data/shop.fennec
#   FENNEC_TOKEN, FENNEC_JWT_SECRET, SITE_URL   as lib/db.ts and lib/jwt.ts read them
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
mkdir -p "$here/data"
umask 077
printf '%s' "${FENNEC_JWT_SECRET:-shop-dev-jwt-secret-of-at-least-32-bytes!}" >"$here/data/jwt.secret"
FENNEC_HTTP_TOKEN=${FENNEC_TOKEN:-shop-dev-token} exec "$server" \
    --file "${FENNEC_FILE:-$here/data/shop.fennec}" \
    --http "127.0.0.1:${FENNEC_PORT:-8080}" \
    --jwt-secret-file "$here/data/jwt.secret" \
    --policy "$here/policy.txt" \
    --http-cors "${SITE_URL:-http://localhost:3000}" \
    --sync "${FENNEC_SYNC:-250}" \
    --warm "${FENNEC_WARM:-all}"

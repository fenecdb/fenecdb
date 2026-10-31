#!/bin/sh
# FennecDb's tests against fennec-server processes they start themselves,
# with the .NET on the machine -- any SDK from 8 up, the tests rolling
# forward to the runtime it has -- or, without one, from the
# mcr.microsoft.com/dotnet/sdk:8.0 image. The image runs a Linux binary
# alone, so there the server is built on a Linux machine; macOS needs the
# .NET SDK installed.
#
#   integrations/dotnet/run-tests.sh [dotnet test arguments]
set -eu
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
cargo=${CARGO:-cargo}
[ -x "$HOME/.cargo/bin/cargo" ] && cargo="$HOME/.cargo/bin/cargo"
"$cargo" build -q -p fennec-server --manifest-path "$root/Cargo.toml"

if command -v dotnet >/dev/null 2>&1; then
    cd "$here" && exec dotnet test FennecDb.Tests --nologo "$@"
fi
if [ "$(uname -s)" != Linux ]; then
    echo "dotnet not found, and the sdk:8.0 image runs no $(uname -s) binary: install the .NET SDK" >&2
    exit 1
fi
# The tests start servers on loopback ports of their own: the host's
# network. The source is copied inside, so bin/ and obj/ stay there, and
# the builder's golden file, outside it, goes in beside it.
exec docker run --rm --network host -v "$here:/src:ro" -v "$root/target/debug/fennec-server:/fennec-server:ro" \
    -v "$root/integrations/builder-golden.json:/golden.json:ro" -e FENNEC_GOLDEN=/golden.json \
    -e FENNEC_SERVER=/fennec-server mcr.microsoft.com/dotnet/sdk:8.0 sh -c \
    "cp -r /src /work && cd /work && dotnet test FennecDb.Tests --nologo $*"

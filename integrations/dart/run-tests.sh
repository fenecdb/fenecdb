#!/bin/sh
# The Dart package's tests (`make dart-test`): the native library built for
# this machine, and the fennec-server and fennec-shard the sync and
# read-routing tests start, then `dart test` against them -- the engine, the
# builder over every golden case, live queries as Streams, a replica against
# a real server, reads near a tenant's read replica -- and, where Flutter is
# installed, the Flutter plugin's own test the same way.
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CARGO=${CARGO:-$(test -x "$HOME/.cargo/bin/cargo" && echo "$HOME/.cargo/bin/cargo" || echo cargo)}
(cd "$ROOT" && "$CARGO" rustc -q -p fennec-ffi --lib --profile ffi --crate-type cdylib)
# The server the sync tests start, kill and start again, and the routers
# the read-routing tests put in front of it.
(cd "$ROOT" && "$CARGO" build -q -p fennec-server -p fennec-shard)
case "$(uname)" in
  Darwin) LIB="$ROOT/target/ffi/libfennec_ffi.dylib" ;;
  *) LIB="$ROOT/target/ffi/libfennec_ffi.so" ;;
esac
export FENNEC_LIBRARY="$LIB"
export FENNEC_SERVER="$ROOT/target/debug/fennec-server"
export FENNEC_SHARD="$ROOT/target/debug/fennec-shard"
export FENNEC_GOLDEN="$ROOT/integrations/builder-golden.json"

cd "$ROOT/integrations/dart/fennecdb"
dart pub get >/dev/null
dart format --output=none --set-exit-if-changed .
dart analyze --fatal-infos
dart test "$@"

if command -v flutter >/dev/null 2>&1; then
  cd "$ROOT/integrations/dart/fennecdb_flutter"
  flutter pub get >/dev/null
  flutter analyze lib test
  flutter test
else
  echo "flutter not found: the Flutter plugin (integrations/dart/fennecdb_flutter) not tested"
fi

# fennecdb for Flutter

The `fennecdb` package in a Flutter app, with its native library bundled:
`FennecFFI.framework`, a dynamic framework, on iOS and macOS (the release's
a dynamic `FennecFFI.xcframework`), `libfennec_ffi.so` for arm64-v8a,
armeabi-v7a and x86_64 on Android.

```dart
import 'package:fennecdb_flutter/fennecdb_flutter.dart';
import 'package:path_provider/path_provider.dart';

final dir = await getApplicationDocumentsDirectory();
final db = await Fennec.open('${dir.path}/app.fennec');

StreamBuilder(
  stream: db.live(db.from('todos').where('done', false)),
  builder: (context, snap) => ListView(children: [
    for (final t in snap.data ?? const []) Text(t['title'] as String),
  ]),
);
```

`example/` is a todo list over a live query. In the repository,
`prepare.sh` copies the libraries in from the Swift and Kotlin builds
(`integrations/swift/build-xcframework.sh`, `integrations/kotlin/build-aar.sh`).

# Homebrew tap for fennecdb

```bash
brew install fennec-db/tap/fennecdb
```

This installs `fennec`, the shell, and `fennec-server`, the HTTP server, from
the [fennecdb](https://github.com/fennec-db/fennecdb) release for your Mac
(Apple silicon or Intel) or Linux machine (arm64 or x86_64). They are the
release's own binaries, static and checked against the SHA-256 the formula
names; nothing is built on your machine.

```bash
fennec notes.fennec                            # the shell on a file of its own
FENNEC_HTTP_TOKEN=secret fennec-server --file data.fennec   # the server
brew upgrade fennecdb                          # a new release
brew uninstall fennecdb
```

A first query, step by step: [fenecdb.com/docs/quickstart](https://fenecdb.com/docs/quickstart).

## How this repository is kept

`Formula/fennecdb.rb` is not edited here. Each time a release of
`fennec-db/fennecdb` is published, its `packages.yml` runs
`tools/homebrew-formula.py` on the release's `SHA256SUMS` and pushes the
result to this repository's `main`, so the version and the four checksums
are always the release's own. Pre-releases are not offered.

To write it by hand, from a clone of `fennec-db/fennecdb`:

```bash
gh release download vX.Y.Z -R fennec-db/fennecdb -p SHA256SUMS
python3 tools/homebrew-formula.py --version X.Y.Z --sums SHA256SUMS -o ../homebrew-tap/Formula/fennecdb.rb
```

Problems with fennecdb itself belong in
[fennec-db/fennecdb](https://github.com/fennec-db/fennecdb/issues).

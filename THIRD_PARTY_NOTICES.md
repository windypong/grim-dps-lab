# Third-party notices

The application code is an independent implementation. It is not affiliated with Crate Entertainment, GrimTools, or DPYes. No game artwork, game archives, font binaries, or proprietary application code is bundled.

The first-run downloader retrieves public structured game data and translations from the `tednaleid/grimdawn-devotions` GitHub repository's deposit release. Data provenance and schema: https://github.com/tednaleid/grimdawn-devotions . Grim Dawn game data and translations remain the property of their respective copyright holders, including Crate Entertainment. The app's license does not relicense third-party data.

The Windows launcher obtains a portable Python binary from python.org (Python Software Foundation License) and DuckDB 1.4.1 from PyPI (MIT License). Their distributions carry their original licenses. They are downloaded at runtime, not bundled in this archive. The DuckDB wheel's SHA-256 is pinned; data files are verified against the public release manifest.

The original DPS engine is an analytical model informed by the official combat guide and cited public mechanical experiments. DPYes logs are interpreted through explicit user-selected field mappings. No claim is made to reproduce DPYes internal timing or Grim Dawn's full simulation.

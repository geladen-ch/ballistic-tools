fflate v0.8.3
https://github.com/101arrowz/fflate

Vendored locally (not loaded from a CDN) so the app has no runtime
dependency on a third-party host. Unmodified upstream ESM build
(`esm/browser.js` from the npm package — a build artifact, not checked
into fflate's own git repo, so fetched from the published npm tarball
directly) — self-contained, zero `import` statements, bundles its own
pure-JS inflate/deflate rather than depending on any browser API. Used by
the Labradar tool (src/labradar/zip-batch.js) to read the `.zip` a
Labradar chronograph exports — `unzipSync`/`zipSync`/`strFromU8`.

License: MIT (see LICENSE in this directory) — permissive and
GPL-compatible.

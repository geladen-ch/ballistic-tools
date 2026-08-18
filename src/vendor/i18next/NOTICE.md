i18next v26.3.6
https://www.i18next.com/

Vendored locally (not loaded from a CDN) so the app has no runtime
dependency on a third-party host. Unmodified upstream ESM build
(`dist/esm/i18next.js` from the npm package) — the core library only, no
backend/detector plugins. This app fetches its own locale JSON files
(src/locales/*.json) and hands them to `i18next.init({ resources })`
directly (see src/i18n.js), so no i18next-http-backend plugin is needed.

License: MIT (see LICENSE in this directory) — permissive and
GPL-compatible.

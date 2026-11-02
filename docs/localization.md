# Website localization

The site chooses the first supported language in `navigator.languages`, including regional variants such as `fr-CA`. It falls back to English and responds to the browser's `languagechange` event. Arabic, Hebrew, and Persian use right-to-left layout.

`src/locales/en.json` is the source-message inventory. Each supported language has a matching static JSON catalog, loaded only when needed. Existing translation dictionaries are retained where available; additional entries were machine translated and have not had a native-speaker review. Visitors make no calls to a translation provider.

The JSX runtime localizes rendered interface text and accessibility attributes without changing routing identifiers, option values, input values, or API payloads. Code blocks, editable content, and elements marked `translate="no"` are excluded. A nested `translate="yes"` allows interface controls within excluded content to be translated.

To update catalogs:

```sh
node scripts/extract-locales.mjs
python3 scripts/generate-locales.py
node scripts/preserve-reviewed-locales.mjs
node scripts/check-locales.mjs
node scripts/test-localization.mjs
npm run build
```

Catalog generation uses Google's translation endpoint from the developer machine and only sends source strings collected from the public website source. Keep user content and secrets out of catalogs. It preserves interpolation variables and checks for missing entries. `scripts/localization-additions.json` records display fragments found during browser checks that need an explicit inventory entry.

`check-locales.mjs` checks coverage and interpolation variables for every supported language. `test-localization.mjs` verifies regional language selection, translated option labels with stable values, placeholders, dynamic text, preserved user text/code, and RTL metadata. Browser checks should additionally cover routes, mobile navigation, and theme persistence.

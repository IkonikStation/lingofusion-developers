import fs from 'node:fs';
import assert from 'node:assert/strict';
const english = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const languages = ['ar','hy','zh','nl','fr','de','kl','he','hi','it','ja','ko','fa','pl','pt','ru','es','tr','uk'];
const variables = (text) => [...text.matchAll(/__VAR_\d+__/g)].map((m) => m[0]).sort();
let failures = 0;
for (const language of languages) {
  const catalog = JSON.parse(fs.readFileSync(`src/locales/${language}.json`, 'utf8'));
  const missing = Object.keys(english).filter((key) => !catalog[key]?.trim());
  const invalid = Object.keys(english).filter((key) => {
    if (!catalog[key]) return false;
    try { assert.deepEqual(variables(catalog[key]), variables(key)); return /ZXQ\d+QXZ|^[\[［【]\s*[\d０-９٠-٩]{3,4}[\]］】]/u.test(catalog[key]); }
    catch { return true; }
  });
  console.log(`${language}: ${Object.keys(english).length - missing.length}/${Object.keys(english).length}; ${invalid.length} invalid placeholders`);
  if (missing.length || invalid.length) { failures++; console.error({ language, missing: missing.slice(0, 8), invalid: invalid.slice(0, 8) }); }
}
assert.equal(failures, 0, 'Every supported language must have a nonempty translation with matching interpolation variables.');

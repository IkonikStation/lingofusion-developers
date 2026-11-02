import fs from 'node:fs';
import ts from 'typescript-compiler';
const english = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const source = fs.readFileSync('src/data/i18n.ts', 'utf8');
const ast = ts.createSourceFile('i18n.ts', source, ts.ScriptTarget.Latest, true);
const dictionaries = {};
function walk(node) {
 if (ts.isVariableDeclaration(node) && ['en','overrides','contentTranslations','contentGlossary','resetTranslations'].includes(node.name.getText(ast))) {
   const expression = ts.transpileModule(`(${node.initializer.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
   dictionaries[node.name.getText(ast)] = Function(`return ${expression}`)();
 }
 ts.forEachChild(node,walk);
}
walk(ast);
for (const language of Object.keys(dictionaries.overrides)) {
 const file = `src/locales/${language}.json`;
 if (!fs.existsSync(file)) continue;
 const catalog = JSON.parse(fs.readFileSync(file,'utf8'));
 for (const name of ['contentTranslations','contentGlossary','resetTranslations']) Object.assign(catalog,dictionaries[name]?.[language] ?? {});
 for (const [key, value] of Object.entries(dictionaries.overrides[language])) catalog[dictionaries.en[key]] = value;
 for (const [key, value] of Object.entries(catalog)) {
   if (english[key + ':']) catalog[key + ':'] = value + ':';
 }
 const output = Object.fromEntries(Object.keys(english).map((key) => [key, catalog[key]?.replace(/^[\[［【]\s*[\d０-９٠-٩]{1,4}\s*[\]］】]\s*/u, "")]));
 fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n');
}

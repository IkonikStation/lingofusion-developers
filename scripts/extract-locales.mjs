import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require(process.env.LOCALIZATION_TYPESCRIPT || 'typescript-compiler');
import fs from 'node:fs';
import path from 'node:path';
const entries = new Map();
function add(text, file) {
 text = text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(?:39|x27);/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
 if ((text.match(/(?:^|\s)(?:[a-z]+:)*(?:bg-|text-|font-|border-|rounded-|px-|py-|mx-|my-|mt-|mb-|pt-|pb-|divide-|grid-|p-\d|m-\d|gap-|space-|items-|justify-|max-w-|min-w-|w-\d|h-\d)/g) ?? []).length >= 2) return;
 const prose = text.replace(/__VAR_\d+__/g, '');
 if (text.startsWith('data:') || text.startsWith('Bearer ') || text.startsWith('sk_') || text.startsWith('lf_')) return;
 if (!/[a-zA-Z]{2}/.test(prose) || /\b(?:flex|shrink|rounded|items|justify|relative|absolute|overflow|pointer-events)\b/.test(text) || text.includes('TASK:')) return;
 if (!/[a-zA-Z]{2}/.test(text) || text.length > 1500 || /[{}=<>]|(?:https?:\/\/)|(?:\b(?:const|import|export)\b)|(?:[a-z]+-[a-z]+-[a-z]+)|(?:^\.?\.?\/)|(?:^#[\da-f]+$)/.test(text)) return;

 if (/^[\w./:@-]+$/.test(text) && /[./@]/.test(text)) return;
 if (/^(?:LingoFusion|ExplainFusion|GPT|Claude|Gemini|DeepSeek|Qwen|Mistral|Native-|API$|USD$|JSON$|HTML$|CSS$|JavaScript$|Python$|TypeScript$)/.test(text) && text.split(' ').length < 4) return;
 entries.set(text, [...new Set([...(entries.get(text) ?? []), file])]);
}
function visitDir(dir) {
 for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
 const file=path.join(dir,item.name);
 if(item.isDirectory()) { if(item.name!=='locales') visitDir(file); continue; }
 if(!/\.tsx?$/.test(file) || file.endsWith('i18n.ts')) continue;
 const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 function walk(n) {
 if(ts.isJsxAttribute(n) && ['className','class','id','key','value','type','name','href','src','translate','role','target','rel','htmlFor','data-testid','aria-controls','aria-labelledby','aria-describedby'].includes(n.name.getText(ast))) return;
 if(ts.isJsxText(n)) add(n.text,file);
 if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)) {
 if(!ts.isImportDeclaration(n.parent)&&!(ts.isPropertyAssignment(n.parent)&&n.parent.name===n)&&!ts.isLiteralTypeNode(n.parent)) add(n.text,file);
 }
 if(ts.isTemplateExpression(n)) add(n.head.text+n.templateSpans.map((s,i)=>`__VAR_${i}__`+s.literal.text).join(''),file);
 ts.forEachChild(n,walk);
 } walk(ast);
 }
}
visitDir('src');
// Existing dictionary source text is part of the same complete catalog.
const source=fs.readFileSync('src/data/i18n.ts','utf8');
const ast=ts.createSourceFile('i18n.ts',source,ts.ScriptTarget.Latest,true);
function walk(n) {
 if (ts.isPropertyAssignment(n)) {
  let ancestor=n.parent;
  while(ancestor && !ts.isVariableDeclaration(ancestor)) ancestor=ancestor.parent;
  const name=ancestor?.name.getText(ast);
  if(name==='en' && ts.isStringLiteral(n.initializer)) add(n.initializer.text,'src/data/i18n.ts');
  if(['contentTranslations','contentGlossary','resetTranslations'].includes(name) && ts.isStringLiteral(n.name)) add(n.name.text,'src/data/i18n.ts');
 }
 ts.forEachChild(n,walk);
} walk(ast);
for (const text of JSON.parse(fs.readFileSync('scripts/localization-additions.json','utf8'))) entries.set(text, ['browser audit']);
const sorted=Object.fromEntries([...entries].sort((a,b)=>a[0].localeCompare(b[0])));
fs.writeFileSync('src/locales/en.json',JSON.stringify(Object.fromEntries(Object.keys(sorted).map(x=>[x,x])),null,2)+'\n');
fs.writeFileSync('outputs/localization-inventory.json',JSON.stringify(sorted,null,2)+'\n');
console.log(Object.keys(sorted).length+' interface messages, '+Object.keys(sorted).join('').length+' characters');

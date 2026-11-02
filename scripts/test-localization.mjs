import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
 const { loadLocale, translateText } = await server.ssrLoadModule('/src/locales/catalog.ts');
 const { LocaleContext } = await server.ssrLoadModule('/src/locales/context.tsx');
 const { jsx, Fragment } = await server.ssrLoadModule('/src/locales/jsx-runtime.ts');
 const { getDeviceLanguage, getLanguage } = await server.ssrLoadModule('/src/data/i18n.ts');
 await loadLocale('fr');
 const render = (element) => renderToStaticMarkup(createElement(LocaleContext.Provider, { value: 'fr' }, element));
 assert.ok(render(jsx(Fragment, { children: 'Home' })).includes(translateText('Home','fr')));
 const option = render(jsx('select', { children: jsx('option', { children: 'English' }) }));
 assert.match(option, /value="English"/);
 assert.match(option, /Anglais/);
 const input = render(jsx('input', { value: 'Home', readOnly: true, placeholder: 'Enter text here' }));
 assert.match(input, /value="Home"/);
 assert.ok(!input.includes('placeholder="Enter text here"'));
 assert.match(render(jsx('code', { children: 'Home' })), />Home</);
 assert.match(render(jsx('div', { translate: 'no', children: jsx('span', { children: 'Home' }) })), />Home</);
 assert.ok(render(jsx('div', { translate: 'no', children: jsx('button', { translate: 'yes', children: 'Copy' }) })).includes(translateText('Copy','fr')));
 assert.match(render(jsx('div', { contentEditable: true, suppressContentEditableWarning: true, children: 'Home' })), />Home</);
 const dynamic = translateText('Teams supports 2 to 999 seats with self-serve billing and flexible seat types.','fr');
 assert.ok(!dynamic.startsWith('Teams supports'));
 assert.ok(dynamic.includes('2') && dynamic.includes('999'));
 const descriptor = Object.getOwnPropertyDescriptor(globalThis,'navigator');
 for (const [languages, expected] of [[['fr-CA','en-US'],'fr'],[['xx-XX','de-AT'],'de'],[['xx-XX'],'en']]) {
   Object.defineProperty(globalThis,'navigator',{configurable:true,value:{languages,language:languages[0]}});
   assert.equal(getDeviceLanguage(),expected);
 }
 if(descriptor) Object.defineProperty(globalThis,'navigator',descriptor); else delete globalThis.navigator;
 for(const language of ['ar','he','fa']) assert.equal(getLanguage(language).dir,'rtl');
 console.log('Localization integration checks passed: locale matching, translated controls, stable values, interpolation, user content, code, and RTL metadata.');
} finally { await server.close(); }

import { createElement, useContext } from 'react';
import type { ElementType, ReactNode } from 'react';
import { jsx as reactJsx, jsxs as reactJsxs, Fragment } from 'react/jsx-runtime';
import { LocaleContext, UntranslatedContext } from './context';
import { translateText } from './catalog';
export { Fragment };
export type { JSX } from 'react/jsx-runtime';

type Props = Record<string, unknown> & { children?: ReactNode };
function LocalizedFragment({ children }: { children?: ReactNode }) {
  const language = useContext(LocaleContext);
  const skipped = useContext(UntranslatedContext);
  const translateChild = (child: ReactNode): ReactNode => typeof child === 'string'
    ? translateText(child, language) : Array.isArray(child) ? child.map(translateChild) : child;
  return createElement(Fragment, null, skipped ? children : translateChild(children));
}
function LocalizedElement({ tag, original }: { tag: string; original: Props }) {
  const language = useContext(LocaleContext);
  const parentSkipped = useContext(UntranslatedContext);
  const skip = (parentSkipped && original.translate !== 'yes') || original.translate === 'no' || ['pre', 'code', 'script', 'style', 'textarea', 'svg'].includes(tag) || Boolean(original.contentEditable);
  const props = { ...original };
  if ((!parentSkipped || original.translate === 'yes') && original.translate !== 'no') {
    for (const name of ['title', 'placeholder', 'aria-label', 'aria-description', 'aria-valuetext', 'alt']) {
      if (typeof props[name] === 'string') {
        const originalText = props[name] as string;
        const translated = translateText(originalText, language);
        props[name] = translated === originalText && originalText.includes(': ')
          ? originalText.split(': ').map((part) => translateText(part, language)).join(': ') : translated;
      }
    }
  }
  if (!skip) {
    const translateChild = (child: ReactNode): ReactNode => typeof child === 'string'
      ? translateText(child, language) : Array.isArray(child) ? child.map(translateChild) : child;
    props.children = translateChild(original.children);
    // An option's implicit value must stay stable when its display label changes.
    if (tag === 'option' && original.value === undefined && typeof original.children === 'string') props.value = original.children;
  }
  const element = createElement(tag, props);
  return skip !== parentSkipped ? createElement(UntranslatedContext.Provider, { value: skip }, element) : element;
}
function wrap(factory: typeof reactJsx) {
  return (type: ElementType, props: Props, key?: string) => typeof type === 'string'
    ? factory(LocalizedElement, { tag: type, original: props }, key)
    : type === Fragment ? factory(LocalizedFragment, props, key) : factory(type, props, key);
}
export const jsx = wrap(reactJsx);
export const jsxs = wrap(reactJsxs);

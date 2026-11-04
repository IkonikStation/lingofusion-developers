import { Tiktoken } from 'js-tiktoken/lite';
import ranks from 'js-tiktoken/ranks/o200k_base';
import { prepareTextRequest as prepare } from './textRequestCore.mjs';
export { verifyAndPrice } from './textRequestCore.mjs';
let encoder;
const count = text => (encoder ||= new Tiktoken(ranks)).encode(text, [], []).length;
export const prepareTextRequest = body => prepare(body, count, true);

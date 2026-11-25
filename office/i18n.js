// Chinese / English switch for the whole page. The interface is written in Traditional Chinese; English comes from
// a dictionary keyed by the original text (office/i18n-en.js), so code keeps writing Chinese and the page is
// translated as it renders. A MutationObserver translates text and labels the app adds later, and remembers each
// original so switching back restores it. People's own messages, model replies and task titles are never touched.
import { dictionary } from './i18n-en.js';

const STORE = 'goose-office:lang';
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
// Content written by people or models: left exactly as written.
const SKIP = '[data-i18n-skip], .markdown, .msg-content, .thread-text strong, .message-references, .message-attachments, .knowledge-card h3, ' +
  '.knowledge-body, .board-result, .board-error, .reference-result, .chat-title, textarea, script, style, code, pre';
// CJK characters plus fullwidth punctuation, so "預設：…" and ".env：…" count as translatable text.
const cjk = /[㐀-鿿！-～]/;

const exact = new Map(), patterns = [];
for (const [zh, en] of Object.entries(dictionary)) {
  if (!zh.includes('{}')) { exact.set(zh, en); continue; }
  const parts = zh.split('{}').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  patterns.push({ re: new RegExp('^' + parts.join('(.+?)') + '$', 's'), en, fixed: zh.length });
}
// Most specific first, so "送給 {} · 最愛…" wins over "送給 {}".
patterns.sort((a, b) => b.fixed - a.fixed);
// Known phrases inside longer text (labels joined with numbers or names), longest first.
// Single characters stay out of this pass so they can't break up other words.
const phrases = [...exact.keys()].filter(key => key.length >= 2 && cjk.test(key)).sort((a, b) => b.length - a.length);
const phraseRe = phrases.length ? new RegExp(phrases.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g') : null;

function whole(text) {
  if (exact.has(text)) return exact.get(text);
  for (const { re, en } of patterns) {
    const m = text.match(re);
    if (m) return en.replace(/\{(\d)\}/g, (_, i) => whole(m[+i + 1]) ?? m[+i + 1]);
  }
  return null;
}

let lang = 'zh';
try { const saved = localStorage.getItem(STORE); lang = saved === 'en' || saved === 'zh' ? saved : null; } catch { lang = null; }
lang ??= (navigator.languages?.[0] || navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';

// Translate one string from Chinese. Returns it unchanged in Chinese mode or when nothing matches.
export function tr(text) {
  if (lang === 'zh' || typeof text !== 'string' || !cjk.test(text)) return text;
  const lead = text.match(/^\s*/)[0], tail = text.match(/\s*$/)[0], core = text.trim();
  const found = whole(core);
  if (found != null) return lead + found + tail;
  return phraseRe ? text.replace(phraseRe, phrase => exact.get(phrase)) : text;
}
export const currentLang = () => lang;

const originals = new WeakMap(), outputs = new WeakMap();
const skipped = node => {
  const element = node.nodeType === 1 ? node : node.parentElement;
  return !element || Boolean(element.closest(SKIP)) || element.isContentEditable;
};
function translateText(node) {
  if (skipped(node)) return;
  const value = node.nodeValue;
  if (outputs.get(node) !== value) originals.set(node, value); // The app wrote new text since we last looked.
  const next = tr(originals.get(node));
  outputs.set(node, next);
  if (next !== value) node.nodeValue = next;
}
function translateAttrs(element) {
  if (element.closest?.('[data-i18n-skip]')) return;
  let saved = originals.get(element), shown = outputs.get(element);
  for (const name of ATTRS) {
    if (!element.hasAttribute(name)) continue;
    const value = element.getAttribute(name);
    if (!saved) { saved = {}; shown = {}; originals.set(element, saved); outputs.set(element, shown); }
    if (shown[name] !== value) saved[name] = value;
    const next = tr(saved[name]);
    shown[name] = next;
    if (next !== value) element.setAttribute(name, next);
  }
}
function translateTree(root) {
  if (root.nodeType === 3) return translateText(root);
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  if (root.nodeType === 1) translateAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === 3) { if (node.nodeValue.trim()) translateText(node); }
    else translateAttrs(node);
  }
}

let docTitle = document.title, docDescription = document.querySelector('meta[name="description"]')?.content;
function applyDocument() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
  document.title = tr(docTitle);
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = tr(docDescription);
}

const observer = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'characterData') translateText(record.target);
    else if (record.type === 'attributes') translateAttrs(record.target);
    else for (const node of record.addedNodes) translateTree(node);
  }
});
observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
translateTree(document.body);
applyDocument();

const listeners = new Set();
export function onLangChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setLang(next) {
  if (next !== 'zh' && next !== 'en' || next === lang) return;
  lang = next;
  try { localStorage.setItem(STORE, lang); } catch { /* Storage can be disabled. */ }
  translateTree(document.body);
  applyDocument();
  for (const fn of listeners) fn(lang);
}

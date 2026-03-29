/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.sw = g.__NOTETAKR__.sw || {};

  const ns = g.__NOTETAKR__.sw;
  const C = g.__NOTETAKR__?.constants || {};

  ns.NOTES_DRAFT_KEY = String(C.NOTES_DRAFT_KEY || "notes_draft_v1");
})();


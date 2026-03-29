/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.clipper = g.__NOTETAKR__.clipper || {};

  const ns = g.__NOTETAKR__.clipper;

  ns.state = {
    BTN_ID: "srNotesClipBtn",
    lastSelectionText: "",
    hideT: null,
    btn: null
  };
})();


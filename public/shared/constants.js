/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};

  // Shared constants across service worker, side panel, and content scripts.
  g.__NOTETAKR__.constants = Object.freeze({
    NOTES_DRAFT_KEY: "notes_draft_v1",
    LINE_LINKS_START: "--- SEARCHREVISION_LINE_LINKS ---",
    LINE_LINKS_END: "--- /SEARCHREVISION_LINE_LINKS ---"
  });
})();


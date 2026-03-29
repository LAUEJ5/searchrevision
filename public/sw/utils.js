/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.sw = g.__NOTETAKR__.sw || {};

  const ns = g.__NOTETAKR__.sw;

  ns.nowIso = function nowIso() {
    return new Date().toISOString();
  };

  ns.parseJsonBody = function parseJsonBody(body) {
    if (!body) return {};
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  };

  ns.storageGet = function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  };

  ns.storageSet = function storageSet(obj) {
    return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
  };
})();


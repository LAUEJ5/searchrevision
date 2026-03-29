/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.panel = g.__NOTETAKR__.panel || {};
  const ns = g.__NOTETAKR__.panel;

  ns.apiFetch = function apiFetch(url, init) {
    const method = String(init?.method || "GET").toUpperCase();
    const headers = init?.headers || {};
    const body = typeof init?.body === "string" ? init.body : init?.body ? String(init.body) : null;
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "apiFetch", url: String(url || ""), method, headers, body }, (resp) => {
        const ok = Boolean(resp?.ok);
        const status = Number(resp?.status || (ok ? 200 : 500));
        const json = resp?.json ?? {};
        resolve({
          ok,
          status,
          async json() {
            return json;
          }
        });
      });
    });
  };
})();


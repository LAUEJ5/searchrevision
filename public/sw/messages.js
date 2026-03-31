/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.sw = g.__NOTETAKR__.sw || {};

  const ns = g.__NOTETAKR__.sw;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;

    if (msg.type === "apiFetch") {
      (async () => {
        try {
          const resp = await ns.handleApi({
            url: String(msg.url || ""),
            method: String(msg.method || "GET").toUpperCase(),
            headers: msg.headers || {},
            body: msg.body || null
          });
          sendResponse(resp);
        } catch (e) {
          sendResponse({
            ok: false,
            status: 500,
            json: { error: "Unexpected error", details: { message: String(e?.message || e) } }
          });
        }
      })();
      return true;
    }

    if (msg.type === "appendSelectionToNotes") {
      (async () => ns.appendSelectionToNotes(msg, sender, sendResponse))();
      return true;
    }

    if (msg.type === "openSidePanel") {
      (async () => {
        await ns.openSidePanelForSender(sender);
        sendResponse?.({ ok: true });
      })();
      return true;
    }

    if (msg.type === "getActiveContext") {
      (async () => ns.getActiveContext(sendResponse))();
      return true;
    }

    if (msg.type === "openContext") {
      (async () => ns.openContext(msg, sendResponse))();
      return true;
    }

    if (msg.type === "openGoogleSearch") {
      (async () => ns.openGoogleSearch(msg, sendResponse))();
      return true;
    }

    if (msg.type === "openUrl") {
      (async () => ns.openUrl(msg, sendResponse))();
      return true;
    }

    if (msg.type === "downloadNotesTxt") {
      (async () => ns.downloadNotesTxt(msg, sendResponse))();
      return true;
    }
  });
})();


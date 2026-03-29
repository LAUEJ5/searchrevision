/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.clipper = g.__NOTETAKR__.clipper || {};

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "srGetScroll") {
      sendResponse({ ok: true, url: String(window.location.href || ""), scrollY: Number(window.scrollY || 0) });
      return;
    }
    if (msg.type === "srScrollTo") {
      const y = Number(msg.scrollY || 0);
      const doScroll = () => {
        try {
          window.scrollTo({ top: y, left: 0, behavior: "auto" });
        } catch {
          window.scrollTo(0, y);
        }
      };
      doScroll();
      setTimeout(doScroll, 250);
      setTimeout(doScroll, 900);
      sendResponse?.({ ok: true });
    }
  });
})();


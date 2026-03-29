/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.sw = g.__NOTETAKR__.sw || {};

  const ns = g.__NOTETAKR__.sw;

  ns.openSidePanelForSender = async function openSidePanelForSender(sender) {
    try {
      const tabId = Number(sender?.tab?.id);
      if (!tabId) return;
      chrome.sidePanel?.setOptions?.({ tabId, path: "panel.html", enabled: true }, () => {});
      chrome.sidePanel?.open?.({ tabId }, () => {});
    } catch {
      // ignore
    }
  };

  ns.getActiveContext = async function getActiveContext(sendResponse) {
    try {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const err = chrome.runtime.lastError;
        if (err) return sendResponse({ ok: false, error: String(err.message || err) });
        const tab = Array.isArray(tabs) ? tabs[0] : null;
        const tabId = tab?.id;
        const url = String(tab?.url || "");
        if (!tabId) return sendResponse({ ok: true, url, scrollY: 0 });

        chrome.tabs.sendMessage(tabId, { type: "srGetScroll" }, (resp) => {
          const msgErr = chrome.runtime.lastError;
          if (msgErr || !resp?.ok) return sendResponse({ ok: true, url, scrollY: 0 });
          sendResponse({ ok: true, url: String(resp.url || url), scrollY: Number(resp.scrollY || 0) });
        });
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  };

  ns.openContext = async function openContext(msg, sendResponse) {
    try {
      const url = String(msg.url || "").trim();
      const scrollY = Number(msg.scrollY || 0);
      if (!url) return sendResponse({ ok: false, error: "Missing url" });

      chrome.tabs.create({ url }, (created) => {
        const err = chrome.runtime.lastError;
        if (err) return sendResponse({ ok: false, error: String(err.message || err) });
        const tabId = created?.id;
        if (!tabId) return sendResponse({ ok: true });

        const tryScroll = (attempt = 1) => {
          chrome.tabs.sendMessage(tabId, { type: "srScrollTo", scrollY }, () => {
            const msgErr = chrome.runtime.lastError;
            if (!msgErr) return;
            if (attempt < 6) setTimeout(() => tryScroll(attempt + 1), 200 * attempt);
          });
        };

        const onUpdated = (updatedTabId, info) => {
          if (updatedTabId !== tabId) return;
          if (info.status !== "complete") return;
          chrome.tabs.onUpdated.removeListener(onUpdated);
          tryScroll(1);
        };
        chrome.tabs.onUpdated.addListener(onUpdated);

        sendResponse({ ok: true });
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  };

  ns.openGoogleSearch = async function openGoogleSearch(msg, sendResponse) {
    try {
      const q = String(msg.q || "").trim().replace(/\s+/g, " ");
      if (!q) return sendResponse({ ok: false, error: "Empty query" });
      const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const err = chrome.runtime.lastError;
        if (err) return sendResponse({ ok: false, error: String(err.message || err) });
        const tab = Array.isArray(tabs) ? tabs[0] : null;
        const tabId = tab?.id;
        if (!tabId) return sendResponse({ ok: false, error: "No active tab" });
        chrome.tabs.update(tabId, { url }, () => {
          const err2 = chrome.runtime.lastError;
          if (err2) return sendResponse({ ok: false, error: String(err2.message || err2) });
          sendResponse({ ok: true });
        });
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  };

  ns.downloadNotesTxt = async function downloadNotesTxt(msg, sendResponse) {
    try {
      const title = String(msg.title || "").trim();
      const text = String(msg.text || "");

      const safeBase =
        title
          .replace(/[\/\\:*?"<>|]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 120) || "notes";
      const filename = safeBase.toLowerCase().endsWith(".txt") ? safeBase : `${safeBase}.txt`;

      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      chrome.downloads.download(
        { url, filename, saveAs: true, conflictAction: "uniquify" },
        (downloadId) => {
          const err = chrome.runtime.lastError;
          setTimeout(() => URL.revokeObjectURL(url), 30_000);
          if (err) return sendResponse({ ok: false, error: String(err.message || err) });
          sendResponse({ ok: true, downloadId });
        }
      );
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  };

  // Optional fallback: older flow that appends via background messaging.
  ns.appendSelectionToNotes = async function appendSelectionToNotes(msg, sender, sendResponse) {
    try {
      const text = String(msg.text || "").replace(/\r\n/g, "\n").trim();
      const pageUrl = String(msg.pageUrl || "").trim();
      if (!text) return sendResponse({ ok: false });

      const cur = await ns.getDraft();
      const base = String(cur.text || "").replace(/\r\n/g, "\n").trimEnd();
      const nextText = base ? `${base}\n\n${text}` : text;

      const curLinks = Array.isArray(cur.lineLinks) ? cur.lineLinks.slice() : [];
      const baseLines = base ? base.split("\n") : [""];
      const textLines = text.split("\n");
      const insertStart = base ? baseLines.length + 1 : 0;
      const nextLinks = curLinks.slice();
      const totalLines = nextText.split("\n").length;
      while (nextLinks.length < totalLines) nextLinks.push(null);

      for (let i = 0; i < textLines.length; i++) {
        const line = String(textLines[i] || "").trim();
        if (!line) continue;
        if (pageUrl) nextLinks[insertStart + i] = { url: pageUrl, scrollY: 0, ts: Date.now() };
      }

      const next = { ...cur, text: nextText, lineLinks: nextLinks, updatedAt: ns.nowIso() };
      await ns.setDraft(next);

      try {
        chrome.runtime.sendMessage({ type: "srNotesDraftUpdated", draft: next }, () => {});
      } catch {
        // ignore
      }

      await ns.openSidePanelForSender(sender);
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  };
})();


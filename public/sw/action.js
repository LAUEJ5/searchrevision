/* global chrome */

(() => {
  chrome.action?.onClicked?.addListener((tab) => {
    const tabId = tab?.id;
    if (!tabId) return;
    try {
      chrome.sidePanel?.setOptions?.({ tabId, path: "panel.html", enabled: true }, () => {});
      chrome.sidePanel?.open?.({ tabId }, () => {});
    } catch {
      // ignore
    }
  });
})();


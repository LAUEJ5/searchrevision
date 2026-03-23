const hero = document.getElementById("hero");
const resultsWrap = document.getElementById("resultsWrap");

const searchForm = document.getElementById("searchForm");
const qInput = document.getElementById("q");

const searchFormTop = document.getElementById("searchFormTop");
const qTop = document.getElementById("qTop");

const metaEl = document.getElementById("meta");
const resultsEl = document.getElementById("results");
const articleEl = document.getElementById("article");
const articleTitleEl = document.getElementById("articleTitle");
const articleExternalEl = document.getElementById("articleExternal");
const articleFrameEl = document.getElementById("articleFrame");
const errorEl = document.getElementById("error");

const notesToggleBtn = document.getElementById("notesToggleBtn");
const notesCloseBtn = document.getElementById("notesCloseBtn");
const notesNewBtn = document.getElementById("notesNewBtn");
const notesSaveBtn = document.getElementById("notesSaveBtn");
const notesDocLabel = document.getElementById("notesDocLabel");
const notesTitleInput = document.getElementById("notesTitle");
const notesFolderInput = document.getElementById("notesFolder");
const notesClearBtn = document.getElementById("notesClearBtn");
const notesSavedBackBtn = document.getElementById("notesSavedBackBtn");
const notesSavedTitle = document.getElementById("notesSavedTitle");
const notesSavedList = document.getElementById("notesSavedList");
const notesPanel = document.getElementById("notesPanel");
const notesEditor = document.getElementById("notesEditor");
const selectionSearchBtn = document.getElementById("selectionSearchBtn");
let lastSelectionText = "";
let selectionPopupMode = null; // "selection" | "hover" | null
let isSelectionPopupHovered = false;
let hoverHideT = null;
let currentDraftId = null;
let currentDraftLoadedFromSaved = false;
let currentSavedNoteId = null;
let savedNotesView = { mode: "folders", folder: null };

function normalizeTitle(t) {
  const raw = String(t || "").trim().replace(/\s+/g, " ");
  return raw || "Untitled";
}

function normalizeFolder(f) {
  const raw = String(f || "").trim().replace(/\s+/g, " ");
  return raw || "Inbox";
}

function currentRouteHref() {
  return `${window.location.pathname || "/"}${window.location.search || ""}${window.location.hash || ""}`;
}

function shouldStampLineLink() {
  // Don't stamp when on the plain home screen ("/" with no ?q and not /wiki/...).
  const isWiki = Boolean(getWikiTitleFromPath());
  const q = getQueryFromUrl();
  const isHome = !isWiki && !q;
  return !isHome;
}

function setDraftMetaLabel({ savedTo } = {}) {
  const title = normalizeTitle(notesTitleInput?.value);
  const prefix = currentDraftLoadedFromSaved ? "Draft (loaded)" : "Draft";
  if (!notesDocLabel) return;
  notesDocLabel.textContent = savedTo ? `${prefix} — ${title} (saved to ${savedTo})` : `${prefix} — ${title}`;
}

function parseLineWithSrcComment(line) {
  const s = String(line || "");
  const m = s.match(/^(.*?)(?:\s*<!--\s*srclink:(.*?)\s*-->\s*)$/i);
  if (!m) return { text: s, srclink: null };
  const text = m[1] ?? "";
  const srclink = (m[2] ?? "").trim();
  return { text, srclink: srclink || null };
}

function createNotesLine({ text = "", srclink = null } = {}) {
  const line = document.createElement("div");
  line.className = "notesLine";
  if (srclink) line.dataset.srclink = srclink;

  const textEl = document.createElement("span");
  textEl.className = "notesLineText";
  textEl.setAttribute("contenteditable", "true");
  textEl.setAttribute("role", "textbox");
  textEl.setAttribute("aria-multiline", "false");
  textEl.spellcheck = true;
  textEl.textContent = String(text || "");

  const btn = document.createElement("button");
  btn.className = "notesLineLinkBtn";
  btn.type = "button";
  btn.setAttribute("contenteditable", "false");
  btn.title = "Go to page for this line";
  btn.hidden = !srclink;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const href = line.dataset.srclink;
    if (!href) return;
    // Internal routes should use SPA navigation; external URLs can use full navigation.
    if (href.startsWith("/")) navigateTo(href);
    else window.location.href = href;
  });

  line.appendChild(textEl);
  line.appendChild(btn);
  return line;
}

function clearLineSrcLink(lineEl) {
  if (!lineEl) return;
  delete lineEl.dataset.srclink;
  const btn = lineEl.querySelector?.(".notesLineLinkBtn");
  if (btn) btn.hidden = true;
}

function ensureEditorInitialized() {
  if (!notesEditor) return;
  if (notesEditor.querySelector(".notesLine")) return;
  notesEditor.innerHTML = "";
  notesEditor.appendChild(createNotesLine({ text: "" }));
}

function renderEditorFromBody(bodyText) {
  if (!notesEditor) return;
  notesEditor.innerHTML = "";
  const raw = String(bodyText || "").replace(/\r\n/g, "\n");
  const lines = raw.length ? raw.split("\n") : [""];
  for (const l of lines) {
    const { text, srclink } = parseLineWithSrcComment(l);
    notesEditor.appendChild(createNotesLine({ text, srclink }));
  }
  ensureEditorInitialized();
}

function serializeEditorToBody() {
  if (!notesEditor) return "";
  const lines = Array.from(notesEditor.querySelectorAll(".notesLine"));
  if (!lines.length) return "";
  return lines
    .map((line) => {
      const textEl = line.querySelector(".notesLineText");
      const text = String(textEl?.textContent || "");
      const srclink = String(line.dataset.srclink || "").trim();
      return srclink ? `${text} <!--srclink:${srclink}-->` : text;
    })
    .join("\n");
}

function focusLineText(lineEl) {
  const textEl = lineEl?.querySelector?.(".notesLineText");
  if (!textEl) return;
  textEl.focus();
  const range = document.createRange();
  range.selectNodeContents(textEl);
  range.collapse(false);
  const sel = window.getSelection?.();
  sel?.removeAllRanges?.();
  sel?.addRange?.(range);
}

function caretOffsetWithin(el) {
  const sel = window.getSelection?.();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return 0;
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

function parseSavedNoteText(fullText) {
  const t = String(fullText || "");
  const out = { title: "Untitled", folder: "Inbox", body: t };

  // Expected server format:
  // # Title
  //
  // Saved: ...
  // Folder: ...
  //
  // ---
  //
  // <body>
  const lines = t.split("\n");
  if (lines[0]?.startsWith("# ")) out.title = normalizeTitle(lines[0].slice(2));
  const folderLine = lines.find((l) => l.toLowerCase().startsWith("folder:"));
  if (folderLine) out.folder = normalizeFolder(folderLine.slice("folder:".length));

  const divider = "\n\n---\n\n";
  const idx = t.indexOf(divider);
  if (idx !== -1) out.body = t.slice(idx + divider.length);
  return out;
}

async function openSavedNoteById(id) {
  const r = await fetch(`/api/notes/open?id=${encodeURIComponent(id)}`);
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = json?.error || "Failed to open note";
    alert(msg);
    setError(msg, json?.details ? JSON.stringify(json.details, null, 2) : "");
    return;
  }

  // Load content into the current draft editor (so user can keep working and re-save)
  const parsed = parseSavedNoteText(json.text || "");
  if (notesTitleInput) notesTitleInput.value = parsed.title || "";
  if (notesFolderInput) notesFolderInput.value = parsed.folder || "Inbox";
  renderEditorFromBody(parsed.body || "");
  currentDraftLoadedFromSaved = true;
  currentSavedNoteId = id;
  setDraftMetaLabel();
  // update server-side draft too
  await fetch("/api/notes/draft", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: notesTitleInput?.value || "",
      folder: notesFolderInput?.value || "",
      text: notesEditor?.textContent || ""
    })
  });
}

function setMode(mode) {
  const isHome = mode === "home";
  const isResults = mode === "results";
  const isArticle = mode === "article";

  hero.hidden = !isHome;
  resultsWrap.hidden = isHome;

  if (resultsEl) {
    // Some environments can get into a weird state where `hidden` doesn't seem to apply quickly
    // after pushState; enforce via both attribute + inline style.
    resultsEl.toggleAttribute("hidden", !isResults);
    resultsEl.style.display = isResults ? "" : "none";
  }
  if (articleEl) {
    articleEl.toggleAttribute("hidden", !isArticle);
    articleEl.style.display = isArticle ? "" : "none";
  }
}

function setNotesOpen(open) {
  const isOpen = Boolean(open);
  document.body.classList.toggle("notesOpen", isOpen);
  notesToggleBtn?.setAttribute("aria-expanded", String(isOpen));
  notesPanel?.setAttribute("aria-hidden", String(!isOpen));
  if (notesToggleBtn) notesToggleBtn.hidden = isOpen;
  if (isOpen) {
    setTimeout(() => {
      ensureEditorInitialized();
      const firstLine = notesEditor?.querySelector?.(".notesLine");
      focusLineText(firstLine);
    }, 0);
  }
}

function toggleNotes() {
  setNotesOpen(!document.body.classList.contains("notesOpen"));
}

function hideSelectionSearch() {
  if (!selectionSearchBtn) return;
  selectionSearchBtn.hidden = true;
  lastSelectionText = "";
  selectionPopupMode = null;
  selectionSearchBtn.textContent = "Add to search";
}

function selectionIsInsideNotes() {
  const sel = window.getSelection?.();
  if (!sel || sel.rangeCount === 0) return false;
  const anchorNode = sel.anchorNode;
  const focusNode = sel.focusNode;
  if (!notesEditor) return false;
  return (
    (anchorNode && notesEditor.contains(anchorNode)) ||
    (focusNode && notesEditor.contains(focusNode))
  );
}

function formatPopupLabel(text) {
  const t = String(text || "").trim().replace(/\s+/g, " ");
  const clipped = t.length > 30 ? `${t.slice(0, 27)}…` : t;
  return clipped ? `Add “${clipped}” to search` : "Add to search";
}

function showSelectionPopupAtRect({ text, rect, mode }) {
  if (!selectionSearchBtn) return;
  const clean = String(text || "").trim().replace(/\s+/g, " ");
  if (!clean) return hideSelectionSearch();
  if (!rect || (rect.width === 0 && rect.height === 0)) return hideSelectionSearch();

  if (hoverHideT) {
    clearTimeout(hoverHideT);
    hoverHideT = null;
  }

  lastSelectionText = clean;
  selectionPopupMode = mode || "selection";
  selectionSearchBtn.textContent = formatPopupLabel(clean);
  selectionSearchBtn.hidden = false;

  const btnRect = selectionSearchBtn.getBoundingClientRect();
  const margin = 8;
  const top = Math.max(8, rect.top - btnRect.height - margin);
  const left = Math.min(
    window.innerWidth - btnRect.width - 8,
    Math.max(8, rect.left + rect.width / 2 - btnRect.width / 2)
  );

  selectionSearchBtn.style.top = `${top}px`;
  selectionSearchBtn.style.left = `${left}px`;
}

function showSelectionSearchNearSelection() {
  if (!selectionSearchBtn) return;
  const sel = window.getSelection?.();
  if (!sel || sel.rangeCount === 0) return hideSelectionSearch();
  if (!selectionIsInsideNotes()) return hideSelectionSearch();

  const text = String(sel.toString() || "").trim().replace(/\s+/g, " ");
  if (!text) return hideSelectionSearch();

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  showSelectionPopupAtRect({ text, rect, mode: "selection" });
}

function setError(message, details) {
  if (!message) {
    errorEl.hidden = true;
    errorEl.textContent = "";
    return;
  }
  errorEl.hidden = false;
  errorEl.textContent = details ? `${message}\n\n${details}` : message;
}

function formatMeta(totalResults, searchTime) {
  const parts = [];
  if (totalResults) parts.push(`About ${totalResults} results`);
  if (typeof searchTime === "number") parts.push(`(${searchTime.toFixed(2)} seconds)`);
  return parts.join(" ");
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderResults(items) {
  resultsEl.innerHTML = "";
  if (!items.length) {
    resultsEl.innerHTML = `<div class="result"><div class="snippet">No results.</div></div>`;
    return;
  }

  const html = items
    .map((it) => {
      const title = escapeHtml(it.title || "");
      const link = escapeHtml(it.link || "");
      const displayLink = escapeHtml(it.displayLink || "");
      const snippet = escapeHtml(it.snippet || "");
      const isInternalWiki = link.startsWith("/wiki/");
      const targetAttrs = isInternalWiki ? "" : ` target="_blank" rel="noopener noreferrer"`;
      return `
        <article class="result">
          <div class="displayLink">${displayLink}</div>
          <a class="title" href="${link}"${targetAttrs}>${title}</a>
          <div class="snippet">${snippet}</div>
        </article>
      `;
    })
    .join("");

  resultsEl.innerHTML = html;
}

function getQueryFromUrl() {
  const u = new URL(window.location.href);
  return (u.searchParams.get("q") || "").trim();
}

function setQueryInUrl(q) {
  const u = new URL(window.location.origin + "/");
  if (q) u.searchParams.set("q", q);
  else u.searchParams.delete("q");
  window.history.pushState({}, "", u.toString());
}

function getWikiTitleFromPath() {
  const path = window.location.pathname || "/";
  if (!path.startsWith("/wiki/")) return null;
  const slug = path.slice("/wiki/".length);
  if (!slug) return null;
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function handleRouteSafe() {
  Promise.resolve()
    .then(() => handleRoute())
    .catch((err) => {
      setError("Navigation failed", err?.message ? String(err.message) : String(err));
    });
}

function navigateTo(path) {
  window.history.pushState({}, "", path);
  handleRouteSafe();
}

// Ensure /wiki/... navigation is always handled by SPA routing (no full reload).
// Using capture phase prevents the browser from starting a real navigation first.
document.addEventListener(
  "click",
  (e) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return; // only left clicks
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // allow new tab/window gestures

    const a = e.target?.closest?.("a");
    const rawHref = a?.getAttribute?.("href") || "";
    if (!rawHref) return;

    // Handle both relative (/wiki/...) and absolute (http://localhost:3005/wiki/...) forms
    let hrefPath = null;
    if (rawHref.startsWith("/wiki/")) {
      hrefPath = rawHref;
    } else {
      try {
        const u = new URL(rawHref, window.location.origin);
        if (u.origin === window.location.origin && u.pathname.startsWith("/wiki/")) {
          hrefPath = u.pathname + u.search + u.hash;
        }
      } catch {
        // ignore
      }
    }
    if (!hrefPath) return;

    e.preventDefault();
    navigateTo(hrefPath);
  },
  true
);

async function loadWikipediaArticle(title) {
  setError("");
  const pretty = title.replaceAll("_", " ");
  metaEl.textContent = `Wikipedia: ${pretty}`;
  if (articleTitleEl) articleTitleEl.textContent = pretty;

  // Use Wikipedia's own page rendering so assets/layout work (images, CSS, etc.).
  const slug = title.replaceAll(" ", "_");
  const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`;
  const mobileUrl = `https://en.m.wikipedia.org/wiki/${encodeURIComponent(slug)}`;

  if (articleExternalEl) articleExternalEl.href = wikiUrl;
  if (articleFrameEl) {
    // Some browsers don't reliably load a lazy iframe that becomes visible after SPA navigation.
    // Reset then set ensures a fresh navigation without requiring a manual reload.
    articleFrameEl.src = "about:blank";
    setTimeout(() => {
      articleFrameEl.src = mobileUrl;
    }, 0);
  }
}

async function runSearch(q, { lucky = false } = {}) {
  const query = String(q || "").trim();
  if (!query) return;

  setMode("results");
  setError("");
  metaEl.textContent = "Searching…";
  resultsEl.innerHTML = "";
  if (articleFrameEl) articleFrameEl.src = "about:blank";
  if (articleTitleEl) articleTitleEl.textContent = "";
  if (articleExternalEl) articleExternalEl.href = "#";

  qTop.value = query;
  setQueryInUrl(query);

  const url = new URL("/api/search", window.location.origin);
  url.searchParams.set("q", query);

  const r = await fetch(url.toString());
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    metaEl.textContent = "";
    renderResults([]);
    setError(json?.error || "Search failed", json?.details ? JSON.stringify(json.details, null, 2) : "");
    return;
  }

  metaEl.textContent = formatMeta(json.totalResults, json.searchTime);
  renderResults(json.items || []);

  if (lucky && Array.isArray(json.items) && json.items[0]?.link) {
    window.location.href = json.items[0].link;
  }
}

function onSubmit(e, { lucky = false } = {}) {
  e.preventDefault();
  const q = (e?.target?.elements?.q?.value ?? "").toString();
  runSearch(q, { lucky });
}

searchForm.addEventListener("submit", (e) => onSubmit(e));
searchFormTop.addEventListener("submit", (e) => onSubmit(e));

notesToggleBtn?.addEventListener("click", toggleNotes);
notesCloseBtn?.addEventListener("click", () => setNotesOpen(false));
notesNewBtn?.addEventListener("click", async () => {
  const r = await fetch("/api/notes/draft/new", { method: "POST" });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) return setError(json?.error || "Failed to create new draft");
  currentDraftId = json.id || null;
  currentDraftLoadedFromSaved = false;
  currentSavedNoteId = null;
  if (notesTitleInput) notesTitleInput.value = json.title || "";
  if (notesFolderInput) notesFolderInput.value = json.folder || "Inbox";
  setDraftMetaLabel();
  renderEditorFromBody("");
  focusLineText(notesEditor?.querySelector?.(".notesLine"));
});

notesSaveBtn?.addEventListener("click", async () => {
  const title = normalizeTitle(notesTitleInput?.value);
  const folder = normalizeFolder(notesFolderInput?.value);
  const text = serializeEditorToBody();

  const r = await fetch("/api/notes/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: currentSavedNoteId, title, folder, text })
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = json?.error || "Failed to save note";
    alert(msg);
    return setError(msg, json?.details ? JSON.stringify(json.details, null, 2) : "");
  }

  currentSavedNoteId = json.id || currentSavedNoteId;
  currentDraftLoadedFromSaved = Boolean(currentSavedNoteId);
  setDraftMetaLabel({ savedTo: `${json.folder}/${json.filename}` });
  await refreshSavedNotes();
});

notesClearBtn?.addEventListener("click", async () => {
  const ok = confirm("Clear ALL saved notes? This cannot be undone.");
  if (!ok) return;
  const r = await fetch("/api/notes/clear", { method: "POST" });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = json?.error || "Failed to clear notes";
    // Errors from notes actions can be easy to miss (the error panel is in the results area),
    // so also show a blocking message.
    alert(msg);
    return setError(msg);
  }

  // Current editor stays as-is, but it's no longer associated with a saved file.
  currentSavedNoteId = null;
  currentDraftLoadedFromSaved = false;
  setDraftMetaLabel();
  await refreshSavedNotes();
});
selectionSearchBtn?.addEventListener("click", () => {
  const q = lastSelectionText;
  if (!q) return;
  qInput.value = q;
  qTop.value = q;
  hideSelectionSearch();
  runSearch(q);
});

selectionSearchBtn?.addEventListener("mouseenter", () => {
  isSelectionPopupHovered = true;
  if (hoverHideT) {
    clearTimeout(hoverHideT);
    hoverHideT = null;
  }
});

selectionSearchBtn?.addEventListener("mouseleave", () => {
  isSelectionPopupHovered = false;
  // Only hide immediately for hover-mode; selection-mode should be driven by selectionchange.
  if (selectionPopupMode === "hover") hideSelectionSearch();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("notesOpen")) {
    setNotesOpen(false);
  }
});

document.addEventListener("selectionchange", () => {
  // selectionchange is noisy; only react when notes is open
  if (!document.body.classList.contains("notesOpen")) return;
  // Delay so the selection rect is updated
  setTimeout(showSelectionSearchNearSelection, 0);
});

function wordInfoFromPoint(clientX, clientY) {
  // Use caret range APIs to locate a word under the mouse.
  let range = null;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(clientX, clientY);
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(clientX, clientY);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }
  if (!range) return null;

  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const parent = node.parentElement;
  if (!parent?.classList?.contains("notesLineText")) return null;

  const text = node.nodeValue || "";
  let i = range.startOffset;
  if (i < 0) i = 0;
  if (i > text.length) i = text.length;

  const isWordChar = (ch) => /[A-Za-z0-9_-]/.test(ch);
  // If we're on whitespace/punct, try the char to the left.
  if (i === text.length || !isWordChar(text[i])) {
    if (i > 0 && isWordChar(text[i - 1])) i = i - 1;
    else return null;
  }

  let start = i;
  let end = i + 1;
  while (start > 0 && isWordChar(text[start - 1])) start--;
  while (end < text.length && isWordChar(text[end])) end++;
  const word = text.slice(start, end);
  if (!word) return null;

  const wordRange = document.createRange();
  wordRange.setStart(node, start);
  wordRange.setEnd(node, end);
  const rect = wordRange.getBoundingClientRect();
  // Guard: caret APIs can "snap" to the end of a line even when the pointer
  // is past the last character. Only treat it as a hover if the pointer is
  // actually over the word's bounding rect (with a tiny tolerance).
  const tol = 2;
  const inside =
    rect &&
    clientX >= rect.left - tol &&
    clientX <= rect.right + tol &&
    clientY >= rect.top - tol &&
    clientY <= rect.bottom + tol;
  if (!inside) return null;
  return { word, rect };
}

let hoverRAF = 0;
let lastHoverWord = "";
function handleNotesHover(e) {
  if (!document.body.classList.contains("notesOpen")) return;
  if (!notesEditor) return;
  if (!notesEditor.contains(e.target)) return;
  if (!selectionSearchBtn) return;
  if (selectionPopupMode === "selection") return; // selection UI wins

  // Don't show hover popup while user has an active selection.
  const sel = window.getSelection?.();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) return;

  const info = wordInfoFromPoint(e.clientX, e.clientY);
  if (!info) {
    // Don't immediately hide: user may be moving to the popup button.
    if (selectionPopupMode === "hover" && !selectionSearchBtn.hidden) {
      if (isSelectionPopupHovered) return;
      if (!hoverHideT) {
        hoverHideT = setTimeout(() => {
          hoverHideT = null;
          if (selectionPopupMode === "hover" && !isSelectionPopupHovered) hideSelectionSearch();
        }, 250);
      }
      return;
    }
    lastHoverWord = "";
    return;
  }
  if (hoverHideT) {
    clearTimeout(hoverHideT);
    hoverHideT = null;
  }
  if (info.word === lastHoverWord && !selectionSearchBtn.hidden) return;
  lastHoverWord = info.word;

  cancelAnimationFrame(hoverRAF);
  hoverRAF = requestAnimationFrame(() => {
    // If user moved away quickly, skip.
    if (!lastHoverWord) return;
    showSelectionPopupAtRect({ text: info.word, rect: info.rect, mode: "hover" });
  });
}

notesEditor?.addEventListener("mousemove", handleNotesHover);
notesEditor?.addEventListener("mouseleave", () => {
  lastHoverWord = "";
  if (selectionPopupMode !== "hover") return;
  if (isSelectionPopupHovered) return;
  // Give the user time to move from the word to the popup button.
  hoverHideT = setTimeout(() => {
    if (selectionPopupMode === "hover" && !isSelectionPopupHovered) hideSelectionSearch();
  }, 250);
});

notesEditor?.addEventListener("scroll", () => {
  if (!selectionSearchBtn?.hidden) showSelectionSearchNearSelection();
});

window.addEventListener("resize", () => {
  if (!selectionSearchBtn?.hidden) showSelectionSearchNearSelection();
});

async function loadDraftOnStartup() {
  const r = await fetch("/api/notes/draft");
  const json = await r.json().catch(() => ({}));
  if (!r.ok) return;
  currentDraftId = json.id || null;
  currentDraftLoadedFromSaved = false;
  if (notesTitleInput) notesTitleInput.value = json.title || "";
  if (notesFolderInput) notesFolderInput.value = json.folder || "Inbox";
  setDraftMetaLabel();
  renderEditorFromBody(json.text || "");
}

async function refreshSavedNotes() {
  if (!notesSavedList) return;
  const r = await fetch("/api/notes/list");
  const json = await r.json().catch(() => ({}));
  const items = Array.isArray(json?.items) ? json.items : [];

  const stripTsPrefix = (filename) =>
    String(filename || "")
      .replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-/, "")
      .replace(/\.md$/i, "");

  const byFolder = new Map();
  for (const it of items) {
    const folder = String(it.folder || "Inbox");
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(it);
  }

  const folderNames = Array.from(byFolder.keys()).sort((a, b) => a.localeCompare(b));

  // Update header UI
  const inFolder = savedNotesView.mode === "files" && savedNotesView.folder;
  if (notesSavedBackBtn) notesSavedBackBtn.hidden = !inFolder;
  if (notesSavedTitle) notesSavedTitle.textContent = inFolder ? String(savedNotesView.folder) : "Saved notes";

  if (!items.length) {
    notesSavedList.innerHTML = `<div class="notesSavedItemName" style="color:#5f6368;">No saved notes yet.</div>`;
    return;
  }

  if (!inFolder) {
    // Folder list view
    notesSavedList.innerHTML = folderNames
      .map((folder) => {
        const count = byFolder.get(folder)?.length || 0;
        return `
          <div class="notesSavedItem" data-type="folder" data-folder="${escapeHtml(folder)}">
            <div class="notesSavedItemName"><span class="notesSavedFolderIcon">📁</span>${escapeHtml(
              folder
            )}</div>
            <div class="notesSavedItemMeta">${count}</div>
          </div>
        `;
      })
      .join("");
    return;
  }

  // File list view for selected folder
  const folderItems = (byFolder.get(savedNotesView.folder) || []).slice();
  // Sort newest-ish first by filename (old timestamped notes still sort reasonably)
  folderItems.sort((a, b) => String(b.filename || "").localeCompare(String(a.filename || "")));

  notesSavedList.innerHTML = folderItems
    .slice(0, 100)
    .map(
      (it) => `
        <div class="notesSavedItem" data-type="file" data-id="${it.id}">
          <div class="notesSavedItemName">${escapeHtml(stripTsPrefix(it.filename))}</div>
          <div class="notesSavedItemMeta">.md</div>
        </div>
      `
    )
    .join("");
}

notesSavedList?.addEventListener("click", async (e) => {
  const row = e.target?.closest?.(".notesSavedItem");
  if (!row) return;
  const type = row.getAttribute("data-type") || "file";
  if (type === "folder") {
    const folder = row.getAttribute("data-folder") || "";
    if (!folder) return;
    savedNotesView = { mode: "files", folder };
    await refreshSavedNotes();
    return;
  }

  const id = row.getAttribute("data-id");
  if (!id) return;
  await openSavedNoteById(id);
});

notesSavedBackBtn?.addEventListener("click", async () => {
  savedNotesView = { mode: "folders", folder: null };
  await refreshSavedNotes();
});

let saveT;
function queueDraftSave() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try {
      fetch("/api/notes/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: notesTitleInput?.value || "",
          folder: notesFolderInput?.value || "",
          text: serializeEditorToBody()
        })
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, 250);
}

notesEditor?.addEventListener("keydown", (e) => {
  const target = e.target;
  const textEl = target?.closest?.(".notesLineText");
  if (!textEl) return;

  if (e.key === "Backspace") {
    const line = textEl.closest(".notesLine");
    if (!line) return;
    const offset = caretOffsetWithin(textEl);
    if (offset !== 0) return;
    const prev = line.previousElementSibling;
    if (!prev?.classList?.contains("notesLine")) return;

    e.preventDefault();
    const prevTextEl = prev.querySelector(".notesLineText");
    const prevText = String(prevTextEl?.textContent || "");
    const curText = String(textEl.textContent || "");

    // Removing the newline means the previous line no longer has an "end of line" marker.
    clearLineSrcLink(prev);

    if (prevTextEl) prevTextEl.textContent = prevText + curText;
    line.remove();
    focusLineText(prev);
    // place caret at join point (end of previous original text)
    const joinPoint = prevText.length;
    const sel = window.getSelection?.();
    const range = document.createRange();
    const node = prevTextEl?.firstChild || prevTextEl;
    if (node && prevTextEl) {
      const safeOffset = Math.min(joinPoint, node.textContent?.length || 0);
      range.setStart(node, safeOffset);
      range.collapse(true);
      sel?.removeAllRanges?.();
      sel?.addRange?.(range);
    }

    setDraftMetaLabel();
    queueDraftSave();
    ensureEditorInitialized();
    return;
  }

  if (e.key === "Delete") {
    const line = textEl.closest(".notesLine");
    if (!line) return;
    const rawText = String(textEl.textContent || "");
    const offset = caretOffsetWithin(textEl);
    if (offset !== rawText.length) return;
    const next = line.nextElementSibling;
    if (!next?.classList?.contains("notesLine")) return;

    e.preventDefault();
    const nextTextEl = next.querySelector(".notesLineText");
    const nextText = String(nextTextEl?.textContent || "");

    // Removing the newline means this line no longer has an "end of line" marker.
    clearLineSrcLink(line);

    textEl.textContent = rawText + nextText;
    next.remove();
    focusLineText(line);
    const joinPoint = rawText.length;
    const sel = window.getSelection?.();
    const range = document.createRange();
    const node = textEl.firstChild || textEl;
    if (node) {
      const safeOffset = Math.min(joinPoint, node.textContent?.length || 0);
      range.setStart(node, safeOffset);
      range.collapse(true);
      sel?.removeAllRanges?.();
      sel?.addRange?.(range);
    }

    setDraftMetaLabel();
    queueDraftSave();
    ensureEditorInitialized();
    return;
  }

  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const line = textEl.closest(".notesLine");
    if (!line) return;

    const rawText = String(textEl.textContent || "");
    const hasText = rawText.trim().length > 0;
    if (hasText && !line.dataset.srclink && shouldStampLineLink()) {
      line.dataset.srclink = currentRouteHref();
      const btn = line.querySelector(".notesLineLinkBtn");
      if (btn) btn.hidden = false;
    }

    const offset = caretOffsetWithin(textEl);
    const before = rawText.slice(0, offset);
    const after = rawText.slice(offset);
    textEl.textContent = before;

    const newLine = createNotesLine({ text: after, srclink: null });
    if (line.nextSibling) notesEditor.insertBefore(newLine, line.nextSibling);
    else notesEditor.appendChild(newLine);
    focusLineText(newLine);

    setDraftMetaLabel();
    queueDraftSave();
  }
});

notesEditor?.addEventListener("input", (e) => {
  // Only respond to text edits inside our line text elements.
  if (!e?.target?.closest?.(".notesLineText")) return;
  setDraftMetaLabel();
  queueDraftSave();
});

notesTitleInput?.addEventListener("input", () => {
  setDraftMetaLabel();
  queueDraftSave();
});

notesFolderInput?.addEventListener("input", () => {
  setDraftMetaLabel();
  queueDraftSave();
});

// Ensure editor has at least one line on startup.
ensureEditorInitialized();

window.addEventListener("popstate", () => {
  handleRouteSafe();
});

// In-app Wikipedia navigation (keep notes available)
resultsEl?.addEventListener("click", (e) => {
  const a = e.target?.closest?.("a.title");
  const href = a?.getAttribute?.("href") || "";
  if (href.startsWith("/wiki/")) {
    e.preventDefault();
    navigateTo(href);
  }
});

async function handleRoute() {
  const wikiTitle = getWikiTitleFromPath();
  if (wikiTitle) {
    setMode("article");
    await loadWikipediaArticle(wikiTitle);
    return;
  }

  const q = getQueryFromUrl();
  if (q) {
    runSearch(q);
    return;
  }

  setMode("home");
  metaEl.textContent = "";
  if (resultsEl) resultsEl.innerHTML = "";
  if (articleFrameEl) articleFrameEl.src = "about:blank";
  if (articleTitleEl) articleTitleEl.textContent = "";
  setError("");
}

// Initial load
handleRouteSafe();

// Notes: load blank draft each server session + show saved files
loadDraftOnStartup();
refreshSavedNotes();


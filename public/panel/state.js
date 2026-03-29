/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.panel = g.__NOTETAKR__.panel || {};

  const ns = g.__NOTETAKR__.panel;

  ns.els = {
    newBtn: document.getElementById("srNotesNewBtn"),
    openBtn: document.getElementById("srNotesOpenBtn"),
    saveBtn: document.getElementById("srNotesSaveBtn"),
    titleInput: document.getElementById("srNotesTitle"),
    editorEl: document.getElementById("srNotesEditor"),
    gutterEl: document.getElementById("srNotesGutter"),
    searchBtn: document.getElementById("srNotesSearchBtn")
  };

  ns.state = {
    lastRenderedDraftText: null,
    lineLinks: [],
    gutterInnerEl: null,

    // Search popup state
    lastSearchSelection: "",
    hoverSearchWord: "",
    hoverRAF: 0,
    hoverHideT: null,
    isSearchBtnHovered: false,
    lastHoverWordRect: null,

    // Draft save debounce
    saveT: null
  };
})();


/* global chrome, importScripts */

// Service worker bootstraps the real implementation via classic scripts.
importScripts(
  "shared/constants.js",
  "sw/state.js",
  "sw/utils.js",
  "sw/draft-store.js",
  "sw/api.js",
  "sw/features.js",
  "sw/messages.js",
  "sw/action.js"
);


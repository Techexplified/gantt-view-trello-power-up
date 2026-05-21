// connector.js — loaded by Trello as the Power-Up iframe connector.
// This file registers all capabilities (board-buttons, board-views, etc.)
// It must be served at a URL you register in your Power-Up admin settings.
//
// In Create-React-App / Vite you should place this file in /public so it is
// served as-is (not bundled). The path will be:
//   https://your-domain.com/connector.js
//
// ─────────────────────────────────────────────────────────────────────────────

/* global TrelloPowerUp */

var GANTT_ICON_GRAY =
  "https://cdn.jsdelivr.net/npm/@mdi/svg@7.3.67/svg/chart-gantt.svg";

// ── Helper: build the full URL for an iframe page in your app ────────────────
function iframeUrl(path) {
  return window.location.origin + path;
}

// ── Initialize Power-Up ──────────────────────────────────────────────────────
TrelloPowerUp.initialize(
  {
    // ── 1. Board Buttons (icon in the Trello top navbar) ─────────────────────
    "board-buttons": function (t) {
      return [
        {
          icon: {
            dark: GANTT_ICON_GRAY,
            light: GANTT_ICON_GRAY,
          },
          text: "Gantt View",
          condition: "always",
          callback: function (t) {
            // Opens your React app as a full-screen overlay
            return t.modal({
              title: "Gantt View",
              url: iframeUrl("/index.html"),
              fullscreen: true,
              accentColor: "#00d084",
            });
          },
        },
      ];
    },

    // ── 2. Board Views (shows up under "Views" in Trello) ────────────────────
    "show-settings": function (t) {
      return t.popup({
        title: "Gantt View Settings",
        url: iframeUrl("/settings.html"),
        height: 200,
      });
    },
  },
  {
    // Power-Up options
    appKey: "e45a7c2350efb8ff28812397ba677b0c", // <-- replace with your key
    appName: "Gantt View",
  },
);

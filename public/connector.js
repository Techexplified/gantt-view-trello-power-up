var ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
            <rect x="0" y="2" width="12" height="4" rx="1" fill="#00d084"/>
            <rect x="4" y="7" width="12" height="4" rx="1" fill="#00d084"/>
            <rect x="2" y="12" width="14" height="4" rx="1" fill="#00d084"/>
          </svg>
        `);

var ICON_DARK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
              <rect x="1" y="2" width="14" height="12" rx="1.5" fill="#00d084"/>
              <rect x="2.5" y="4" width="6" height="2.5" rx="1" fill="#ffffff"/>
              <rect x="5" y="7" width="8" height="2.5" rx="1" fill="#ffffff"/>
              <rect x="3" y="10" width="10" height="2.5" rx="1" fill="#ffffff"/>
            </svg>
            `);

var BASE_URL = window.location.origin;

window.TrelloPowerUp.initialize(
  {
    "board-buttons": function (t) {
      return [
        {
          icon: {
            dark: ICON_DARK,
            light: ICON,
          },
          text: "TaskFlow",
          condition: "always",
          callback: function (t) {
            return t.modal({
              title: "TaskFlow",
              url: BASE_URL + "/index.html",
              fullscreen: true,
            });
          },
        },
      ];
    },
  },
  {
    appKey: "e45a7c2350efb8ff28812397ba677b0c",
    appName: "TaskFlow",
  },
);

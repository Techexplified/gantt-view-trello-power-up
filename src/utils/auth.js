// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// Replace TRELLO_API_KEY with your actual key from
// https://trello.com/power-ups/admin
// ─────────────────────────────────────────────────────────────────────────────
export const TRELLO_API_KEY = "e45a7c2350efb8ff28812397ba677b0c"; // <-- replace this

// The auth callback URL must match what you registered in the Power-Up admin.
// During local dev this is typically http://localhost:3000/auth.html
export const AUTH_CALLBACK_URL = `${window.location.origin}/auth.html`;

export const TRELLO_AUTH_URL = (returnUrl) =>
  `https://trello.com/1/authorize?` +
  `expiration=never` +
  `&name=Gantt+View` +
  `&scope=read` +
  `&response_type=token` +
  `&key=${TRELLO_API_KEY}` +
  `&return_url=${encodeURIComponent(returnUrl || AUTH_CALLBACK_URL)}` +
  `&callback_method=postMessage`;

// ─────────────────────────────────────────────────────────────────────────────
// Token helpers (stored in localStorage so they survive page reloads)
// ─────────────────────────────────────────────────────────────────────────────
const TOKEN_KEY = "gantt_trello_token";

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const storeToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// OAuth popup flow
// Opens the Trello auth page in a small popup and listens for the token
// via postMessage from auth.html.
// ─────────────────────────────────────────────────────────────────────────────
export function authorizeWithTrello() {
  return new Promise((resolve, reject) => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      TRELLO_AUTH_URL(),
      "TrelloAuth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
    );

    if (!popup) {
      reject(new Error("Popup blocked. Please allow popups for this site."));
      return;
    }

    // Listen for the token posted back by auth.html
    const handler = (event) => {
      // Accept messages from Trello or our own origin
      if (!event.data) return;

      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        if (data && data.token) {
          window.removeEventListener("message", handler);
          clearInterval(pollTimer);
          storeToken(data.token);
          resolve(data.token);
        }
      } catch (_) {
        /* ignore non-JSON messages */
      }
    };

    window.addEventListener("message", handler);

    // Fallback: poll localStorage in case postMessage doesn't fire
    // (e.g. the popup wrote directly to localStorage in auth.html)
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        window.removeEventListener("message", handler);

        const stored = localStorage.getItem("trello_token");
        if (stored) {
          localStorage.removeItem("trello_token"); // clean up temp key
          storeToken(stored);
          resolve(stored);
        } else {
          reject(new Error("Authorization cancelled."));
        }
      }
    }, 500);
  });
}

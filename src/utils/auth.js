// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// Trello API keys are public by design (the secret is never used here).
// ─────────────────────────────────────────────────────────────────────────────
export const TRELLO_API_KEY = "e45a7c2350efb8ff28812397ba677b0c";

// The auth callback URL must be listed as an allowed origin in the Power-Up
// admin (https://trello.com/power-ups/admin).
export const AUTH_CALLBACK_URL = `${window.location.origin}/auth.html`;

// `account` scope lets the backend read the member's email (used for the
// customer record and to pre-fill the checkout). Without it, email is blank.
export const TRELLO_AUTH_URL = (returnUrl) =>
  `https://trello.com/1/authorize?` +
  `expiration=never` +
  `&name=TaskFlow` +
  `&scope=read,write,account` +
  `&response_type=token` +
  `&key=${TRELLO_API_KEY}` +
  `&return_url=${encodeURIComponent(returnUrl || AUTH_CALLBACK_URL)}` +
  `&callback_method=fragment`;

// ─────────────────────────────────────────────────────────────────────────────
// Token helpers (localStorage so they survive reloads). Wrapped in try/catch:
// storage can throw in some embedded/private contexts.
// ─────────────────────────────────────────────────────────────────────────────
const TOKEN_KEY = "taskflow_trello_token";

export const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const storeToken = (token) => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable — token lives for this page load only */
  }
};
export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

// Best-effort: revoke the token at Trello on sign-out so a copied token
// stops working. Never blocks sign-out if it fails.
export async function revokeToken(token) {
  if (!token) return;
  try {
    await fetch(
      `https://api.trello.com/1/tokens/${encodeURIComponent(token)}/?key=${TRELLO_API_KEY}&token=${encodeURIComponent(token)}`,
      { method: "DELETE" },
    );
  } catch {
    /* offline or blocked — local sign-out still happens */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OAuth popup flow
// Opens Trello's authorize page in a popup; public/auth.js posts the token
// back to this window. Messages are accepted ONLY from our own origin, so
// another site can't inject a token into the app.
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

    let done = false;
    const finish = (err, token) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      clearInterval(closedPoll);
      if (err) return reject(err);
      storeToken(token);
      try {
        popup.close();
      } catch {
        /* already closed */
      }
      resolve(token);
    };

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.source === "taskflow-auth" && typeof data.token === "string") {
        finish(null, data.token);
      }
    };
    window.addEventListener("message", onMessage);

    // If the user closes the popup without authorizing. A short grace period
    // lets a just-sent postMessage arrive first.
    const closedPoll = setInterval(() => {
      if (!popup.closed) return;
      clearInterval(closedPoll);
      setTimeout(() => {
        // Fallback for browsers where the popup shares our storage.
        const stored = getStoredToken();
        if (stored) finish(null, stored);
        else finish(new Error("Authorization cancelled."));
      }, 600);
    }, 500);
  });
}

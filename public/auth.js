// public/auth.js — runs in the Trello authorize popup after the redirect.
(function () {
  var status = document.getElementById("status");
  try {
    var params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    var token = params.get("token");

    // Remove the token from the address bar / history right away.
    try {
      history.replaceState(null, "", window.location.pathname);
    } catch (e) {
      /* ignore */
    }

    if (!token) {
      status.textContent =
        "Authorization failed or was cancelled. You can close this window.";
      return;
    }

    // Fallback path for browsers where popup and app share storage.
    try {
      localStorage.setItem("taskflow_trello_token", token);
    } catch (e) {
      /* storage unavailable */
    }

    // Send ONLY to our own origin — never "*" — so a third-party page that
    // opened this popup can't receive the user's Trello token.
    if (window.opener) {
      window.opener.postMessage(
        { token: token, source: "taskflow-auth" },
        window.location.origin,
      );
    }

    status.textContent = "Authorization successful. Closing window...";
    setTimeout(function () {
      window.close();
    }, 800);
  } catch (err) {
    console.error("Auth error:", err);
    if (status) {
      status.textContent =
        "Authorization failed. Please close this window and try again.";
    }
  }
})();

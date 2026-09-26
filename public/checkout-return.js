// public/checkout-return.js
//
// Dodo redirects here after checkout (set the backend's CHECKOUT_RETURN_URL
// to https://<your-taskflow-domain>/checkout-return.html). Dodo appends
// ?subscription_id=…&status=… to the URL.
//
// This page does NOT grant Pro — only the signed webhook does. It just tells
// the Trello tab that opened checkout to start checking for the upgrade.
(function () {
  var params = new URLSearchParams(window.location.search);
  var status = (params.get("status") || "").toLowerCase();

  var FAILED = ["failed", "cancelled", "canceled", "expired", "declined"];
  var ok = FAILED.indexOf(status) === -1;

  var el = function (id) {
    return document.getElementById(id);
  };

  if (ok) {
    el("icon").textContent = "🎉";
    el("title").textContent = "Thanks! Your payment is being confirmed";
    el("message").textContent =
      "Pro unlocks in TaskFlow automatically within a minute. " +
      "You can close this tab and go back to Trello.";
  } else {
    el("icon").textContent = "⚠️";
    el("title").textContent = "Payment not completed";
    el("message").textContent =
      "Your payment didn't go through, so nothing was charged for Pro. " +
      "Close this tab and try again from TaskFlow.";
  }

  var notified = false;
  try {
    if (window.opener && !window.opener.closed) {
      // Only our own origin (the TaskFlow iframe inside Trello) receives this.
      window.opener.postMessage(
        { type: "taskflow:checkout-return", ok: ok, status: status },
        window.location.origin,
      );
      notified = true;
    }
  } catch (e) {
    /* opener gone or cross-origin-isolated — TaskFlow is polling anyway */
  }

  var closeBtn = el("close");
  closeBtn.hidden = false;
  closeBtn.addEventListener("click", function () {
    window.close();
  });

  // Close automatically only when TaskFlow got the message (otherwise leave
  // the confirmation visible). Browsers only allow closing script-opened tabs.
  if (notified && ok) {
    setTimeout(function () {
      window.close();
    }, 2500);
  }
})();

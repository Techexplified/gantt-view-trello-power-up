(function () {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    const token = params.get("token");

    if (!token) {
      document.getElementById("status").textContent =
        "Authorization failed: No token received.";
      return;
    }

    // Save token as backup
    localStorage.setItem("taskflow_trello_token", token);

    // Send token to parent window
    if (window.opener) {
      window.opener.postMessage(
        {
          token,
          source: "taskflow-auth",
        },
        "*",
      );
    }

    document.getElementById("status").textContent =
      "Authorization successful. Closing window...";

    setTimeout(() => {
      window.close();
    }, 1000);
  } catch (err) {
    // console.error("Auth error:", err);
    alert("Auth error:", err);

    const status = document.getElementById("status");

    if (status) {
      status.textContent =
        "Authorization failed. Please close this window and try again.";
    }
  }
})();

import React, { useState, useEffect, useCallback } from "react";
import LoginScreen from "./componenets/LoginScreen";
import GanttDashboard from "./componenets/GanttDashboard";
import { getStoredToken, clearToken } from "./utils/auth";
import { getMe } from "./utils/api";

export default function App() {
  const [token, setToken] = useState(() => getStoredToken());
  const [boardId, setBoardId] = useState(null);
  const [planStatus, setPlanStatus] = useState(null);

  useEffect(() => {
    try {
      if (window.TrelloPowerUp) {
        const t = window.TrelloPowerUp.iframe();
        t.board("id").then((board) => {
          if (board && board.id) setBoardId(board.id);
        });
      }
    } catch (e) {
      // Not inside a Trello iframe (e.g. dev mode)
    }
  }, []);

  const refreshPlanStatus = useCallback(() => {
    if (!getStoredToken()) return;
    getMe()
      .then(setPlanStatus)
      .catch((err) => {
        console.error("Failed to sync with backend:", err);
      });
  }, []);

  useEffect(() => {
    if (!token) return;
    getMe()
      .then(setPlanStatus)
      .catch((err) => {
        console.error("Failed to sync with backend:", err);
        clearToken();
        setToken(null);
      });
  }, [token]);

  // ── Checkout return handling ─────────────────────────────────────────
  // If THIS load is the checkout-return tab (opened via window.open from
  // PricingModal), Dodo will have appended ?status=active&... to the URL.
  // Tell the tab that opened us, then close ourselves so the user lands
  // back in Trello automatically instead of staring at an orphan tab.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "active" && window.opener) {
      try {
        window.opener.postMessage(
          { type: "taskflow:subscription-active" },
          "*",
        );
      } catch (e) {
        console.error("Failed to notify opener tab:", e);
      }
      window.close();
    }
  }, []);

  // ── Cross-tab sync ───────────────────────────────────────────────────
  // Runs in the ORIGINAL tab (the real Power-Up iframe). Picks up the
  // message posted above and refetches plan status so the Pro badge
  // appears without a manual reload.
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === "taskflow:subscription-active") {
        refreshPlanStatus();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refreshPlanStatus]);

  // ── Safety net ───────────────────────────────────────────────────────
  // Covers cases where postMessage/window.close don't fire (popup
  // blockers, the user closing the checkout tab manually, etc.) by
  // refetching whenever the user tabs back into this window.
  useEffect(() => {
    window.addEventListener("focus", refreshPlanStatus);
    return () => window.removeEventListener("focus", refreshPlanStatus);
  }, [refreshPlanStatus]);

  const handleAuth = (newToken) => setToken(newToken);
  const handleLogout = () => {
    clearToken();
    setToken(null);
    setPlanStatus(null);
  };

  if (!token) {
    return <LoginScreen onAuth={handleAuth} />;
  }

  return (
    <GanttDashboard
      initialBoardId={boardId}
      onLogout={handleLogout}
      planStatus={planStatus}
    />
  );
}

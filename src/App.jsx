import React, { useState, useEffect, useCallback } from "react";
import LoginScreen from "./componenets/LoginScreen";
import GanttDashboard from "./componenets/GanttDashboard";
import PlanProvider from "./plan/PlanProvider";
import { getStoredToken, clearToken, revokeToken } from "./utils/auth";
import { AUTH_EXPIRED_EVENT } from "./utils/api";

// If the backend's CHECKOUT_RETURN_URL still points at the app root, Dodo
// lands here with ?status=… — hand off to the lightweight return page.
function isCheckoutReturn() {
  const p = new URLSearchParams(window.location.search);
  return p.has("status") && (p.has("subscription_id") || p.has("payment_id"));
}

export default function App() {
  const [token, setToken] = useState(() => getStoredToken());
  const [boardId, setBoardId] = useState(null);
  const redirecting = isCheckoutReturn();

  useEffect(() => {
    if (redirecting) {
      window.location.replace("/checkout-return.html" + window.location.search);
    }
  }, [redirecting]);

  // Current Trello board when opened from the Power-Up button.
  useEffect(() => {
    if (!window.TrelloPowerUp) return; // plain browser tab / local dev
    try {
      const t = window.TrelloPowerUp.iframe();
      Promise.resolve(t.board("id"))
        .then((board) => {
          if (board?.id) setBoardId(board.id);
        })
        .catch(() => {
          /* not inside a Trello iframe */
        });
    } catch {
      /* not inside a Trello iframe */
    }
  }, []);

  // Backend said the Trello token is invalid/revoked → back to sign-in.
  // (Only a real 401 does this — outages no longer log everyone out.)
  useEffect(() => {
    const onExpired = () => {
      clearToken();
      setToken(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const handleAuth = useCallback((newToken) => setToken(newToken), []);

  const handleLogout = useCallback(() => {
    const old = getStoredToken();
    clearToken();
    setToken(null);
    revokeToken(old); // best-effort, doesn't block
  }, []);

  if (redirecting) return null;

  if (!token) {
    return <LoginScreen onAuth={handleAuth} />;
  }

  // key={token}: a new sign-in starts with a fresh plan state.
  return (
    <PlanProvider key={token}>
      <GanttDashboard initialBoardId={boardId} onLogout={handleLogout} />
    </PlanProvider>
  );
}

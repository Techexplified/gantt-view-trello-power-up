import React, { useState, useEffect } from "react";
import LoginScreen from "./componenets/LoginScreen";
import GanttDashboard from "./componenets/GanttDashboard";
import { getStoredToken, clearToken } from "./utils/auth";
import { getMe } from "./utils/api";

export default function App() {
  const [token, setToken] = useState(() => getStoredToken());
  const [boardId, setBoardId] = useState(null);
  const [planStatus, setPlanStatus] = useState(null); // ← new

  useEffect(() => {
    try {
      if (window.TrelloPowerUp) {
        const t = window.TrelloPowerUp.iframe();
        t.board("id").then((board) => {
          if (board && board.id) setBoardId(board.id);
        });
      }
    } catch (e) {
      /* not inside Trello iframe */
    }
  }, []);

  // Runs on first mount (if already logged in) and every time `token` changes
  // (i.e. right after a fresh sign-in) — this is what creates the Mongo
  // profile and starts the 7-day trial on first-ever call.
  useEffect(() => {
    if (!token) return;
    getMe()
      .then(setPlanStatus)
      .catch((err) => {
        console.error("Failed to sync with backend:", err);
        // token might be stale/revoked — bounce back to login
        clearToken();
        setToken(null);
      });
  }, [token]);

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
      planStatus={planStatus} // ← GanttDashboard can now read isActive/isTrialActive/trialEndsAt
    />
  );
}

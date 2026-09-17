import React, { useState, useEffect } from "react";
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

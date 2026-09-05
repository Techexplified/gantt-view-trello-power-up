import React, { useState, useEffect } from "react";
import LoginScreen from "./componenets/LoginScreen";
import GanttDashboard from "./componenets/GanttDashboard";
import { getStoredToken, clearToken } from "./utils/auth";

export default function App() {
  // Check if user already has a token stored from a previous session
  const [token, setToken] = useState(() => getStoredToken());
  const [boardId, setBoardId] = useState(null);

  // Try to read the boardId from the Trello Power-Up context (when opened via board-button)
  useEffect(() => {
    try {
      // When running inside a Trello iframe, TrelloPowerUp is available globally
      if (window.TrelloPowerUp) {
        const t = window.TrelloPowerUp.iframe();
        t.board("id").then((board) => {
          if (board && board.id) setBoardId(board.id);
        });
      }
    } catch (e) {
      // Not inside a Trello iframe (e.g. dev mode) — boardId stays null
      // console.warn("Not running inside Trello iframe:", e.message);
    }
  }, []);

  const handleAuth = (newToken) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    clearToken();
    setToken(null);
  };

  if (!token) {
    return <LoginScreen onAuth={handleAuth} />;
  }

  return <GanttDashboard initialBoardId={boardId} onLogout={handleLogout} />;
}
//test

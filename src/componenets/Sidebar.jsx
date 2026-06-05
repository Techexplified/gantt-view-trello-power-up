import React, { useState, useEffect } from "react";
import { getMyBoards } from "../utils/trelloApi";
import { clearToken } from "../utils/auth";
import { ChartNoAxesGantt } from "lucide-react";

export default function Sidebar({
  board,
  activeBoardId,
  onSelectBoard,
  onLogout,
}) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    getMyBoards()
      .then(setBoards)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    clearToken();
    onLogout();
  };

  return (
    <aside style={{ ...styles.sidebar, width: collapsed ? 52 : 220 }}>
      {/* Top header */}
      <div style={styles.header}>
        {!collapsed && (
          <div style={styles.logoRow}>
            <PIcon />
            <span style={styles.logoText}>TaskFlow</span>
          </div>
        )}
        <button
          style={styles.collapseBtn}
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Active board name */}
          {board && (
            <div style={styles.activeBoard}>
              <span style={styles.activeBoardLabel}>Current board</span>
              <span style={styles.activeBoardName}>{board.name}</span>
            </div>
          )}

          {/* Board list */}
          <div style={styles.section}>
            <span style={styles.sectionLabel}>Your Boards</span>
            {loading ? (
              <div style={styles.loadingRow}>Loading…</div>
            ) : (
              <ul style={styles.list}>
                {boards.map((b) => (
                  <li key={b.id}>
                    <button
                      style={{
                        ...styles.boardItem,
                        ...(b.id === activeBoardId
                          ? styles.boardItemActive
                          : {}),
                      }}
                      onClick={() => onSelectBoard(b.id)}
                    >
                      <span
                        style={{
                          ...styles.boardDot,
                          background: b.prefs?.backgroundColor || "#0079bf",
                        }}
                      />
                      <span style={styles.boardItemName}>{b.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Bottom: logout */}
      <div style={styles.bottom}>
        <button
          style={styles.logoutBtn}
          onClick={handleLogout}
          title="Sign out"
        >
          {collapsed ? "⏻" : "⏻  Sign out"}
        </button>
      </div>
    </aside>
  );
}

function PIcon() {
  return (
    <div
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: "rgba(0,208,132,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ChartNoAxesGantt size={22} color="#00d084" />
    </div>
  );
}

const styles = {
  sidebar: {
    background: "#161b27",
    borderRight: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    position: "sticky",
    top: 0,
    flexShrink: 0,
    transition: "width 0.25s ease",
    overflow: "hidden",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    minHeight: 56,
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  logoText: {
    color: "#e6edf3",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: "-0.3px",
  },
  collapseBtn: {
    background: "none",
    border: "none",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: 18,
    padding: "2px 6px",
    borderRadius: 4,
    lineHeight: 1,
  },
  activeBoard: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  activeBoardLabel: {
    display: "block",
    fontSize: 10,
    color: "#484f58",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: 4,
  },
  activeBoardName: {
    display: "block",
    color: "#00d084",
    fontWeight: 700,
    fontSize: 14,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  section: {
    flex: 1,
    overflowY: "auto",
    padding: "12px 0",
  },
  sectionLabel: {
    display: "block",
    fontSize: 10,
    color: "#484f58",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    padding: "0 16px",
    marginBottom: 6,
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  boardItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "7px 16px",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#8b949e",
    fontSize: 13,
    textAlign: "left",
    transition: "background 0.15s, color 0.15s",
    borderRadius: 0,
  },
  boardItemActive: {
    background: "rgba(0,208,132,0.1)",
    color: "#e6edf3",
  },
  boardDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    flexShrink: 0,
  },
  boardItemName: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  loadingRow: {
    padding: "8px 16px",
    color: "#484f58",
    fontSize: 12,
  },
  bottom: {
    padding: 12,
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  logoutBtn: {
    width: "100%",
    padding: "8px 10px",
    background: "none",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 7,
    color: "#8b949e",
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left",
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
};

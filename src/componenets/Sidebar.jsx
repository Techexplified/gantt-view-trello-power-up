import React, { useState, useEffect } from "react";
import { getMyBoards } from "../utils/trelloApi";
import { clearToken } from "../utils/auth";
import { ChartNoAxesGantt } from "lucide-react";

export default function Sidebar({
  board,
  activeBoardId,
  onSelectBoard,
  onLogout,
  view = "calendar",
  onViewChange,
}) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    getMyBoards()
      .then(setBoards)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    clearToken();
    onLogout();
  };

  return (
    <>
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
            {/* View switcher: Calendar / Timeline */}
            <div style={styles.viewToggleWrap}>
              <button
                style={{
                  ...styles.viewToggleBtn,
                  ...(view === "calendar" ? styles.viewToggleBtnActive : {}),
                }}
                onClick={() => onViewChange && onViewChange("calendar")}
              >
                Calendar
              </button>
              <button
                style={{
                  ...styles.viewToggleBtn,
                  ...(view === "timeline" ? styles.viewToggleBtnActive : {}),
                }}
                onClick={() => onViewChange && onViewChange("timeline")}
              >
                Timeline
              </button>
            </div>

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
            onClick={() => setShowLogoutConfirm(true)}
            title="Sign out"
          >
            {collapsed ? "⏻" : "⏻  Sign out"}
          </button>
        </div>
      </aside>

      {showLogoutConfirm && (
        <div
          style={styles.modalOverlay}
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Sign Out</h3>

            <p style={styles.modalText}>
              Are you sure you want to sign out of TaskFlow?
            </p>

            <div style={styles.modalActions}>
              <button
                style={styles.cancelBtn}
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>

              <button style={styles.confirmBtn} onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PIcon() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
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
  viewToggleWrap: {
    display: "flex",
    gap: 4,
    margin: "12px 12px 4px",
    padding: 3,
    background: "rgba(255,255,255,0.04)",
    borderRadius: 8,
  },
  viewToggleBtn: {
    flex: 1,
    background: "none",
    border: "none",
    color: "#8b949e",
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 0",
    borderRadius: 6,
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
  },
  viewToggleBtnActive: {
    background: "rgba(0,208,132,0.15)",
    color: "#00d084",
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
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    backdropFilter: "blur(4px)",
  },

  modal: {
    width: 380,
    background: "#1e2432",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
  },

  modalTitle: {
    color: "#e6edf3",
    fontSize: 18,
    fontWeight: 700,
    margin: "0 0 12px",
  },

  modalText: {
    color: "#8b949e",
    fontSize: 14,
    lineHeight: 1.6,
    margin: 0,
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
  },

  cancelBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#c9d1d9",
    padding: "10px 16px",
    borderRadius: 8,
    cursor: "pointer",
  },

  confirmBtn: {
    background: "#00d084",
    border: "none",
    color: "#0d1117",
    fontWeight: 700,
    padding: "10px 16px",
    borderRadius: 8,
    cursor: "pointer",
  },
};

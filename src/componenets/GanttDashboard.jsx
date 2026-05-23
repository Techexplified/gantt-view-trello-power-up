import React, { useState } from "react";
import Sidebar from "./Sidebar";
import CalendarView from "./CalendarView";
import RightPanel from "./RightPanel";
import { useBoardData } from "../hooks/useBoardData";

export default function GanttDashboard({ initialBoardId, onLogout }) {
  const [activeBoardId, setActiveBoardId] = useState(initialBoardId || null);
  const [selectedCard, setSelectedCard] = useState(null);
  const { board, lists, loading, error } = useBoardData(activeBoardId);

  const cards = [];
  return (
    <div style={styles.layout}>
      {/* ── Left Sidebar ── */}
      <Sidebar
        board={board}
        activeBoardId={activeBoardId}
        onSelectBoard={setActiveBoardId}
        onLogout={onLogout}
      />

      {/* ── Main Calendar ── */}
      <main style={styles.main}>
        {!activeBoardId ? (
          <EmptyState onSelect={setActiveBoardId} />
        ) : loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <CalendarView
            cards={cards}
            lists={lists}
            onCardClick={setSelectedCard}
          />
        )}
      </main>

      {/* ── Right Panel ── */}
      {activeBoardId && !loading && !error && (
        <RightPanel lists={lists} cards={cards} onCardClick={setSelectedCard} />
      )}

      {/* ── Card Detail Modal ── */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          lists={lists}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={styles.centered}>
      <div style={styles.emptyIcon}>📋</div>
      <h2 style={styles.emptyTitle}>Select a board</h2>
      <p style={styles.emptyText}>
        Choose a board from the left sidebar to see its calendar view.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={styles.centered}>
      <div style={styles.spinner} />
      <p style={styles.loadingText}>Loading board data…</p>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div style={styles.centered}>
      <div style={styles.errorIcon}>⚠️</div>
      <h2 style={styles.emptyTitle}>Something went wrong</h2>
      <p style={styles.errorText}>{message}</p>
    </div>
  );
}

function CardModal({ card, lists, onClose }) {
  const list = lists.find((l) => l.id === card.idList);
  const due = card.due
    ? new Date(card.due).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const start = card.start
    ? new Date(card.start).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>{card.name}</h3>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={styles.modalBody}>
          <Row label="List" value={list?.name || "—"} />
          {start && <Row label="Start date" value={start} />}
          {due && <Row label="Due date" value={due} />}
          {card.labels?.length > 0 && (
            <div style={styles.row}>
              <span style={styles.rowLabel}>Labels</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {card.labels.map((lbl, i) => (
                  <span
                    key={i}
                    style={{ ...styles.labelChip, background: lbl.color }}
                  >
                    {lbl.name || lbl.color}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={styles.modalFooter}>
          <a
            href={card.url}
            target="_blank"
            rel="noreferrer"
            style={styles.openBtn}
          >
            Open in Trello ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowValue}>{value}</span>
    </div>
  );
}

/* ── Spinner keyframe injected once ── */
const styleTag = document.createElement("style");
styleTag.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
`;
document.head.appendChild(styleTag);

const styles = {
  layout: {
    display: "flex",
    flexDirection: "row",
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: "#1a1f2e",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    overflow: "hidden",
  },
  centered: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 40,
    width: "100%",
  },
  emptyIcon: { fontSize: 48 },
  errorIcon: { fontSize: 48 },
  emptyTitle: { color: "#e6edf3", fontSize: 20, fontWeight: 700, margin: 0 },
  emptyText: { color: "#8b949e", fontSize: 14, margin: 0, textAlign: "center" },
  errorText: { color: "#ff8fa3", fontSize: 13, margin: 0, textAlign: "center" },
  loadingText: { color: "#8b949e", fontSize: 14, margin: 0 },
  spinner: {
    width: 36,
    height: 36,
    border: "3px solid rgba(0,208,132,0.2)",
    borderTopColor: "#00d084",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#1e2432",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    width: 420,
    maxWidth: "90vw",
    animation: "fadeIn 0.2s ease",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "20px 20px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  modalTitle: {
    color: "#e6edf3",
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    flex: 1,
    lineHeight: 1.4,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#8b949e",
    fontSize: 18,
    cursor: "pointer",
    marginLeft: 12,
    padding: 0,
  },
  modalBody: {
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  row: { display: "flex", alignItems: "center", gap: 12 },
  rowLabel: { color: "#484f58", fontSize: 12, width: 80, flexShrink: 0 },
  rowValue: { color: "#c9d1d9", fontSize: 13 },
  labelChip: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 4,
    color: "#fff",
    fontWeight: 500,
  },
  modalFooter: {
    padding: "12px 20px 20px",
    display: "flex",
    justifyContent: "flex-end",
  },
  openBtn: {
    background: "rgba(0,121,191,0.2)",
    border: "1px solid rgba(0,121,191,0.5)",
    color: "#58a6ff",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  },
};

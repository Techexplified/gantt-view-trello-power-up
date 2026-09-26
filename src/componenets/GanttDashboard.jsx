import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import CalendarView from "./CalendarView";
import TimelineView from "./TimelineView";
import RightPanel from "./RightPanel";
import CardModal from "./CardModal";
import { useBoardData } from "../hooks/useBoardData";
import { usePlan } from "../plan/planContext";
import { Lock, Sparkles } from "lucide-react";

export default function GanttDashboard({ initialBoardId, onLogout }) {
  const [activeBoardId, setActiveBoardId] = useState(initialBoardId || null);
  const plan = usePlan();

  // The Trello board id arrives asynchronously (after first render). Adopt it
  // once it shows up, unless the user already picked a board themselves.
  useEffect(() => {
    if (initialBoardId) {
      setActiveBoardId((current) => current || initialBoardId);
    }
  }, [initialBoardId]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [view, setView] = useState("calendar"); // "calendar" | "timeline"
  const {
    board,
    lists,
    cards: fetchedCards,
    loading,
    error,
    refetch,
  } = useBoardData(activeBoardId);
  const [cards, setCards] = useState([]);

  useEffect(() => {
    setCards(fetchedCards);
  }, [fetchedCards]);

  return (
    <div style={styles.layout}>
      {/* ── Left Sidebar ── */}
      <Sidebar
        board={board}
        activeBoardId={activeBoardId}
        onSelectBoard={setActiveBoardId}
        onLogout={onLogout}
        view={view}
        onViewChange={setView}
        proLocked={!!plan.status && !plan.canUsePro}
      />

      {/* ── Main Calendar ── */}
      <main style={styles.main}>
        {!activeBoardId ? (
          <EmptyState onSelect={setActiveBoardId} />
        ) : loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : view === "timeline" ? (
          plan.canUsePro ? (
            <TimelineView
              cards={cards}
              lists={lists}
              onCardClick={setSelectedCard}
              boardId={activeBoardId}
            />
          ) : (
            <ProGate plan={plan} />
          )
        ) : (
          <CalendarView
            cards={cards}
            lists={lists}
            onCardClick={setSelectedCard}
            onCardUpdated={(cardId, newDue, newStart) => {
              setCards((prev) =>
                prev.map((c) =>
                  c.id === cardId
                    ? {
                        ...c,
                        due: newDue,
                        ...(newStart !== undefined && { start: newStart }),
                      }
                    : c,
                ),
              );
            }}
            onCardCreated={(newCard) => {
              setCards((prev) => [...prev, newCard]);
            }}
          />
        )}
      </main>

      {/* ── Right Panel (Calendar view only — Timeline has its own two-pane layout) ── */}
      {activeBoardId && !loading && !error && view === "calendar" && (
        <RightPanel
          lists={lists}
          cards={cards}
          onCardClick={setSelectedCard}
          onCardCreated={(newCard) => {
            setCards((prev) => [...prev, newCard]);
          }}
        />
      )}

      {/* ── Card Detail Modal ── */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          boardId={activeBoardId}
          lists={lists}
          onClose={() => setSelectedCard(null)}
          onCardUpdated={() => {
            setSelectedCard(null);
            refetch();
          }}
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

// Shown instead of Timeline (a Pro feature) when there's no active Pro plan
// or trial. Note: this is a UI gate — Timeline data comes straight from
// Trello, so the backend can't enforce it.
function ProGate({ plan }) {
  if (plan.loading) {
    return (
      <div style={styles.centered}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Checking your plan…</p>
      </div>
    );
  }
  if (!plan.status && plan.error) {
    return (
      <div style={styles.centered}>
        <div style={styles.errorIcon}>⚠️</div>
        <h2 style={styles.emptyTitle}>Couldn't check your plan</h2>
        <p style={styles.emptyText}>
          TaskFlow's servers didn't respond. We'll keep retrying.
        </p>
        <button style={styles.gateBtn} onClick={plan.refresh}>
          Try again
        </button>
      </div>
    );
  }
  const hadTrial = !!plan.status?.trialEndsAt;
  return (
    <div style={styles.centered}>
      <div style={styles.lockCircle}>
        <Lock size={26} color="#93c5fd" />
      </div>
      <h2 style={styles.emptyTitle}>Timeline is a Pro feature</h2>
      <p style={{ ...styles.emptyText, maxWidth: 380 }}>
        {hadTrial ? "Your 7-day trial has ended. " : ""}
        Upgrade to Pro to unlock the Timeline view, deadline & progress
        tracking, and milestones.
      </p>
      <button
        style={styles.gateBtn}
        onClick={plan.openPricing}
        disabled={plan.waitingForPayment}
      >
        <Sparkles size={14} />
        {plan.waitingForPayment ? "Confirming payment…" : "Upgrade to Pro"}
      </button>
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
  lockCircle: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "rgba(59,130,246,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  gateBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 9,
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
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

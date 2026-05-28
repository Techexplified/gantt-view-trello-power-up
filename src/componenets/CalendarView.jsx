import React, { useRef, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import { updateCard } from "../utils/trelloApi";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Returns all calendar cells (including leading/trailing days to fill weeks)
function getCalendarDays(date) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const start = startOfWeek(monthStart);
  const end = endOfWeek(monthEnd);
  return eachDayOfInterval({ start, end });
}

// Given a card, return the date(s) it spans
function cardDates(card) {
  const start = card.start ? parseISO(card.start) : null;
  const due = card.due ? parseISO(card.due) : null;
  return { start, due };
}

// Check if a card falls on (or spans through) a given calendar day
function cardOnDay(card, day) {
  const { start, due } = cardDates(card);
  if (!start && !due) return false;
  if (start && due) {
    // spans a range
    return day >= start && day <= due;
  }
  if (due) return isSameDay(day, due);
  if (start) return isSameDay(day, start);
  return false;
}

// Determine if this day is the first day the card appears in the current view
function isCardStart(card, day) {
  const { start, due } = cardDates(card);
  if (start) return isSameDay(day, start);
  if (due) return isSameDay(day, due);
  return false;
}

const CARD_COLORS = [
  "#0079bf",
  "#00c2e0",
  "#00d084",
  "#ff9f1a",
  "#eb5a46",
  "#c377e0",
  "#ff78cb",
  "#61bd4f",
];

// Stable color per list id
function listColor(listId, lists) {
  const idx = lists.findIndex((l) => l.id === listId);
  return CARD_COLORS[idx % CARD_COLORS.length] || "#8b949e";
}

export default function CalendarView({
  cards = [],
  lists = [],
  onCardClick,
  onCardUpdated,
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const days = getCalendarDays(currentDate);
  const [dragging, setDragging] = useState(null);
  // dragging = { cardId, originalDue, currentDue }
  const [dragOverDay, setDragOverDay] = useState(null);
  const cellRefs = useRef({});

  const handleResizeDragStart = (e, card) => {
    e.stopPropagation();
    setDragging({
      cardId: card.id,
      originalDue: card.due,
      currentDue: card.due,
    });
    // Ghost image: invisible
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:fixed;top:-999px;";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDayDragOver = (e, day) => {
    e.preventDefault();
    if (!dragging) return;
    const key = format(day, "yyyy-MM-dd");
    if (dragOverDay !== key) setDragOverDay(key);
  };

  const handleDayDrop = async (e, day) => {
    e.preventDefault();
    if (!dragging) return;
    // Snap to end of the dropped day
    const snapped = new Date(day);
    snapped.setHours(23, 59, 0, 0);
    // Don't allow due before start
    const card = cards.find((c) => c.id === dragging.cardId);
    if (card?.start && snapped < new Date(card.start)) {
      setDragging(null);
      setDragOverDay(null);
      return;
    }
    setDragging(null);
    setDragOverDay(null);
    try {
      await updateCard(dragging.cardId, { due: snapped.toISOString() });
      onCardUpdated && onCardUpdated(dragging.cardId, snapped.toISOString());
    } catch (e) {
      console.error("Failed to update due date:", e);
    }
  };

  const handleDragEnd = () => {
    setDragging(null);
    setDragOverDay(null);
  };

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToday = () => setCurrentDate(new Date());

  // Map: day-string -> cards visible on that day
  const dayCardMap = {};
  days.forEach((day) => {
    const key = format(day, "yyyy-MM-dd");
    dayCardMap[key] = cards.filter((c) => cardOnDay(c, day));
  });

  return (
    <div style={styles.wrapper}>
      {/* ── Toolbar ── */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <button style={styles.navBtn} onClick={prevMonth}>
            ‹
          </button>
          <button style={styles.todayBtn} onClick={goToday}>
            Today
          </button>
          <button style={styles.navBtn} onClick={nextMonth}>
            ›
          </button>
          <span style={styles.monthLabel}>
            {format(currentDate, "MMMM yyyy")}
          </span>
        </div>
        <div style={styles.toolbarRight}>
          <span style={styles.viewLabel}>Month</span>
        </div>
      </div>

      {/* ── Day-of-week headers ── */}
      <div style={styles.dayHeaders}>
        {DAY_HEADERS.map((d) => (
          <div key={d} style={styles.dayHeader}>
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div style={styles.grid}>
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayCards = dayCardMap[key] || [];
          const inMonth = isSameMonth(day, currentDate);
          const todayDay = isToday(day);

          return (
            <div
              key={key}
              style={{
                ...styles.cell,
                ...(inMonth ? {} : styles.cellOut),
                ...(dragOverDay === key && dragging ? styles.cellDragOver : {}),
              }}
              onDragOver={(e) => handleDayDragOver(e, day)}
              onDrop={(e) => handleDayDrop(e, day)}
            >
              {/* Date number */}
              <div
                style={{
                  ...styles.dateNum,
                  ...(todayDay ? styles.todayNum : {}),
                }}
              >
                {format(day, "d")}
              </div>

              {/* Card pills — show up to 3, then "+N more" */}
              <div style={styles.cardPills}>
                {dayCards.slice(0, 3).map((card) => {
                  const color = listColor(card.idList, lists);
                  const isFirst = isCardStart(card, day);
                  return (
                    <div
                      key={card.id + key}
                      style={{
                        ...styles.pill,
                        background: color + "33",
                        borderLeft: `3px solid ${color}`,
                        opacity: isFirst ? 1 : 0.8,
                        position: "relative",
                        cursor: "default",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCardClick && onCardClick(card);
                      }}
                      title={card.name}
                    >
                      <span style={styles.pillText}>{card.name}</span>
                      {/* Resize handle — only on the last visible day of the card */}
                      {card.due && isSameDay(day, parseISO(card.due)) && (
                        <div
                          draggable
                          onDragStart={(e) => handleResizeDragStart(e, card)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => e.stopPropagation()}
                          style={styles.resizeHandle}
                          title="Drag to change due date"
                        />
                      )}
                    </div>
                  );
                })}
                {dayCards.length > 3 && (
                  <span style={styles.more}>+{dayCards.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#1a1f2e",
    minWidth: 0,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    overflowY: "auto",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "#1a1f2e",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  toolbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  navBtn: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#8b949e",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 16,
    cursor: "pointer",
    lineHeight: 1.2,
  },
  todayBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#c9d1d9",
    borderRadius: 6,
    padding: "4px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  monthLabel: {
    color: "#e6edf3",
    fontWeight: 700,
    fontSize: 16,
    marginLeft: 4,
  },
  viewLabel: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    padding: "4px 12px",
    color: "#8b949e",
    fontSize: 13,
  },
  dayHeaders: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  dayHeader: {
    padding: "8px 0",
    textAlign: "center",
    color: "#484f58",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    flex: 1,
  },
  cell: {
    borderRight: "1px solid rgba(255,255,255,0.05)",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    padding: "6px 8px",
    minHeight: 110,
    display: "flex",
    flexDirection: "column",
    gap: 3,
    cursor: "default",
    transition: "background 0.1s",
  },
  cellOut: {
    opacity: 0.35,
  },
  dateNum: {
    width: 26,
    height: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    color: "#8b949e",
    fontSize: 13,
    fontWeight: 500,
    flexShrink: 0,
    marginBottom: 2,
  },
  todayNum: {
    background: "#00d084",
    color: "#0d1117",
    fontWeight: 700,
  },
  cardPills: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
    overflow: "hidden",
  },
  pill: {
    borderRadius: 4,
    padding: "2px 6px",
    cursor: "pointer",
    overflow: "hidden",
    transition: "filter 0.15s",
  },
  pillText: {
    color: "#e6edf3",
    fontSize: 11,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "block",
  },
  more: {
    color: "#8b949e",
    fontSize: 10,
    paddingLeft: 4,
  },
  cellDragOver: {
    background: "rgba(0,208,132,0.08)",
    outline: "1px dashed rgba(0,208,132,0.4)",
  },
  resizeHandle: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 8,
    cursor: "col-resize",
    background: "rgba(255,255,255,0.25)",
    borderRadius: "0 4px 4px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

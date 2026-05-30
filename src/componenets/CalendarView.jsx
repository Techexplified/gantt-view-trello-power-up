import React, { useState, useRef, useCallback } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
  addMonths,
  subMonths,
  parseISO,
  differenceInCalendarDays,
  max,
  min,
} from "date-fns";
import { updateCard } from "../utils/trelloApi";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ROW_HEIGHT = 28; // px per card row inside a week
const CELL_MIN_H = 110; // min cell height
const CARD_GAP = 4; // px between card rows
const CARD_TOP_OFFSET = 32; // space for date number

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

function listColor(listId, lists) {
  const idx = lists.findIndex((l) => l.id === listId);
  return CARD_COLORS[idx % CARD_COLORS.length] || "#8b949e";
}

function getCalendarWeeks(date) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const start = startOfWeek(monthStart);
  const end = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start, end });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

// For each card, return the clamped start/end within a week row
function cardWeekSpan(card, weekDays) {
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  const cardStart = card.start
    ? parseISO(card.start)
    : card.due
      ? parseISO(card.due)
      : null;
  const cardEnd = card.due ? parseISO(card.due) : cardStart;
  if (!cardStart || !cardEnd) return null;

  // Does card overlap this week?
  if (cardEnd < weekStart || cardStart > weekEnd) return null;

  const clampedStart = max([cardStart, weekStart]);
  const clampedEnd = min([cardEnd, weekEnd]);

  const colStart = differenceInCalendarDays(clampedStart, weekStart); // 0-6
  const colEnd = differenceInCalendarDays(clampedEnd, weekStart); // 0-6

  const isFirstWeek = cardStart >= weekStart && cardStart <= weekEnd;
  const isLastWeek = cardEnd >= weekStart && cardEnd <= weekEnd;

  return { colStart, colEnd, isFirstWeek, isLastWeek };
}

// Layout cards into rows so overlapping cards don't collide
function layoutCards(cards, weekDays, lists) {
  const spans = cards
    .map((card) => {
      const span = cardWeekSpan(card, weekDays);
      if (!span) return null;
      return { card, ...span, color: listColor(card.idList, lists) };
    })
    .filter(Boolean);

  // Greedy row assignment
  const rows = []; // rows[i] = array of {colStart, colEnd} for occupied slots
  const assignments = spans.map((item) => {
    let row = 0;
    while (true) {
      if (!rows[row]) {
        rows[row] = [];
      }
      const conflict = rows[row].some(
        (slot) => !(item.colEnd < slot.colStart || item.colStart > slot.colEnd),
      );
      if (!conflict) {
        rows[row].push({ colStart: item.colStart, colEnd: item.colEnd });
        return { ...item, row };
      }
      row++;
    }
  });

  return assignments;
}

export default function CalendarView({
  cards = [],
  lists = [],
  onCardClick,
  onCardUpdated,
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const weeks = getCalendarWeeks(currentDate);

  // Drag state
  const [dragging, setDragging] = useState(null);
  // dragging = { cardId, originalDue, colStart }
  const [dragCol, setDragCol] = useState(null); // current column being hovered (0-6)
  const [dragWeekIdx, setDragWeekIdx] = useState(null);
  const gridRef = useRef(null);
  const draggingStarted = useRef(false);

  const prevMonth = () => setCurrentDate((d) => subMonths(d, 1));
  const nextMonth = () => setCurrentDate((d) => addMonths(d, 1));
  const goToday = () => setCurrentDate(new Date());

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const handleResizeDragStart = useCallback((e, card, weekIdx) => {
    e.stopPropagation();
    setDragging({ cardId: card.id, originalDue: card.due, card });
    setDragWeekIdx(weekIdx);
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:fixed;top:-999px;opacity:0;";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => {
      document.body.removeChild(ghost);
      draggingStarted.current = true; // ← ADD THIS
    }, 0);
  }, []);

  const handleCellDragOver = useCallback(
    (e, weekIdx, colIdx) => {
      e.preventDefault();
      if (!dragging) return;
      setDragWeekIdx(weekIdx);
      setDragCol(colIdx);
    },
    [dragging],
  );

  const handleCellDrop = useCallback(
    async (e, day) => {
      console.log("handleCellDrop line 1 🐳");
      e.preventDefault();
      console.log("handleCellDrop line 2 🐳");
      if (!dragging) return;
      console.log("handleCellDrop line 3 🐳");
      const snapped = new Date(day);
      snapped.setHours(23, 59, 0, 0);
      const card = dragging.card;
      if (card?.start && snapped < new Date(card.start)) {
        setDragging(null);
        setDragCol(null);
        setDragWeekIdx(null);
        return;
      }
      console.log("handleCellDrop line 4 🐳");
      const cardId = dragging.cardId;
      setDragging(null);
      setDragCol(null);
      setDragWeekIdx(null);
      try {
        console.log("handleCellDrop line 5 🐳");
        await updateCard(cardId, { due: snapped.toISOString() });
        console.log("handleCellDrop line 6 🐳");
        onCardUpdated && onCardUpdated(cardId, snapped.toISOString());
        console.log("handleCellDrop line 7 🐳");
      } catch (err) {
        console.log("handleCellDrop line 8 🐳");
        console.error("Failed to update due date:", err);
      }
    },
    [dragging, onCardUpdated],
  );

  const handleDragEnd = useCallback(() => {
    draggingStarted.current = false; // ← ADD THIS
    setDragging(null);
    setDragCol(null);
    setDragWeekIdx(null);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={s.wrapper}>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <div style={s.toolbarLeft}>
          <button style={s.navBtn} onClick={prevMonth}>
            ‹
          </button>
          <button style={s.todayBtn} onClick={goToday}>
            Today
          </button>
          <button style={s.navBtn} onClick={nextMonth}>
            ›
          </button>
          <span style={s.monthLabel}>{format(currentDate, "MMMM yyyy")}</span>
        </div>
        <span style={s.viewLabel}>Month</span>
      </div>

      {/* Day headers */}
      <div style={s.dayHeaders}>
        {DAY_HEADERS.map((d) => (
          <div key={d} style={s.dayHeader}>
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div ref={gridRef} style={s.grid}>
        {weeks.map((weekDays, weekIdx) => {
          const laid = layoutCards(cards, weekDays, lists);
          const maxRow = laid.length ? Math.max(...laid.map((l) => l.row)) : -1;
          const rowsNeeded = maxRow + 1;
          const cellH = Math.max(
            CELL_MIN_H,
            CARD_TOP_OFFSET + rowsNeeded * (ROW_HEIGHT + CARD_GAP) + 8,
          );

          return (
            <div key={weekIdx} style={{ ...s.weekRow, height: cellH }}>
              {/* Day cells (background + date numbers + drop targets) */}
              {weekDays.map((day, colIdx) => {
                const key = format(day, "yyyy-MM-dd");
                const inMonth = isSameMonth(day, currentDate);
                const today = isToday(day);
                const isDragTarget =
                  dragging && dragWeekIdx === weekIdx && dragCol === colIdx;

                return (
                  <div
                    key={key}
                    style={{
                      ...s.cell,
                      ...(inMonth ? {} : s.cellOut),
                      ...(isDragTarget ? s.cellDragOver : {}),
                      height: cellH,
                    }}
                    onDragOver={(e) => handleCellDragOver(e, weekIdx, colIdx)}
                    onDrop={(e) => {
                      console.log("handleCellDrop 🐳");
                      handleCellDrop(e, day);
                    }}
                  >
                    <div style={{ ...s.dateNum, ...(today ? s.todayNum : {}) }}>
                      {format(day, "d")}
                    </div>
                  </div>
                );
              })}

              {/* Card bars — absolutely positioned across columns */}
              {laid.map(
                ({
                  card,
                  colStart,
                  colEnd,
                  isFirstWeek,
                  isLastWeek,
                  row,
                  color,
                }) => {
                  const isDraggingThis = dragging?.cardId === card.id;
                  // If dragging, preview new colEnd
                  let previewColEnd = colEnd;
                  if (
                    isDraggingThis &&
                    dragWeekIdx === weekIdx &&
                    dragCol !== null
                  ) {
                    previewColEnd = Math.max(colStart, dragCol);
                  }

                  const left = `calc(${colStart} * (100% / 7))`;
                  const width = `calc(${previewColEnd - colStart + 1} * (100% / 7) - 4px)`;
                  const top = CARD_TOP_OFFSET + row * (ROW_HEIGHT + CARD_GAP);

                  return (
                    <div
                      key={card.id + "-" + weekIdx}
                      style={{
                        ...s.bar,
                        left,
                        width,
                        top,
                        height: ROW_HEIGHT,
                        background: color + "33",
                        borderLeft: isFirstWeek ? `3px solid ${color}` : "none",
                        borderRight: isLastWeek
                          ? `1px solid ${color}44`
                          : "none",
                        borderRadius: `${isFirstWeek ? "5px" : "0"} ${isLastWeek ? "5px" : "0"} ${isLastWeek ? "5px" : "0"} ${isFirstWeek ? "5px" : "0"}`,
                        opacity: isDraggingThis ? 0.6 : 1,
                        transition: isDraggingThis ? "none" : "opacity 0.15s",
                        pointerEvents:
                          dragging && draggingStarted.current && !isDraggingThis
                            ? "none"
                            : "auto",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCardClick && onCardClick(card);
                      }}
                      title={card.name}
                    >
                      <span style={s.barText}>{card.name}</span>

                      {/* Resize handle — only on last week segment, last col of bar */}
                      {isLastWeek && (
                        <div
                          draggable
                          onDragStart={(e) =>
                            handleResizeDragStart(e, card, weekIdx)
                          }
                          onDragEnd={handleDragEnd}
                          onClick={(e) => e.stopPropagation()}
                          style={s.resizeHandle}
                          title="Drag to change due date"
                        >
                          <div style={s.resizeGrip} />
                        </div>
                      )}
                    </div>
                  );
                },
              )}

              {/* "+N more" overflow indicator per day */}
              {weekDays.map((day, colIdx) => {
                const key = format(day, "yyyy-MM-dd");
                const visibleRows = Math.floor(
                  (cellH - CARD_TOP_OFFSET - 8) / (ROW_HEIGHT + CARD_GAP),
                );
                const dayCards = laid.filter(
                  (l) => colIdx >= l.colStart && colIdx <= l.colEnd,
                );
                const hidden = dayCards.filter(
                  (l) => l.row >= visibleRows,
                ).length;
                if (hidden === 0) return null;
                return (
                  <div
                    key={"more-" + key}
                    style={{
                      position: "absolute",
                      left: `calc(${colIdx} * (100% / 7) + 4px)`,
                      top:
                        CARD_TOP_OFFSET + visibleRows * (ROW_HEIGHT + CARD_GAP),
                      fontSize: 10,
                      color: "#8b949e",
                    }}
                  >
                    +{hidden} more
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  wrapper: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#1a1f2e",
    minWidth: 0,
    overflowX: "hidden",
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
  toolbarLeft: { display: "flex", alignItems: "center", gap: 8 },
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
  grid: { flex: 1, display: "flex", flexDirection: "column" },
  weekRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    position: "relative", // so bars can be absolutely positioned
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  cell: {
    borderRight: "1px solid rgba(255,255,255,0.05)",
    padding: "6px 8px",
    position: "relative",
    transition: "background 0.1s",
  },
  cellOut: { opacity: 0.35 },
  cellDragOver: {
    background: "rgba(0,208,132,0.08)",
    outline: "1px dashed rgba(0,208,132,0.4)",
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
  },
  todayNum: { background: "#00d084", color: "#0d1117", fontWeight: 700 },
  // Card bar
  bar: {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    paddingLeft: 6,
    paddingRight: 20, // leave room for resize handle
    cursor: "pointer",
    overflow: "hidden",
    userSelect: "none",
    zIndex: 2,
  },
  barText: {
    color: "#e6edf3",
    fontSize: 11,
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    flex: 1,
  },
  resizeHandle: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 14,
    cursor: "col-resize",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.1)",
    borderRadius: "0 4px 4px 0",
    zIndex: 3,
  },
  resizeGrip: {
    width: 2,
    height: 12,
    background: "rgba(255,255,255,0.5)",
    borderRadius: 2,
    boxShadow: "3px 0 0 rgba(255,255,255,0.3)",
  },
};

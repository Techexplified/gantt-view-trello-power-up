import React, { useState } from "react";
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
  differenceInCalendarDays,
} from "date-fns";
import { updateCard } from "../utils/trelloApi";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getCalendarDays(date) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const start = startOfWeek(monthStart);
  const end = endOfWeek(monthEnd);
  return eachDayOfInterval({ start, end });
}

function cardDates(card) {
  const start = card.start ? parseISO(card.start) : null;
  const due = card.due ? parseISO(card.due) : null;
  return { start, due };
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

function listColor(listId, lists) {
  const idx = lists.findIndex((l) => l.id === listId);
  return CARD_COLORS[idx % CARD_COLORS.length] || "#8b949e";
}

/**
 * Split a card's date range into per-week segments so it can span
 * across grid rows without breaking.
 * Returns an array of { card, startCol (0-6), span, weekIndex, isFirst, isLast }
 */
function getCardSegments(card, weeks) {
  const { start, due } = cardDates(card);
  if (!start && !due) return [];

  const cardStart = start || due;
  const cardEnd = due || start;

  const segments = [];

  weeks.forEach((week, weekIndex) => {
    const weekStart = week[0];
    const weekEnd = week[6];

    // Does this card overlap this week?
    if (cardEnd < weekStart || cardStart > weekEnd) return;

    const segStart = cardStart < weekStart ? weekStart : cardStart;
    const segEnd = cardEnd > weekEnd ? weekEnd : cardEnd;

    const startCol = differenceInCalendarDays(segStart, weekStart);
    const span = differenceInCalendarDays(segEnd, segStart) + 1;
    const isFirst = isSameDay(segStart, cardStart);
    const isLast = isSameDay(segEnd, cardEnd);

    segments.push({ card, startCol, span, weekIndex, isFirst, isLast });
  });

  return segments;
}

/**
 * For each week, assign a "lane" (row) to each segment so they don't overlap.
 * Returns a map: weekIndex -> list of { segment, lane }
 */
function assignLanes(allSegments) {
  // Group by weekIndex
  const byWeek = {};
  allSegments.forEach((seg) => {
    if (!byWeek[seg.weekIndex]) byWeek[seg.weekIndex] = [];
    byWeek[seg.weekIndex].push(seg);
  });

  // For each week, greedily assign lanes
  const result = {}; // weekIndex -> [{ segment, lane }]
  Object.entries(byWeek).forEach(([weekIndex, segs]) => {
    const lanes = []; // lanes[lane] = last endCol used
    const assigned = segs.map((seg) => {
      let lane = lanes.findIndex((endCol) => endCol < seg.startCol);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(0);
      }
      lanes[lane] = seg.startCol + seg.span - 1;
      return { segment: seg, lane };
    });
    result[weekIndex] = assigned;
  });

  return result;
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
  const [dragOverDay, setDragOverDay] = useState(null);

  // Split days into weeks (rows of 7)
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // Compute all segments and lane assignments
  const allSegments = cards.flatMap((card) => getCardSegments(card, weeks));
  const laneAssignments = assignLanes(allSegments);

  // Max lanes per week (for cell min-height calculation)
  const maxLanesPerWeek = weeks.map((_, wi) => {
    const assigned = laneAssignments[wi] || [];
    return assigned.length > 0
      ? Math.max(...assigned.map((a) => a.lane)) + 1
      : 0;
  });

  const handleResizeDragStart = (e, card) => {
    e.stopPropagation();
    setDragging({
      cardId: card.id,
      originalDue: card.due,
      currentDue: card.due,
    });
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
    const snapped = new Date(day);
    snapped.setHours(23, 59, 0, 0);
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

  const LANE_H = 22; // height of one card bar (px)
  const LANE_GAP = 3; // gap between lanes (px)
  const DATE_NUM_H = 30; // space reserved for date number at top of row
  const ROW_PADDING_BOTTOM = 6;

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

      {/* ── Calendar: one <div> per week row ── */}
      <div style={styles.calendarBody}>
        {weeks.map((week, weekIndex) => {
          const numLanes = maxLanesPerWeek[weekIndex] || 0;
          const rowHeight =
            DATE_NUM_H + numLanes * (LANE_H + LANE_GAP) + ROW_PADDING_BOTTOM;
          const weekAssigned = laneAssignments[weekIndex] || [];

          return (
            <div
              key={weekIndex}
              style={{ ...styles.weekRow, minHeight: Math.max(rowHeight, 80) }}
            >
              {/* ── 7 day-cell backgrounds ── */}
              <div style={styles.dayCellsLayer}>
                {week.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const inMonth = isSameMonth(day, currentDate);
                  const todayDay = isToday(day);
                  return (
                    <div
                      key={key}
                      style={{
                        ...styles.cell,
                        ...(inMonth ? {} : styles.cellOut),
                        ...(dragOverDay === key && dragging
                          ? styles.cellDragOver
                          : {}),
                      }}
                      onDragOver={(e) => handleDayDragOver(e, day)}
                      onDrop={(e) => handleDayDrop(e, day)}
                    >
                      <div
                        style={{
                          ...styles.dateNum,
                          ...(todayDay ? styles.todayNum : {}),
                        }}
                      >
                        {format(day, "d")}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Spanning card bars overlay ── */}
              <div style={styles.barsLayer}>
                {weekAssigned.map(({ segment, lane }) => {
                  const { card, startCol, span, isFirst, isLast } = segment;
                  const color = listColor(card.idList, lists);

                  // Position: left is startCol/7 of width, width is span/7
                  const leftPct = (startCol / 7) * 100;
                  const widthPct = (span / 7) * 100;
                  const top = DATE_NUM_H + lane * (LANE_H + LANE_GAP);

                  return (
                    <div
                      key={card.id + "-" + weekIndex + "-" + lane}
                      style={{
                        position: "absolute",
                        left: `calc(${leftPct}% + ${isFirst ? 3 : 0}px)`,
                        width: `calc(${widthPct}% - ${isFirst ? 3 : 0}px - ${isLast ? 5 : 0}px)`,
                        top: top,
                        height: LANE_H,
                        background: color + "33",
                        borderLeft: isFirst ? `3px solid ${color}` : "none",
                        borderRight: "none",
                        borderRadius:
                          isFirst && isLast
                            ? 4
                            : isFirst
                              ? "4px 0 0 4px"
                              : isLast
                                ? "0 4px 4px 0"
                                : 0,
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: isFirst ? 5 : 3,
                        paddingRight: isLast ? 14 : 3,
                        cursor: "pointer",
                        overflow: "hidden",
                        boxSizing: "border-box",
                        zIndex: 2,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCardClick && onCardClick(card);
                      }}
                      title={card.name}
                    >
                      {/* Only show label text on the first segment */}
                      {isFirst && (
                        <span style={styles.pillText}>{card.name}</span>
                      )}

                      {/* Resize handle — only on last segment */}
                      {isLast && card.due && (
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
  toolbarLeft: { display: "flex", alignItems: "center", gap: 8 },
  toolbarRight: { display: "flex", alignItems: "center", gap: 8 },
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
  calendarBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  weekRow: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  dayCellsLayer: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    position: "absolute",
    inset: 0,
  },
  cell: {
    borderRight: "1px solid rgba(255,255,255,0.05)",
    padding: "6px 8px",
    display: "flex",
    flexDirection: "column",
    cursor: "default",
    transition: "background 0.1s",
    height: "100%",
    boxSizing: "border-box",
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
    flexShrink: 0,
  },
  todayNum: {
    background: "#00d084",
    color: "#0d1117",
    fontWeight: 700,
  },
  barsLayer: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none", // let clicks fall through to day cells by default
  },
  pillText: {
    color: "#e6edf3",
    fontSize: 11,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    flex: 1,
    pointerEvents: "none",
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
    pointerEvents: "all",
  },
};

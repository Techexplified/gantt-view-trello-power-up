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
  differenceInCalendarDays,
} from "date-fns";
import { createCardWithDates, updateCard } from "../utils/trelloApi";
import { X } from "lucide-react";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getCalendarDays(date) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const start = startOfWeek(monthStart);
  const end = endOfWeek(monthEnd);
  return eachDayOfInterval({ start, end });
}

function toLocalMidnight(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function cardDates(card) {
  const start = card.start ? toLocalMidnight(parseISO(card.start)) : null;
  const due = card.due ? toLocalMidnight(parseISO(card.due)) : null;
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
  onCardCreated,
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const days = getCalendarDays(currentDate);
  const [dragging, setDragging] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [hoveredCardKey, setHoveredCardKey] = useState(null);
  const [dragPreviewDue, setDragPreviewDue] = useState(null);
  const [createCardPopup, setCreateCardPopup] = useState(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [selectedListId, setSelectedListId] = useState("");
  const lastDragKey = useRef(null);

  // Split days into weeks (rows of 7)
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // Compute all segments and lane assignments
  const allSegments = cards.flatMap((card) => {
    // If this card is being resize-dragged, use the preview due date
    const previewCard =
      dragPreviewDue && dragPreviewDue.cardId === card.id
        ? {
            ...card,
            due: format(dragPreviewDue.dueDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
          }
        : card;
    return getCardSegments(previewCard, weeks);
  });
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
    const key = format(day, "yyyy-MM-dd");
    if (lastDragKey.current === key) return;
    lastDragKey.current = key;
    setDragOverDay(key);

    // ← add this: live preview for resize drag
    if (dragging) {
      setDragPreviewDue({ cardId: dragging.cardId, dueDate: day });
    }
  };

  const handleDayDrop = async (e, day) => {
    e.preventDefault();

    // ── Drop from RightPanel ──────────────────────────────
    const externalCardId = e.dataTransfer.getData("cardId");
    if (externalCardId) {
      const snapped = new Date(day);
      snapped.setHours(23, 59, 0, 0);
      const isoDate = snapped.toISOString();
      try {
        await updateCard(externalCardId, {
          start: isoDate,
          due: isoDate,
        });
        onCardUpdated && onCardUpdated(externalCardId, isoDate, isoDate);
      } catch (err) {
        console.error("Failed to set dates on drop:", err);
      }
      lastDragKey.current = null;
      return; // don't fall through to resize logic
    }
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
    setDragPreviewDue(null); // ← add
    lastDragKey.current = null;
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
    setDragPreviewDue(null); // ← add
    lastDragKey.current = null;
  };

  const handleCreateCard = async () => {
    if (!newCardTitle.trim()) return;

    const clickedDay = new Date(createCardPopup.day);

    clickedDay.setHours(23, 59, 0, 0);

    try {
      const card = await createCardWithDates(
        selectedListId,
        newCardTitle.trim(),
        clickedDay.toISOString(),
        clickedDay.toISOString(),
      );

      onCardCreated?.(card);

      setCreateCardPopup(null);
      setNewCardTitle("");
    } catch (err) {
      console.error(err);
    }
  };

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

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
          <span style={styles.monthLabel}>
            {format(currentDate, "MMMM yyyy")}
          </span>
          <button style={styles.navBtn} onClick={nextMonth}>
            ›
          </button>
        </div>
        <div />
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
                        ...(dragOverDay === key ? styles.cellDragOver : {}),
                      }}
                      onClick={(e) => {
                        if (dragging) return;

                        setCreateCardPopup({
                          x: e.clientX,
                          y: e.clientY,
                          day,
                        });

                        setSelectedListId(lists?.[0]?.id || "");
                        setNewCardTitle("");
                      }}
                      onDragOver={(e) => handleDayDragOver(e, day)}
                      onDrop={(e) => handleDayDrop(e, day)}
                      onDragLeave={() => setDragOverDay(null)}
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

                  const cardKey = card.id + "-" + weekIndex + "-" + lane;
                  const isHovered = hoveredCardKey === cardKey;

                  return (
                    <div
                      key={card.id + "-" + weekIndex + "-" + lane}
                      style={{
                        position: "absolute",
                        left: `calc(${leftPct}% + ${isFirst ? 3 : 0}px)`,
                        width: `calc(${widthPct}% - ${isFirst ? 3 : 0}px - ${isLast ? 5 : 0}px)`,
                        top: top,
                        height: LANE_H,
                        background: isHovered ? color + "55" : color + "33",
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
                        pointerEvents: dragging ? "none" : "all",
                      }}
                      className="hover:brightness-125 hover:shadow-md transition-all duration-150"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCardClick && onCardClick(card);
                      }}
                      onMouseEnter={() => setHoveredCardKey(cardKey)}
                      onMouseLeave={() => setHoveredCardKey(null)}
                      title={card.name}
                    >
                      {/* Only show label text on the first segment */}
                      <span style={styles.pillText}>{card.name}</span>

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
      {createCardPopup &&
        (() => {
          const POPUP_W = 288; // w-72 = 18rem = 288px
          const POPUP_H = 184; // approximate popup height
          const MARGIN = 8; // keep away from edges
          const rawX = createCardPopup.x;
          const rawY = createCardPopup.y;
          const left = Math.min(rawX, window.innerWidth - POPUP_W - MARGIN);
          const top =
            rawY + POPUP_H + MARGIN > window.innerHeight
              ? rawY - POPUP_H // flip above the click point
              : rawY;
          return (
            <div
              className="fixed inset-0 z-[9999]"
              onClick={() => setCreateCardPopup(null)}
            >
              <div
                className="absolute w-72 rounded-xl border border-white/10 bg-[#161b27] shadow-2xl"
                style={{ left, top }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header row with X button */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <span className="text-sm font-semibold text-[#e6edf3]">
                    New Card
                  </span>
                  <button
                    onClick={() => setCreateCardPopup(null)}
                    className="text-[#8b949e] hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
                {/* Body */}
                <div className="px-4 pb-4 flex flex-col gap-3">
                  <input
                    autoFocus
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateCard();
                      if (e.key === "Escape") setCreateCardPopup(null);
                    }}
                    placeholder="Enter card title..."
                    className="w-full rounded-lg border border-[#00d084] bg-[#1e2432] px-3 py-2 text-sm text-white outline-none placeholder:text-[#484f58]"
                  />
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#1e2432] px-3 py-2 text-sm text-white outline-none"
                  >
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleCreateCard}
                    className="w-full rounded-lg bg-[#00d084] py-2 text-sm font-bold text-[#0d1117] hover:brightness-110"
                  >
                    Add card
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
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
  monthLabel: {
    color: "#e6edf3",
    fontWeight: 700,
    fontSize: 16,
    marginLeft: 4,
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

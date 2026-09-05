import React, { useEffect, useMemo, useState } from "react";
import {
  addDays,
  format,
  isToday,
  startOfDay,
  differenceInCalendarDays,
} from "date-fns";
import { getCard } from "../utils/trelloApi";

const WINDOW_DAYS = 30;

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
 * Status is derived (no native Trello field for this):
 *  - "completed": card has a checklist and every item is checked off
 *  - "at-risk": due date has already passed, OR due within 2 days
 *               with checklist still incomplete
 *  - "on-track": everything else
 */
function getStatus(card, progress) {
  const total = progress?.total ?? 0;
  const done = progress?.done ?? 0;
  const today = startOfDay(new Date());

  if (total > 0 && done === total) return "completed";

  if (card.due) {
    const due = startOfDay(new Date(card.due));
    const daysLeft = differenceInCalendarDays(due, today);
    if (daysLeft < 0) return "at-risk";
    if (daysLeft <= 2 && done < total) return "at-risk";
  }
  return "on-track";
}

const STATUS_META = {
  "on-track": {
    label: "On track",
    icon: "✓",
    color: "#58a6ff",
    bg: "rgba(0,121,191,0.15)",
    border: "rgba(0,121,191,0.4)",
  },
  "at-risk": {
    label: "At risk",
    icon: "⚠",
    color: "#ff9f1a",
    bg: "rgba(255,159,26,0.15)",
    border: "rgba(255,159,26,0.4)",
  },
  completed: {
    label: "Completed",
    icon: "✓",
    color: "#61bd4f",
    bg: "rgba(97,189,79,0.15)",
    border: "rgba(97,189,79,0.4)",
  },
};

export default function TimelineView({ cards = [], lists = [], onCardClick }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const days = useMemo(
    () => Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(today, i)),
    [today],
  );

  // Only cards with a due date are shown on the timeline.
  const timelineCards = useMemo(
    () =>
      cards
        .filter((c) => !!c.due)
        .slice()
        .sort((a, b) => new Date(a.due) - new Date(b.due)),
    [cards],
  );

  const cardIdsKey = timelineCards.map((c) => c.id).join(",");
  const [progressMap, setProgressMap] = useState({});

  // Fetch checklist completion per card so status can be derived.
  useEffect(() => {
    let cancelled = false;
    if (timelineCards.length === 0) {
      setProgressMap({});
      return;
    }
    Promise.all(
      timelineCards.map((c) =>
        getCard(c.id)
          .then((full) => {
            const items = (full.checklists || []).flatMap(
              (cl) => cl.checkItems || [],
            );
            return [
              c.id,
              {
                total: items.length,
                done: items.filter((i) => i.state === "complete").length,
              },
            ];
          })
          .catch(() => [c.id, { total: 0, done: 0 }]),
      ),
    ).then((entries) => {
      if (!cancelled) setProgressMap(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardIdsKey]);

  const ROW_H = 46;
  const MIN_WIDTH_PCT = 100 / WINDOW_DAYS;

  return (
    <div style={styles.wrapper}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.title}>Timeline</span>
          <span style={styles.subtitle}>
            {format(today, "MMM d")} –{" "}
            {format(addDays(today, WINDOW_DAYS - 1), "MMM d, yyyy")}
          </span>
        </div>
        <span style={styles.countBadge}>
          {timelineCards.length} card{timelineCards.length !== 1 ? "s" : ""}{" "}
          with due dates
        </span>
      </div>

      {timelineCards.length === 0 ? (
        <div style={styles.emptyWrap}>
          <div style={styles.emptyIcon}>🗓️</div>
          <h3 style={styles.emptyTitle}>No cards with due dates</h3>
          <p style={styles.emptyText}>
            Add a due date to a card to see it show up here.
          </p>
        </div>
      ) : (
        <div style={styles.scrollArea}>
          {/* Header row */}
          <div style={{ ...styles.row, ...styles.headerRow }}>
            <div style={styles.leftHeaderCell}>Card</div>
            <div style={styles.rightCell}>
              <div
                style={{
                  ...styles.dayGrid,
                  gridTemplateColumns: `repeat(${WINDOW_DAYS}, 1fr)`,
                }}
              >
                {days.map((d) => {
                  const todayCol = isToday(d);
                  const isMonthStart = d.getDate() === 1;
                  return (
                    <div
                      key={d.toISOString()}
                      style={{
                        ...styles.dayHeaderCell,
                        ...(todayCol ? styles.dayHeaderCellToday : {}),
                        ...(isMonthStart ? styles.monthBorder : {}),
                      }}
                    >
                      {isMonthStart && (
                        <span style={styles.monthLabel}>
                          {format(d, "MMM")}
                        </span>
                      )}
                      <span style={styles.dayLetter}>
                        {format(d, "EEEEE")}
                      </span>
                      <span style={styles.dayNum}>{format(d, "d")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card rows */}
          {timelineCards.map((card) => {
            const color = listColor(card.idList, lists);
            const progress = progressMap[card.id];
            const status = getStatus(card, progress);
            const meta = STATUS_META[status];

            const dueDate = startOfDay(new Date(card.due));
            const startDate = card.start
              ? startOfDay(new Date(card.start))
              : dueDate;

            const rawStartOffset = differenceInCalendarDays(startDate, today);
            const rawEndOffsetExclusive =
              differenceInCalendarDays(dueDate, today) + 1;

            const isOverdue = rawEndOffsetExclusive <= 0;
            const isFuture = rawStartOffset >= WINDOW_DAYS;

            const startOffset = Math.max(
              0,
              Math.min(WINDOW_DAYS, rawStartOffset),
            );
            const endOffset = Math.max(
              0,
              Math.min(WINDOW_DAYS, rawEndOffsetExclusive),
            );

            const leftPct = (startOffset / WINDOW_DAYS) * 100;
            const widthPct = Math.max(
              ((endOffset - startOffset) / WINDOW_DAYS) * 100,
              MIN_WIDTH_PCT,
            );

            return (
              <div key={card.id} style={{ ...styles.row, minHeight: ROW_H }}>
                {/* ── Left: card info ── */}
                <div
                  style={styles.leftCell}
                  className="hover:bg-white/5 transition-colors duration-150"
                  onClick={() => onCardClick && onCardClick(card)}
                >
                  <span style={{ ...styles.listDot, background: color }} />
                  <div style={styles.leftCellText}>
                    <span style={styles.cardName} title={card.name}>
                      {card.name}
                    </span>
                    <span style={styles.dueText}>
                      Due {format(new Date(card.due), "MMM d")}
                      {card.start &&
                        ` · Start ${format(new Date(card.start), "MMM d")}`}
                    </span>
                  </div>
                  <span
                    style={{
                      ...styles.statusBadge,
                      color: meta.color,
                      background: meta.bg,
                      border: `1px solid ${meta.border}`,
                    }}
                  >
                    {meta.icon} {meta.label}
                  </span>
                </div>

                {/* ── Right: timeline bar ── */}
                <div style={styles.rightCell}>
                  <div
                    style={{
                      ...styles.dayGrid,
                      gridTemplateColumns: `repeat(${WINDOW_DAYS}, 1fr)`,
                      position: "absolute",
                      inset: 0,
                    }}
                  >
                    {days.map((d) => (
                      <div
                        key={d.toISOString()}
                        style={{
                          ...styles.dayBodyCell,
                          ...(isToday(d) ? styles.dayBodyCellToday : {}),
                        }}
                      />
                    ))}
                  </div>

                  {isOverdue ? (
                    <div
                      style={{
                        ...styles.edgeChip,
                        left: 6,
                        borderColor: meta.color,
                        color: meta.color,
                      }}
                      onClick={() => onCardClick && onCardClick(card)}
                      title={`Overdue since ${format(new Date(card.due), "MMM d, yyyy")}`}
                    >
                      ◀ Overdue
                    </div>
                  ) : isFuture ? (
                    <div
                      style={{
                        ...styles.edgeChip,
                        right: 6,
                        borderColor: color,
                        color,
                      }}
                      onClick={() => onCardClick && onCardClick(card)}
                      title={`Starts ${format(startDate, "MMM d, yyyy")}`}
                    >
                      Starts {format(startDate, "MMM d")} ▶
                    </div>
                  ) : (
                    <div
                      style={{
                        ...styles.bar,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        background: color + "33",
                        borderLeft: `3px solid ${color}`,
                      }}
                      className="hover:brightness-125 transition-all duration-150"
                      onClick={() => onCardClick && onCardClick(card)}
                      title={card.name}
                    >
                      <span style={styles.barText}>{card.name}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
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
    overflow: "hidden",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "#1a1f2e",
  },
  toolbarLeft: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
  },
  title: {
    color: "#e6edf3",
    fontWeight: 700,
    fontSize: 16,
  },
  subtitle: {
    color: "#8b949e",
    fontSize: 12,
  },
  countBadge: {
    background: "rgba(255,255,255,0.07)",
    color: "#8b949e",
    fontSize: 11,
    borderRadius: 20,
    padding: "3px 10px",
  },
  scrollArea: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
  },
  row: {
    display: "flex",
    flexDirection: "row",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  headerRow: {
    position: "sticky",
    top: 0,
    zIndex: 5,
    background: "#1a1f2e",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  leftHeaderCell: {
    width: 300,
    minWidth: 300,
    flexShrink: 0,
    padding: "10px 16px",
    color: "#484f58",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    borderRight: "1px solid rgba(255,255,255,0.07)",
  },
  leftCell: {
    width: 300,
    minWidth: 300,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 16px",
    borderRight: "1px solid rgba(255,255,255,0.07)",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  listDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  leftCellText: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    flex: 1,
  },
  cardName: {
    color: "#e6edf3",
    fontSize: 12.5,
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  dueText: {
    color: "#8b949e",
    fontSize: 10.5,
    marginTop: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  statusBadge: {
    fontSize: 9.5,
    fontWeight: 600,
    borderRadius: 20,
    padding: "2px 7px",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  rightCell: {
    flex: 1,
    position: "relative",
    minHeight: "100%",
  },
  dayGrid: {
    display: "grid",
    width: "100%",
    height: "100%",
  },
  dayHeaderCell: {
    position: "relative",
    padding: "6px 0 4px",
    textAlign: "center",
    borderRight: "1px solid rgba(255,255,255,0.04)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
  },
  dayHeaderCellToday: {
    background: "rgba(0,208,132,0.08)",
  },
  monthBorder: {
    borderLeft: "1px solid rgba(255,255,255,0.15)",
  },
  monthLabel: {
    position: "absolute",
    top: -14,
    left: 2,
    fontSize: 9,
    color: "#00d084",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  dayLetter: {
    color: "#484f58",
    fontSize: 9,
    textTransform: "uppercase",
  },
  dayNum: {
    color: "#8b949e",
    fontSize: 11,
    fontWeight: 600,
  },
  dayBodyCell: {
    borderRight: "1px solid rgba(255,255,255,0.04)",
    height: "100%",
  },
  dayBodyCellToday: {
    background: "rgba(0,208,132,0.06)",
  },
  bar: {
    position: "absolute",
    top: 8,
    height: 30,
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    paddingLeft: 8,
    paddingRight: 6,
    cursor: "pointer",
    overflow: "hidden",
    boxSizing: "border-box",
    zIndex: 2,
  },
  barText: {
    color: "#e6edf3",
    fontSize: 11,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    pointerEvents: "none",
  },
  edgeChip: {
    position: "absolute",
    top: 10,
    height: 26,
    display: "flex",
    alignItems: "center",
    padding: "0 8px",
    fontSize: 10.5,
    fontWeight: 600,
    borderRadius: 20,
    border: "1px dashed",
    background: "rgba(255,255,255,0.04)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    zIndex: 2,
  },
  emptyWrap: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 40,
  },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: 0 },
  emptyText: { color: "#8b949e", fontSize: 13, margin: 0, textAlign: "center" },
};

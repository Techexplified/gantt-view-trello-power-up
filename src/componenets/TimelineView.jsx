import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addDays,
  format,
  isToday,
  startOfDay,
  differenceInCalendarDays,
} from "date-fns";
import { getCard } from "../utils/trelloApi";

// Initial window: some days behind "today" already loaded so scrolling back
// feels instant, plus a chunk ahead. Both directions grow automatically
// as the user scrolls near either edge.
const INITIAL_DAYS_BACK = 15;
const INITIAL_DAYS_FORWARD = 45;
const CHUNK_DAYS = 15; // how many extra days to load per edge-trigger
const MAX_DAYS_BACK = 120;
const MAX_DAYS_FORWARD = 180;
const EDGE_PX = 120; // trigger loading more when within this many px of an edge

const DEFAULT_VISIBLE_DAYS = 10;
const MIN_VISIBLE_DAYS = 3;
const MAX_VISIBLE_DAYS = 25;

const LEFT_WIDTH = 300;
const HEADER_H = 40;
const ROW_H = 46;
const BG = "#1a1f2e";

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

  const [daysBack, setDaysBack] = useState(INITIAL_DAYS_BACK);
  const [daysForward, setDaysForward] = useState(INITIAL_DAYS_FORWARD);
  const [visibleDays, setVisibleDays] = useState(DEFAULT_VISIBLE_DAYS);

  const totalDays = daysBack + daysForward;
  const rangeStart = useMemo(
    () => addDays(today, -daysBack),
    [today, daysBack],
  );
  const days = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i)),
    [rangeStart, totalDays],
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

  // ── Single scroll container for everything. The card-name column is kept
  // in place with CSS `position: sticky` instead of a second, separately
  // scrolled element — that's what previously let the two panes drift out
  // of sync. With one scroll position, there's nothing left to desync. ──
  const scrollRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const availableWidth = Math.max(containerWidth - LEFT_WIDTH, 0);
  const timelineWidthPx =
    visibleDays > 0 ? (availableWidth * totalDays) / visibleDays : 0;
  const minBarWidthPx = timelineWidthPx / totalDays || 0;

  const pendingExtend = useRef(null); // "back" | "forward" | null
  const prevScrollWidth = useRef(0);
  const pendingZoomFrom = useRef(null); // previous visibleDays while a zoom is settling
  const didInitScroll = useRef(false);

  const handleScroll = (e) => {
    const el = e.target;
    if (!pendingExtend.current) {
      if (el.scrollLeft < EDGE_PX && daysBack < MAX_DAYS_BACK) {
        pendingExtend.current = "back";
        prevScrollWidth.current = el.scrollWidth;
        setDaysBack((d) => Math.min(MAX_DAYS_BACK, d + CHUNK_DAYS));
      } else if (
        el.scrollWidth - el.scrollLeft - el.clientWidth < EDGE_PX &&
        daysForward < MAX_DAYS_FORWARD
      ) {
        pendingExtend.current = "forward";
        setDaysForward((d) => Math.min(MAX_DAYS_FORWARD, d + CHUNK_DAYS));
      }
    }
  };

  // After prepending days at the back, compensate scrollLeft so the view
  // doesn't visually jump (the content grew to the left of the viewport).
  useLayoutEffect(() => {
    if (pendingExtend.current === "back" && scrollRef.current) {
      const el = scrollRef.current;
      const diff = el.scrollWidth - prevScrollWidth.current;
      el.scrollLeft += diff;
    }
    pendingExtend.current = null;
  }, [daysBack, daysForward]);

  // On first load, scroll so "today" sits at the left edge of the timeline.
  useEffect(() => {
    if (
      !didInitScroll.current &&
      timelineCards.length > 0 &&
      scrollRef.current &&
      containerWidth > 0
    ) {
      const colWidth = availableWidth / visibleDays;
      scrollRef.current.scrollLeft = daysBack * colWidth;
      didInitScroll.current = true;
    }
  });

  // Keep the left-most visible date stable when zooming in/out.
  useLayoutEffect(() => {
    if (pendingZoomFrom.current != null && scrollRef.current) {
      const el = scrollRef.current;
      const oldV = pendingZoomFrom.current;
      el.scrollLeft = el.scrollLeft * (oldV / visibleDays);
      pendingZoomFrom.current = null;
    }
  }, [visibleDays]);

  const zoomIn = () =>
    setVisibleDays((v) => {
      if (v >= MAX_VISIBLE_DAYS) return v;
      pendingZoomFrom.current = v;
      return v + 1;
    }); // "+" → more days visible
  const zoomOut = () =>
    setVisibleDays((v) => {
      if (v <= MIN_VISIBLE_DAYS) return v;
      pendingZoomFrom.current = v;
      return v - 1;
    }); // "−" → fewer days visible

  return (
    <div style={styles.wrapper}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.title}>Timeline</span>
          <span style={styles.subtitle}>
            {format(rangeStart, "MMM d")} –{" "}
            {format(addDays(rangeStart, totalDays - 1), "MMM d, yyyy")} ·
            showing {visibleDays} days at a time
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
        <div style={styles.body}>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={styles.scrollArea}
          >
            {/* ── Header row: sticky corner + sticky-top date strip ── */}
            <div style={styles.row}>
              <div style={{ ...styles.leftHeaderCell, ...styles.stickyCorner }}>
                Card
              </div>
              <div
                style={{
                  ...styles.timelineCell,
                  width: timelineWidthPx,
                  ...styles.stickyTop,
                  height: HEADER_H,
                }}
              >
                <div
                  style={{
                    ...styles.dayGrid,
                    gridTemplateColumns: `repeat(${totalDays}, 1fr)`,
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

            {/* ── Card rows: sticky-left label + timeline cell, same row ── */}
            {timelineCards.map((card) => {
              const color = listColor(card.idList, lists);

              const dueDate = startOfDay(new Date(card.due));
              const startDate = card.start
                ? startOfDay(new Date(card.start))
                : dueDate;

              const rawStartOffset = differenceInCalendarDays(
                startDate,
                rangeStart,
              );
              const rawEndOffsetExclusive =
                differenceInCalendarDays(dueDate, rangeStart) + 1;

              const isOverdue = rawEndOffsetExclusive <= 0;
              const isFuture = rawStartOffset >= totalDays;

              const startOffset = Math.max(
                0,
                Math.min(totalDays, rawStartOffset),
              );
              const endOffset = Math.max(
                0,
                Math.min(totalDays, rawEndOffsetExclusive),
              );

              const leftPct = (startOffset / totalDays) * 100;
              const widthPct = Math.max(
                ((endOffset - startOffset) / totalDays) * 100,
                minBarWidthPx > 0 ? (minBarWidthPx / timelineWidthPx) * 100 : 0,
              );

              const meta = STATUS_META[getStatus(card, progressMap[card.id])];

              return (
                <div key={card.id} style={{ ...styles.row, minHeight: ROW_H }}>
                  <div
                    style={{
                      ...styles.leftCell,
                      ...styles.stickyLeft,
                      minHeight: ROW_H,
                    }}
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

                  <div
                    style={{
                      ...styles.timelineCell,
                      width: timelineWidthPx,
                      minHeight: ROW_H,
                    }}
                  >
                    <div
                      style={{
                        ...styles.dayGrid,
                        gridTemplateColumns: `repeat(${totalDays}, 1fr)`,
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

          {/* Floating zoom controls */}
          <div style={styles.zoomControls}>
            <button
              style={{
                ...styles.zoomBtn,
                ...(visibleDays >= MAX_VISIBLE_DAYS
                  ? styles.zoomBtnDisabled
                  : {}),
              }}
              onClick={zoomIn}
              disabled={visibleDays >= MAX_VISIBLE_DAYS}
              title="Show more days"
            >
              +
            </button>
            <div style={styles.zoomDivider} />
            <button
              style={{
                ...styles.zoomBtn,
                ...(visibleDays <= MIN_VISIBLE_DAYS
                  ? styles.zoomBtnDisabled
                  : {}),
              }}
              onClick={zoomOut}
              disabled={visibleDays <= MIN_VISIBLE_DAYS}
              title="Show fewer days"
            >
              −
            </button>
          </div>
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
    background: BG,
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
    background: BG,
    flexShrink: 0,
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
    whiteSpace: "nowrap",
  },
  body: {
    flex: 1,
    position: "relative",
    minHeight: 0,
    overflow: "hidden",
  },
  scrollArea: {
    height: "100%",
    overflow: "auto",
  },
  row: {
    display: "flex",
    flexDirection: "row",
  },

  /* Sticky helpers */
  stickyLeft: {
    position: "sticky",
    left: 0,
    zIndex: 3,
    background: BG,
  },
  stickyTop: {
    position: "sticky",
    top: 0,
    zIndex: 5,
    background: BG,
  },
  stickyCorner: {
    position: "sticky",
    top: 0,
    left: 0,
    zIndex: 6,
    background: BG,
  },

  /* Left label cell (both header + rows) */
  leftHeaderCell: {
    width: LEFT_WIDTH,
    minWidth: LEFT_WIDTH,
    flexShrink: 0,
    height: HEADER_H,
    display: "flex",
    alignItems: "center",
    padding: "0 16px",
    color: "#484f58",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    borderRight: "1px solid rgba(255,255,255,0.07)",
  },
  leftCell: {
    width: LEFT_WIDTH,
    minWidth: LEFT_WIDTH,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
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

  /* Timeline cell (header + rows) */
  timelineCell: {
    position: "relative",
    flexShrink: 0,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
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
    borderBottom: "1px solid rgba(255,255,255,0.1)",
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

  /* Floating zoom controls */
  zoomControls: {
    position: "absolute",
    bottom: 14,
    right: 14,
    display: "flex",
    flexDirection: "column",
    background: "rgba(20,25,35,0.92)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    overflow: "hidden",
    zIndex: 10,
    boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
  },
  zoomBtn: {
    width: 28,
    height: 28,
    background: "none",
    border: "none",
    color: "#e6edf3",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    lineHeight: "28px",
    padding: 0,
  },
  zoomBtnDisabled: {
    color: "#484f58",
    cursor: "not-allowed",
  },
  zoomDivider: {
    height: 1,
    background: "rgba(255,255,255,0.12)",
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

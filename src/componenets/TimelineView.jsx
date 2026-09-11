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

const HEADER_H = 40;
const ROW_H = 46;
const MILESTONE_ROW_H = 56;

// localStorage key: milestones aren't real Trello cards, so they're kept
// per-board in localStorage (this app talks straight to the Trello REST
// API rather than the Power-Up client SDK, so there's no t.set() storage
// available here).
const milestonesKey = (boardId) =>
  `taskflow_milestones_${boardId || "default"}`;

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

export default function TimelineView({
  cards = [],
  lists = [],
  onCardClick,
  boardId = null,
}) {
  const today = useMemo(() => startOfDay(new Date()), []);

  const [daysBack, setDaysBack] = useState(INITIAL_DAYS_BACK);
  const [daysForward, setDaysForward] = useState(INITIAL_DAYS_FORWARD);
  const [visibleDays, setVisibleDays] = useState(DEFAULT_VISIBLE_DAYS);

  // ── Milestones (persisted per-board in localStorage) ──────────────────────
  const [milestones, setMilestones] = useState([]);
  // { dateKey: "yyyy-MM-dd", step: "confirm" | "input", value: string } | null
  const [milestonePopover, setMilestonePopover] = useState(null);
  // id of the single milestone diamond currently expanded to show its name
  // + remove button (only ever one at a time).
  const [viewingMilestoneId, setViewingMilestoneId] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(milestonesKey(boardId));
      setMilestones(raw ? JSON.parse(raw) : []);
    } catch {
      setMilestones([]);
    }
    setMilestonePopover(null);
    setViewingMilestoneId(null);
  }, [boardId]);

  const persistMilestones = (next) => {
    setMilestones(next);
    try {
      localStorage.setItem(milestonesKey(boardId), JSON.stringify(next));
    } catch {
      /* localStorage unavailable — milestone still holds for this session */
    }
  };

  const openAddMilestone = (dateKey) => {
    setViewingMilestoneId(null);
    setMilestonePopover({ dateKey, step: "confirm", value: "" });
  };

  const toggleViewMilestone = (id) => {
    setMilestonePopover(null);
    setViewingMilestoneId((current) => (current === id ? null : id));
  };

  const confirmAddMilestone = () =>
    setMilestonePopover((p) => (p ? { ...p, step: "input" } : p));

  const submitMilestone = () => {
    setMilestonePopover((p) => {
      const name = p?.value.trim();
      if (!name) return p;
      persistMilestones([
        ...milestones,
        {
          id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          date: p.dateKey,
          name,
        },
      ]);
      return null;
    });
  };

  const removeMilestone = (id) => {
    persistMilestones(milestones.filter((m) => m.id !== id));
    setViewingMilestoneId((current) => (current === id ? null : current));
  };

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

  // ── Refs for the three moving parts: left list, right body, right header ──
  const leftBodyRef = useRef(null);
  const rightBodyRef = useRef(null);
  const headerWrapRef = useRef(null);

  // The date header (headerWrap) has its scrollbar hidden and never shows one,
  // while the body below it (rightScrollBody) shows a real vertical scrollbar
  // whenever the rows overflow. That scrollbar eats into the body's available
  // width, so its day columns render a little narrower than the header's —
  // the grid lines drift out of alignment with the header's date dividers,
  // worse the further right you look. Measuring the browser's actual
  // scrollbar width and reserving the same space in the header (padding) —
  // while always reserving it in the body too, via overflowY:"scroll" instead
  // of "auto" — keeps both grids exactly the same width at all times.
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  useEffect(() => {
    const outer = document.createElement("div");
    outer.style.visibility = "hidden";
    outer.style.position = "absolute";
    outer.style.top = "-9999px";
    outer.style.overflow = "scroll";
    document.body.appendChild(outer);
    const inner = document.createElement("div");
    outer.appendChild(inner);
    setScrollbarWidth(outer.offsetWidth - inner.offsetWidth);
    document.body.removeChild(outer);
  }, []);

  const skipLeftSync = useRef(false);
  const skipRightSync = useRef(false);
  const pendingExtend = useRef(null); // "back" | "forward" | null
  const prevScrollWidth = useRef(0);
  const pendingZoomFrom = useRef(null); // previous visibleDays while a zoom is settling
  const didInitScroll = useRef(false);

  const handleLeftScroll = (e) => {
    if (skipLeftSync.current) {
      skipLeftSync.current = false;
      return;
    }
    if (rightBodyRef.current) {
      skipRightSync.current = true;
      rightBodyRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const handleRightScroll = (e) => {
    const el = e.target;

    // Vertical: keep left card list lined up with the timeline rows.
    if (skipRightSync.current) {
      skipRightSync.current = false;
    } else if (leftBodyRef.current) {
      skipLeftSync.current = true;
      leftBodyRef.current.scrollTop = el.scrollTop;
    }

    // Horizontal: drag the (non-scrolling) date header along with the body.
    if (headerWrapRef.current) {
      headerWrapRef.current.scrollLeft = el.scrollLeft;
    }

    // Infinite-scroll: grow the date range when nearing either edge.
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
    if (pendingExtend.current === "back" && rightBodyRef.current) {
      const el = rightBodyRef.current;
      const diff = el.scrollWidth - prevScrollWidth.current;
      el.scrollLeft += diff;
      if (headerWrapRef.current)
        headerWrapRef.current.scrollLeft = el.scrollLeft;
    }
    pendingExtend.current = null;
  }, [daysBack, daysForward]);

  // On first load, scroll so "today" sits at the left edge of the viewport.
  useEffect(() => {
    if (
      !didInitScroll.current &&
      timelineCards.length > 0 &&
      rightBodyRef.current
    ) {
      const el = rightBodyRef.current;
      const colWidth = el.clientWidth / visibleDays;
      const initial = daysBack * colWidth;
      el.scrollLeft = initial;
      if (headerWrapRef.current) headerWrapRef.current.scrollLeft = initial;
      didInitScroll.current = true;
    }
  });

  // Keep the left-most visible date stable when zooming in/out.
  useLayoutEffect(() => {
    if (pendingZoomFrom.current != null && rightBodyRef.current) {
      const el = rightBodyRef.current;
      const oldV = pendingZoomFrom.current;
      const newScrollLeft = el.scrollLeft * (oldV / visibleDays);
      el.scrollLeft = newScrollLeft;
      if (headerWrapRef.current)
        headerWrapRef.current.scrollLeft = newScrollLeft;
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

  const contentWidthPct = (totalDays / visibleDays) * 100;
  const minBarWidthPct = 100 / totalDays;

  return (
    <div
      style={styles.wrapper}
      onClick={() => {
        if (milestonePopover) setMilestonePopover(null);
        if (viewingMilestoneId) setViewingMilestoneId(null);
      }}
    >
      <style>{`.tf-hide-scrollbar::-webkit-scrollbar{display:none}.tf-hide-scrollbar{scrollbar-width:none;-ms-overflow-style:none}.tf-ghost-hscroll::-webkit-scrollbar-track{background:transparent}.tf-ghost-hscroll::-webkit-scrollbar-thumb{background:transparent}.tf-ghost-hscroll{scrollbar-color:transparent transparent}`}</style>

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

      {timelineCards.length === 0 && milestones.length === 0 ? (
        <div style={styles.emptyWrap}>
          <div style={styles.emptyIcon}>🗓️</div>
          <h3 style={styles.emptyTitle}>No cards with due dates</h3>
          <p style={styles.emptyText}>
            Add a due date to a card to see it show up here.
          </p>
        </div>
      ) : (
        <div style={styles.body}>
          {/* ── Left pane: card list (vertical scroll only, scrollbar hidden — driven by the right pane) ── */}
          <div style={styles.leftPane}>
            <div style={styles.leftHeaderCell}>Card</div>
            <div
              ref={leftBodyRef}
              onScroll={handleLeftScroll}
              className="tf-ghost-hscroll"
              style={styles.leftScrollBody}
            >
              <div style={{ ...styles.leftCell, height: MILESTONE_ROW_H }}>
                <span style={styles.milestoneRowIcon}>◆</span>
                <div style={styles.leftCellText}>
                  <span style={styles.cardName}>Key Milestones</span>
                  <span style={styles.dueText}>
                    {milestones.length} milestone
                    {milestones.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <button
                  style={styles.addMilestoneChip}
                  onClick={(e) => {
                    e.stopPropagation();
                    openAddMilestone(format(today, "yyyy-MM-dd"));
                  }}
                  title="Add a milestone on today's date"
                >
                  + Add
                </button>
              </div>
              {timelineCards.map((card) => {
                const color = listColor(card.idList, lists);
                const progress = progressMap[card.id];
                const status = getStatus(card, progress);
                const meta = STATUS_META[status];
                return (
                  <div
                    key={card.id}
                    style={{ ...styles.leftCell, height: ROW_H }}
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
                );
              })}
            </div>
          </div>

          {/* ── Right pane: fixed header strip + scrollable body, kept in sync ── */}
          <div style={styles.rightPane}>
            {/* Date header — NOT independently scrollable; mirrors the body's scrollLeft */}
            <div
              ref={headerWrapRef}
              className="tf-hide-scrollbar"
              style={{ ...styles.headerWrap, paddingRight: scrollbarWidth }}
            >
              <div style={{ width: `${contentWidthPct}%` }}>
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

            {/* Scrollable body — the ONE visible scrollbar, both axes */}
            <div
              ref={rightBodyRef}
              onScroll={handleRightScroll}
              style={styles.rightScrollBody}
            >
              <div style={{ width: `${contentWidthPct}%` }}>
                {/* ── Key Milestones row ── */}
                <div style={{ ...styles.gridRow, height: MILESTONE_ROW_H }}>
                  <div
                    style={{
                      ...styles.dayGrid,
                      gridTemplateColumns: `repeat(${totalDays}, 1fr)`,
                      position: "absolute",
                      inset: 0,
                    }}
                  >
                    {days.map((d) => {
                      const dateKey = format(d, "yyyy-MM-dd");
                      const dayMilestones = milestones.filter(
                        (m) => m.date === dateKey,
                      );
                      const isOpen = milestonePopover?.dateKey === dateKey;
                      return (
                        <div
                          key={dateKey}
                          style={{
                            ...styles.dayBodyCell,
                            ...styles.milestoneDayCell,
                            ...(isToday(d) ? styles.dayBodyCellToday : {}),
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddMilestone(dateKey);
                          }}
                        >
                          {dayMilestones.map((m) => {
                            const isViewing = viewingMilestoneId === m.id;
                            return (
                              <div
                                key={m.id}
                                style={styles.milestoneMarker}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleViewMilestone(m.id);
                                }}
                              >
                                <button
                                  style={styles.milestoneDiamondBtn}
                                  title={m.name}
                                >
                                  ◆
                                </button>

                                {isViewing && (
                                  <div
                                    style={styles.milestoneViewPopover}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span style={styles.milestoneViewName}>
                                      {m.name}
                                    </span>
                                    <button
                                      style={styles.milestoneRemoveBtn}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeMilestone(m.id);
                                      }}
                                      title="Remove milestone"
                                    >
                                      ×
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {isOpen && (
                            <div
                              style={styles.milestonePopover}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {milestonePopover.step === "confirm" ? (
                                <button
                                  style={styles.addMilestoneBtn}
                                  onClick={confirmAddMilestone}
                                  autoFocus
                                >
                                  ◆ Add Milestone
                                </button>
                              ) : (
                                <form
                                  style={styles.milestoneForm}
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    submitMilestone();
                                  }}
                                >
                                  <input
                                    autoFocus
                                    type="text"
                                    placeholder="Milestone name"
                                    value={milestonePopover.value}
                                    maxLength={60}
                                    onChange={(e) =>
                                      setMilestonePopover((p) => ({
                                        ...p,
                                        value: e.target.value,
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape")
                                        setMilestonePopover(null);
                                    }}
                                    style={styles.milestoneInput}
                                  />
                                  <div style={styles.milestoneFormActions}>
                                    <button
                                      type="submit"
                                      style={{
                                        ...styles.milestoneConfirmBtn,
                                        ...(!milestonePopover.value.trim()
                                          ? {
                                              opacity: 0.5,
                                              cursor: "not-allowed",
                                            }
                                          : {}),
                                      }}
                                      disabled={!milestonePopover.value.trim()}
                                    >
                                      Add
                                    </button>
                                    <button
                                      type="button"
                                      style={styles.milestoneCancelBtn}
                                      onClick={() => setMilestonePopover(null)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

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
                    minBarWidthPct,
                  );

                  const meta =
                    STATUS_META[getStatus(card, progressMap[card.id])];

                  return (
                    <div
                      key={card.id}
                      style={{ ...styles.gridRow, height: ROW_H }}
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
                  );
                })}
              </div>
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
    display: "flex",
    flexDirection: "row",
    minHeight: 0,
    overflow: "hidden",
  },

  /* Left pane */
  leftPane: {
    width: 300,
    minWidth: 300,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid rgba(255,255,255,0.07)",
    minHeight: 0,
  },
  leftHeaderCell: {
    height: HEADER_H,
    minHeight: HEADER_H,
    display: "flex",
    alignItems: "center",
    padding: "0 16px",
    color: "#484f58",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    flexShrink: 0,
  },
  leftScrollBody: {
    flex: 1,
    overflowY: "auto",
    // "scroll" (not "hidden"/"auto") forces this pane to always reserve a
    // horizontal-scrollbar-height strip at the bottom, same as the right
    // pane always does (its content is wider than the viewport). Content
    // here never actually overflows horizontally, so nothing scrolls — the
    // .tf-ghost-hscroll class just makes that reserved strip invisible.
    // Without this, the left list's viewport was a few px taller than the
    // right timeline's, so their scroll ranges didn't quite match and the
    // two panes drifted out of sync (grid lines ending up above their
    // cards) once you scrolled from the right/calendar side to the bottom.
    overflowX: "scroll",
    minHeight: 0,
  },
  leftCell: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    cursor: "pointer",
    boxSizing: "border-box",
    overflow: "hidden",
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

  /* Right pane */
  rightPane: {
    flex: 1,
    position: "relative",
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  headerWrap: {
    height: HEADER_H,
    minHeight: HEADER_H,
    flexShrink: 0,
    overflow: "hidden",
    background: "#1a1f2e",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  rightScrollBody: {
    flex: 1,
    overflowX: "auto",
    // overflowY is forced to "scroll" (not "auto") inline where this style is
    // used, so the vertical scrollbar gutter is always reserved — see the
    // scrollbarWidth comment above for why that must stay in sync with the
    // header's padding.
    overflowY: "scroll",
    minHeight: 0,
    minWidth: 0,
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
    background: "rgba(255,255,255,0.07)",
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
  gridRow: {
    position: "relative",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    boxSizing: "border-box",
  },
  dayBodyCell: {
    borderRight: "1px solid rgba(255,255,255,0.04)",
    height: "100%",
  },
  dayBodyCellToday: {
    background: "rgba(255,255,255,0.045)",
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

  /* Key Milestones row — left pane */
  milestoneRowIcon: {
    width: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#e2b93b",
    fontSize: 13,
    flexShrink: 0,
  },
  addMilestoneChip: {
    background: "rgba(226,185,59,0.15)",
    border: "1px solid rgba(226,185,59,0.45)",
    color: "#e2b93b",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    padding: "4px 9px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  /* Key Milestones row — right (timeline) pane */
  milestoneDayCell: {
    position: "relative",
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    cursor: "pointer",
  },
  // Wraps one diamond button + its (conditional) view popover. Fixed size —
  // never grows with the milestone name, so it can never push the day-cell
  // grid lines around regardless of how long the name is.
  milestoneMarker: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  milestoneDiamondBtn: {
    width: 18,
    height: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(226,185,59,0.18)",
    border: "1px solid rgba(226,185,59,0.5)",
    borderRadius: 4,
    color: "#e2b93b",
    fontSize: 11,
    lineHeight: 1,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  },
  // Floating popover shown when a diamond is clicked — name + remove button.
  // Positioned absolutely so its width never affects the grid underneath it,
  // no matter how long the milestone name is.
  milestoneViewPopover: {
    position: "absolute",
    top: "100%",
    marginTop: 6,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(226,185,59,0.18)",
    border: "1px solid rgba(226,185,59,0.5)",
    color: "#e2b93b",
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 8,
    padding: "5px 6px 5px 10px",
    // minWidth matters here, not just maxWidth: this popover's containing
    // block is the 18px diamond button it's anchored to, so with left:50%
    // the browser has almost no "available width" to size it against and
    // will otherwise collapse it down to a sliver, wrapping the name one
    // character per line. An explicit minWidth overrides that.
    minWidth: 140,
    maxWidth: 220,
    boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
    zIndex: 21,
    cursor: "default",
  },
  milestoneViewName: {
    whiteSpace: "normal",
    wordBreak: "break-word",
  },
  milestoneRemoveBtn: {
    background: "none",
    border: "none",
    color: "#e2b93b",
    fontSize: 13,
    lineHeight: 1,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  },

  /* Add-milestone popover */
  milestonePopover: {
    position: "absolute",
    top: "100%",
    marginTop: 6,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1e2432",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: 8,
    boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
    zIndex: 20,
    cursor: "default",
  },
  addMilestoneBtn: {
    background: "rgba(226,185,59,0.18)",
    border: "1px solid rgba(226,185,59,0.5)",
    color: "#e2b93b",
    borderRadius: 8,
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  milestoneForm: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 170,
  },
  milestoneInput: {
    background: "#141924",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6,
    color: "#e6edf3",
    fontSize: 12,
    padding: "7px 9px",
    outline: "none",
  },
  milestoneFormActions: {
    display: "flex",
    gap: 6,
  },
  milestoneConfirmBtn: {
    flex: 1,
    background: "#e2b93b",
    border: "none",
    color: "#1a1f2e",
    borderRadius: 6,
    padding: "6px 0",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  milestoneCancelBtn: {
    flex: 1,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#c9d1d9",
    borderRadius: 6,
    padding: "6px 0",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
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

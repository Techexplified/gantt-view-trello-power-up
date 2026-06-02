import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  getCard,
  getBoardMembers,
  getBoardLabels,
  getMe,
  updateCard,
  addComment,
  deleteComment,
  addMemberToCard,
  removeMemberFromCard,
  addLabelToCard,
  removeLabelFromCard,
  updateCheckItem,
  archiveCard,
  deleteCard,
} from "../utils/trelloApi";

// ── Helpers ───────────────────────────────────────────────────────────────────
const LABEL_COLORS = {
  green: "#61bd4f",
  yellow: "#f2d600",
  orange: "#ff9f1a",
  red: "#eb5a46",
  purple: "#c377e0",
  blue: "#0079bf",
  sky: "#00c2e0",
  lime: "#51e898",
  pink: "#ff78cb",
  black: "#344563",
};

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function fmtDateTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function toDateTimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function Avatar({ member, size = 28 }) {
  if (member.avatarUrl) {
    return (
      <img
        src={`${member.avatarUrl}/30.png`}
        alt={member.initials}
        title={member.fullName}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
        }}
      />
    );
  }
  return (
    <div
      title={member.fullName}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#0079bf",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {member.initials || (member.fullName || "?")[0]}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CardModal({
  card: initialCard,
  boardId,
  lists,
  onClose,
  onCardUpdated,
}) {
  const [card, setCard] = useState(null);
  const [boardMembers, setBoardMembers] = useState([]);
  const [boardLabels, setBoardLabels] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  // Editing states
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descVal, setDescVal] = useState("");
  const [editingDue, setEditingDue] = useState(false);
  const [editingStart, setEditingStart] = useState(false);
  const [dueVal, setDueVal] = useState("");
  const [startVal, setStartVal] = useState("");

  // Dropdowns
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);

  // Comments
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Action state
  const [saving, setSaving] = useState(false);

  const titleRef = useRef();
  const descRef = useRef();

  // ── Load full card data ────────────────────────────────────────────────────
  const loadCard = useCallback(async () => {
    setLoading(true);
    try {
      const [fullCard, members, labels, meData] = await Promise.all([
        getCard(initialCard.id),
        getBoardMembers(boardId),
        getBoardLabels(boardId),
        getMe(),
      ]);
      setCard(fullCard);
      setTitleVal(fullCard.name);
      setDescVal(fullCard.desc || "");
      setDueVal(toDateTimeLocal(fullCard.due));
      setStartVal(toDateTimeLocal(fullCard.start));
      setBoardMembers(members);
      setBoardLabels(labels);
      setMe(meData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [initialCard.id, boardId]);

  useEffect(() => {
    loadCard();
  }, [loadCard]);

  // ── Patch helper ──────────────────────────────────────────────────────────
  const patch = async (fields) => {
    setSaving(true);
    try {
      const updated = await updateCard(card.id, fields);
      setCard(updated);
      onCardUpdated && onCardUpdated(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── Title save ────────────────────────────────────────────────────────────
  const saveTitle = () => {
    setEditingTitle(false);
    if (titleVal.trim() && titleVal !== card.name)
      patch({ name: titleVal.trim() });
  };

  // ── Desc save ─────────────────────────────────────────────────────────────
  const saveDesc = () => {
    setEditingDesc(false);
    if (descVal !== card.desc) patch({ desc: descVal });
  };

  // ── Date save ─────────────────────────────────────────────────────────────
  const saveDue = () => {
    setEditingDue(false);
    patch({ due: dueVal ? new Date(dueVal).toISOString() : null });
  };
  const saveStart = () => {
    setEditingStart(false);
    patch({ start: startVal ? new Date(startVal).toISOString() : null });
  };

  // ── Members ───────────────────────────────────────────────────────────────
  const toggleMember = async (member) => {
    const isMember = card.members?.some((m) => m.id === member.id);
    if (isMember) await removeMemberFromCard(card.id, member.id);
    else await addMemberToCard(card.id, member.id);
    loadCard();
  };

  // ── Labels ────────────────────────────────────────────────────────────────
  const toggleLabel = async (label) => {
    const hasLabel = card.labels?.some((l) => l.id === label.id);
    if (hasLabel) await removeLabelFromCard(card.id, label.id);
    else await addLabelToCard(card.id, label.id);
    loadCard();
  };

  // ── List move ─────────────────────────────────────────────────────────────
  const moveToList = async (listId) => {
    setShowListPicker(false);
    await patch({ idList: listId });
    loadCard();
  };

  // ── Checklist item toggle ─────────────────────────────────────────────────
  const toggleCheckItem = async (checkItemId, currentState) => {
    const newState = currentState === "complete" ? "incomplete" : "complete";
    await updateCheckItem(card.id, checkItemId, newState);
    loadCard();
  };

  // ── Comment ───────────────────────────────────────────────────────────────
  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await addComment(card.id, commentText.trim());
      setCommentText("");
      loadCard();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (actionId) => {
    if (!window.confirm("Delete this comment?")) return;
    await deleteComment(card.id, actionId);
    loadCard();
  };

  // ── Archive / Delete ──────────────────────────────────────────────────────
  const handleArchive = async () => {
    if (!window.confirm("Archive this card?")) return;
    await archiveCard(card.id);
    onCardUpdated && onCardUpdated(null);
    onClose();
  };
  const handleDelete = async () => {
    if (!window.confirm("Permanently delete this card? This cannot be undone."))
      return;
    await deleteCard(card.id);
    onCardUpdated && onCardUpdated(null);
    onClose();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div style={s.loadingWrap}>
            <div style={s.spinner} />
          </div>
        ) : (
          <>
            {/* ── Left / Main content ── */}
            <div style={s.main}>
              {/* Title */}
              <div style={s.titleRow}>
                {editingTitle ? (
                  <textarea
                    ref={titleRef}
                    style={s.titleInput}
                    value={titleVal}
                    onChange={(e) => setTitleVal(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !e.shiftKey && saveTitle()
                    }
                    autoFocus
                    rows={2}
                  />
                ) : (
                  <h2 style={s.title} onClick={() => setEditingTitle(true)}>
                    {card.name}
                  </h2>
                )}
                <button style={s.closeBtn} onClick={onClose}>
                  ✕
                </button>
              </div>

              {/* Board / list breadcrumb */}
              <div style={s.breadcrumb}>
                in list{" "}
                <span style={s.breadcrumbList}>
                  {lists.find((l) => l.id === card.idList)?.name || "—"}
                </span>
                {saving && <span style={s.savingBadge}>Saving…</span>}
              </div>

              {/* ── Dates ── */}
              <Section icon="🕐" label="Dates">
                <div style={s.datesRow}>
                  <div style={s.dateField}>
                    <span style={s.dateLabel}>Start</span>
                    {editingStart ? (
                      <div style={s.dateInputWrap}>
                        <input
                          type="datetime-local"
                          style={s.dateInput}
                          value={startVal}
                          onChange={(e) => setStartVal(e.target.value)}
                        />
                        <button style={s.saveDateBtn} onClick={saveStart}>
                          Save
                        </button>
                        <button
                          style={s.cancelDateBtn}
                          onClick={() => setEditingStart(false)}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span
                        style={s.dateValue}
                        onClick={() => setEditingStart(true)}
                      >
                        {card.start ? (
                          fmtDateTime(card.start)
                        ) : (
                          <span style={s.addDate}>+ Add start date</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div style={s.dateField}>
                    <span style={s.dateLabel}>Due</span>
                    {editingDue ? (
                      <div style={s.dateInputWrap}>
                        <input
                          type="datetime-local"
                          style={s.dateInput}
                          value={dueVal}
                          onChange={(e) => setDueVal(e.target.value)}
                        />
                        <button style={s.saveDateBtn} onClick={saveDue}>
                          Save
                        </button>
                        <button
                          style={s.cancelDateBtn}
                          onClick={() => setEditingDue(false)}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span
                        style={s.dateValue}
                        onClick={() => setEditingDue(true)}
                      >
                        {card.due ? (
                          fmtDateTime(card.due)
                        ) : (
                          <span style={s.addDate}>+ Add due date</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </Section>

              {/* ── Members ── */}
              <Section icon="👤" label="Members">
                <div style={s.memberRow}>
                  {card.members?.map((m) => (
                    <Avatar key={m.id} member={m} size={30} />
                  ))}
                  <div style={{ position: "relative" }}>
                    <button
                      style={s.addChip}
                      onClick={() => {
                        setShowMemberPicker((p) => !p);
                        setShowLabelPicker(false);
                      }}
                    >
                      + Add member
                    </button>
                    {showMemberPicker && (
                      <Picker onClose={() => setShowMemberPicker(false)}>
                        {boardMembers.map((m) => {
                          const active = card.members?.some(
                            (cm) => cm.id === m.id,
                          );
                          return (
                            <PickerItem
                              key={m.id}
                              active={active}
                              onClick={() => toggleMember(m)}
                            >
                              <Avatar member={m} size={24} />
                              <span>{m.fullName}</span>
                              {active && <span style={s.checkMark}>✓</span>}
                            </PickerItem>
                          );
                        })}
                      </Picker>
                    )}
                  </div>
                </div>
              </Section>

              {/* ── Labels ── */}
              <Section icon="🏷" label="Labels">
                <div style={s.labelRow}>
                  {card.labels?.map((lbl) => (
                    <span
                      key={lbl.id}
                      style={{
                        ...s.labelChip,
                        background: LABEL_COLORS[lbl.color] || "#666",
                      }}
                    >
                      {lbl.name || lbl.color}
                    </span>
                  ))}
                  <div style={{ position: "relative" }}>
                    <button
                      style={s.addChip}
                      onClick={() => {
                        setShowLabelPicker((p) => !p);
                        setShowMemberPicker(false);
                      }}
                    >
                      + Add label
                    </button>
                    {showLabelPicker && (
                      <Picker onClose={() => setShowLabelPicker(false)}>
                        {boardLabels.map((lbl) => {
                          const active = card.labels?.some(
                            (cl) => cl.id === lbl.id,
                          );
                          return (
                            <PickerItem
                              key={lbl.id}
                              active={active}
                              onClick={() => toggleLabel(lbl)}
                            >
                              <span
                                style={{
                                  ...s.labelDot,
                                  background: LABEL_COLORS[lbl.color] || "#666",
                                }}
                              />
                              <span>{lbl.name || lbl.color}</span>
                              {active && <span style={s.checkMark}>✓</span>}
                            </PickerItem>
                          );
                        })}
                      </Picker>
                    )}
                  </div>
                </div>
              </Section>

              {/* ── List ── */}
              <Section icon="📋" label="List">
                <div style={{ position: "relative", display: "inline-block" }}>
                  <button
                    style={s.listBtn}
                    onClick={() => setShowListPicker((p) => !p)}
                  >
                    {lists.find((l) => l.id === card.idList)?.name || "—"} ▾
                  </button>
                  {showListPicker && (
                    <Picker onClose={() => setShowListPicker(false)}>
                      {lists.map((l) => (
                        <PickerItem
                          key={l.id}
                          active={l.id === card.idList}
                          onClick={() => moveToList(l.id)}
                        >
                          <span>{l.name}</span>
                          {l.id === card.idList && (
                            <span style={s.checkMark}>✓</span>
                          )}
                        </PickerItem>
                      ))}
                    </Picker>
                  )}
                </div>
              </Section>

              {/* ── Description ── */}
              <Section icon="☰" label="Description">
                {editingDesc ? (
                  <div>
                    <textarea
                      style={s.descInput}
                      value={descVal}
                      onChange={(e) => setDescVal(e.target.value)}
                      rows={5}
                      autoFocus
                      ref={descRef}
                    />
                    <div style={s.descActions}>
                      <button style={s.saveDateBtn} onClick={saveDesc}>
                        Save
                      </button>
                      <button
                        style={s.cancelDateBtn}
                        onClick={() => {
                          setEditingDesc(false);
                          setDescVal(card.desc || "");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={s.descDisplay}
                    onClick={() => setEditingDesc(true)}
                  >
                    {card.desc ? (
                      <p style={s.descText}>{card.desc}</p>
                    ) : (
                      <span style={s.addDate}>+ Add a description…</span>
                    )}
                  </div>
                )}
              </Section>

              {/* ── Checklists ── */}
              {card.checklists?.map((cl) => {
                const total = cl.checkItems?.length || 0;
                const done =
                  cl.checkItems?.filter((i) => i.state === "complete").length ||
                  0;
                const pct = total ? Math.round((done / total) * 100) : 0;
                return (
                  <Section key={cl.id} icon="☑" label={cl.name}>
                    <div style={s.progressBarWrap}>
                      <span style={s.progressPct}>{pct}%</span>
                      <div style={s.progressTrack}>
                        <div
                          style={{
                            ...s.progressFill,
                            width: `${pct}%`,
                            background: pct === 100 ? "#61bd4f" : "#0079bf",
                          }}
                        />
                      </div>
                    </div>
                    {cl.checkItems
                      ?.sort((a, b) => a.pos - b.pos)
                      .map((item) => (
                        <div
                          key={item.id}
                          style={s.checkItem}
                          onClick={() => toggleCheckItem(item.id, item.state)}
                        >
                          <div
                            style={{
                              ...s.checkbox,
                              ...(item.state === "complete"
                                ? s.checkboxDone
                                : {}),
                            }}
                          >
                            {item.state === "complete" && (
                              <span style={s.checkTick}>✓</span>
                            )}
                          </div>
                          <span
                            style={{
                              ...s.checkItemName,
                              ...(item.state === "complete"
                                ? s.checkItemDone
                                : {}),
                            }}
                          >
                            {item.name}
                          </span>
                        </div>
                      ))}
                  </Section>
                );
              })}

              {/* ── Comments ── */}
              <Section
                icon="💬"
                label={`Comments (${card.actions?.length || 0})`}
              >
                {/* New comment input */}
                <div style={s.commentInputRow}>
                  {me && <Avatar member={me} size={28} />}
                  <div style={s.commentInputWrap}>
                    <textarea
                      style={s.commentInput}
                      placeholder="Write a comment…"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={commentText ? 3 : 1}
                    />
                    {commentText && (
                      <button
                        style={{ ...s.saveDateBtn, marginTop: 6 }}
                        disabled={submittingComment}
                        onClick={submitComment}
                      >
                        {submittingComment ? "Posting…" : "Post"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Existing comments */}
                {card.actions?.map((action) => (
                  <div key={action.id} style={s.commentRow}>
                    {action.memberCreator && (
                      <Avatar member={action.memberCreator} size={28} />
                    )}
                    <div style={s.commentBody}>
                      <div style={s.commentMeta}>
                        <strong style={s.commentAuthor}>
                          {action.memberCreator?.fullName}
                        </strong>
                        <span style={s.commentDate}>
                          {fmtDateTime(action.date)}
                        </span>
                        {action.memberCreator?.id === me?.id && (
                          <button
                            style={s.deleteCommentBtn}
                            onClick={() => handleDeleteComment(action.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      <div style={s.commentText}>{action.data?.text}</div>
                    </div>
                  </div>
                ))}
              </Section>
            </div>

            {/* ── Right sidebar actions ── */}
            <div style={s.sidebar}>
              <p style={s.sidebarHeading}>Actions</p>
              <a
                href={card.url}
                target="_blank"
                rel="noreferrer"
                style={s.actionBtn}
              >
                ↗ Open in Trello
              </a>
              <button style={s.actionBtn} onClick={handleArchive}>
                📦 Archive
              </button>
              <button
                style={{ ...s.actionBtn, ...s.actionBtnDanger }}
                onClick={handleDelete}
              >
                🗑 Delete
              </button>

              {/* Attachments */}
              {card.attachments?.length > 0 && (
                <>
                  <p style={{ ...s.sidebarHeading, marginTop: 20 }}>
                    Attachments
                  </p>
                  {card.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      style={s.attachmentLink}
                    >
                      📎 {att.name}
                    </a>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ icon, label, children }) {
  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        <span style={s.sectionIcon}>{icon}</span>
        <span style={s.sectionLabel}>{label}</span>
      </div>
      <div style={s.sectionBody}>{children}</div>
    </div>
  );
}

function Picker({ children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return (
    <div ref={ref} style={s.picker}>
      {children}
    </div>
  );
}

function PickerItem({ children, active, onClick }) {
  return (
    <div
      style={{ ...s.pickerItem, ...(active ? s.pickerItemActive : {}) }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(4px)",
    overflowY: "auto",
    padding: "40px 16px",
  },
  modal: {
    background: "#1e2432",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    width: "100%",
    maxWidth: 780,
    display: "flex",
    flexDirection: "row",
    gap: 0,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    minHeight: 400,
    position: "relative",
  },
  loadingWrap: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 60,
  },
  spinner: {
    width: 36,
    height: 36,
    border: "3px solid rgba(0,208,132,0.2)",
    borderTopColor: "#00d084",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  // Main
  main: { flex: 1, padding: "24px 24px 32px", overflowY: "auto", minWidth: 0 },
  titleRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    color: "#e6edf3",
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    cursor: "pointer",
    lineHeight: 1.4,
    padding: "4px 6px",
    borderRadius: 6,
    transition: "background 0.15s",
  },
  titleInput: {
    flex: 1,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid #00d084",
    borderRadius: 6,
    color: "#e6edf3",
    fontSize: 20,
    fontWeight: 700,
    padding: "4px 8px",
    resize: "none",
    fontFamily: "inherit",
    lineHeight: 1.4,
    outline: "none",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#8b949e",
    fontSize: 18,
    cursor: "pointer",
    padding: "4px 6px",
    flexShrink: 0,
  },
  breadcrumb: {
    color: "#484f58",
    fontSize: 12,
    marginBottom: 20,
    paddingLeft: 2,
  },
  breadcrumbList: { color: "#8b949e", fontWeight: 600 },
  savingBadge: {
    background: "rgba(0,208,132,0.15)",
    color: "#00d084",
    borderRadius: 4,
    padding: "1px 6px",
    fontSize: 11,
    marginLeft: 8,
  },
  // Sections
  section: { marginBottom: 22 },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionIcon: { fontSize: 15, width: 20, textAlign: "center", flexShrink: 0 },
  sectionLabel: {
    color: "#8b949e",
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  sectionBody: { paddingLeft: 28 },
  // Dates
  datesRow: { display: "flex", flexWrap: "wrap", gap: 16 },
  dateField: { display: "flex", flexDirection: "column", gap: 4 },
  dateLabel: {
    color: "#484f58",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  dateValue: {
    color: "#c9d1d9",
    fontSize: 13,
    cursor: "pointer",
    padding: "4px 8px",
    background: "rgba(255,255,255,0.05)",
    borderRadius: 6,
  },
  addDate: { color: "#484f58", fontStyle: "italic" },
  dateInputWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  dateInput: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6,
    color: "#e6edf3",
    fontSize: 12,
    padding: "4px 8px",
    colorScheme: "dark",
  },
  saveDateBtn: {
    background: "#0079bf",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 12px",
    cursor: "pointer",
  },
  cancelDateBtn: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    color: "#8b949e",
    fontSize: 12,
    padding: "4px 8px",
    cursor: "pointer",
  },
  // Members / labels
  memberRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  labelRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 },
  labelChip: {
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 4,
    color: "#fff",
    display: "inline-block",
  },
  labelDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
    display: "inline-block",
    flexShrink: 0,
  },
  addChip: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 6,
    color: "#8b949e",
    fontSize: 12,
    padding: "4px 10px",
    cursor: "pointer",
  },
  // List picker
  listBtn: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 6,
    color: "#c9d1d9",
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 12px",
    cursor: "pointer",
  },
  // Picker dropdown
  picker: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 4,
    background: "#2a3142",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    zIndex: 100,
    minWidth: 200,
    maxHeight: 260,
    overflowY: "auto",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  },
  pickerItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    cursor: "pointer",
    color: "#c9d1d9",
    fontSize: 13,
    transition: "background 0.1s",
  },
  pickerItemActive: { background: "rgba(0,208,132,0.1)" },
  checkMark: { marginLeft: "auto", color: "#00d084", fontWeight: 700 },
  // Description
  descDisplay: {
    background: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    padding: "10px 12px",
    cursor: "pointer",
    minHeight: 48,
    border: "1px solid rgba(255,255,255,0.06)",
  },
  descText: {
    color: "#c9d1d9",
    fontSize: 13,
    lineHeight: 1.6,
    margin: 0,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },
  descInput: {
    width: "100%",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid #0079bf",
    borderRadius: 8,
    color: "#e6edf3",
    fontSize: 13,
    padding: "10px 12px",
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: 1.6,
    outline: "none",
  },
  descActions: { display: "flex", gap: 8, marginTop: 6 },
  // Checklists
  progressBarWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  progressPct: {
    color: "#8b949e",
    fontSize: 11,
    width: 30,
    textAlign: "right",
    flexShrink: 0,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    background: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3, transition: "width 0.3s" },
  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "5px 0",
    cursor: "pointer",
  },
  checkbox: {
    width: 16,
    height: 16,
    border: "2px solid rgba(255,255,255,0.25)",
    borderRadius: 3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "background 0.15s, border-color 0.15s",
  },
  checkboxDone: { background: "#61bd4f", borderColor: "#61bd4f" },
  checkTick: { color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: 1 },
  checkItemName: { color: "#c9d1d9", fontSize: 13 },
  checkItemDone: { textDecoration: "line-through", color: "#484f58" },
  // Comments
  commentInputRow: {
    display: "flex",
    gap: 10,
    marginBottom: 16,
    alignItems: "flex-start",
  },
  commentInputWrap: { flex: 1 },
  commentInput: {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    color: "#e6edf3",
    fontSize: 13,
    padding: "8px 12px",
    resize: "none",
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.15s",
  },
  commentRow: {
    display: "flex",
    gap: 10,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  commentBody: { flex: 1 },
  commentMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  commentAuthor: { color: "#e6edf3", fontSize: 13, fontWeight: 600 },
  commentDate: { color: "#484f58", fontSize: 11 },
  commentText: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    padding: "8px 12px",
    color: "#c9d1d9",
    fontSize: 13,
    lineHeight: 1.5,
  },
  deleteCommentBtn: {
    background: "none",
    border: "none",
    color: "#484f58",
    fontSize: 11,
    cursor: "pointer",
    marginLeft: "auto",
    padding: "0 4px",
    textDecoration: "underline",
  },
  // Right sidebar
  sidebar: {
    width: 168,
    flexShrink: 0,
    padding: "24px 16px",
    borderLeft: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  sidebarHeading: {
    color: "#484f58",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    margin: "0 0 4px",
  },
  actionBtn: {
    display: "block",
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    color: "#c9d1d9",
    fontSize: 12,
    fontWeight: 500,
    padding: "8px 10px",
    cursor: "pointer",
    textAlign: "left",
    textDecoration: "none",
    transition: "background 0.15s",
  },
  actionBtnDanger: { color: "#ff8fa3", borderColor: "rgba(235,90,70,0.25)" },
  attachmentLink: {
    display: "block",
    color: "#58a6ff",
    fontSize: 12,
    textDecoration: "none",
    padding: "4px 0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};

// Inject spinner animation
const tag = document.createElement("style");
tag.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(tag);

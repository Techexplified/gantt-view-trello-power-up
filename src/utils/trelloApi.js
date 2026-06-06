import { TRELLO_API_KEY, getStoredToken } from "./auth";

const BASE = "https://api.trello.com/1";

async function apiFetch(path, params = {}, options = {}) {
  const token = getStoredToken();
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("key", TRELLO_API_KEY);
  if (token) url.searchParams.set("token", token);

  const { method = "GET", body } = options;

  // For GET, pass extra params as query string
  if (method === "GET") {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const fetchOptions = { method };
  if (body) {
    // For write requests pass params in body as JSON
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    fetchOptions.headers = { "Content-Type": "application/json" };
    fetchOptions.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), fetchOptions);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trello API error ${res.status}: ${text}`);
  }
  // DELETE returns empty body
  if (method === "DELETE") return null;
  return res.json();
}

// ── Board ─────────────────────────────────────────────────────────────────────
export const getBoard = (boardId) =>
  apiFetch(`/boards/${boardId}`, { fields: "name,url,prefs" });

// ── Lists ─────────────────────────────────────────────────────────────────────
export const getLists = (boardId) =>
  apiFetch(`/boards/${boardId}/lists`, { filter: "open", fields: "name,pos" });

// ── Cards (board-level, lightweight) ─────────────────────────────────────────
export const getCards = (boardId) =>
  apiFetch(`/boards/${boardId}/cards`, {
    filter: "open",
    fields: "name,idList,due,start,labels,url,shortLink",
  });

// ── Card detail (full single card) ───────────────────────────────────────────
export const getCard = (cardId) =>
  apiFetch(`/cards/${cardId}`, {
    fields: "all",
    members: "true",
    member_fields: "fullName,username,avatarUrl,initials",
    attachments: "true",
    attachment_fields: "name,url,previews",
    checklists: "all",
    checklist_fields: "all",
    actions: "commentCard",
    action_memberCreator_fields: "fullName,username,initials,avatarUrl",
  });

// ── Board members ─────────────────────────────────────────────────────────────
export const getBoardMembers = (boardId) =>
  apiFetch(`/boards/${boardId}/members`, {
    fields: "fullName,username,initials,avatarUrl",
  });

// ── Board labels ──────────────────────────────────────────────────────────────
export const getBoardLabels = (boardId) =>
  apiFetch(`/boards/${boardId}/labels`, { fields: "name,color" });

// ── Member (current user) ─────────────────────────────────────────────────────
export const getMe = () =>
  apiFetch("/members/me", { fields: "fullName,username,avatarUrl,initials" });

// ── All boards for the current member ────────────────────────────────────────
export const getMyBoards = () =>
  apiFetch("/members/me/boards", {
    filter: "open",
    fields: "name,shortLink,prefs",
  });

// ─────────────────────────────────────────────────────────────────────────────
// WRITE OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

// ── Update card fields ────────────────────────────────────────────────────────
export const updateCard = (cardId, fields) =>
  apiFetch(`/cards/${cardId}`, {}, { method: "PUT", body: fields });

// ── Card members ──────────────────────────────────────────────────────────────
export const addMemberToCard = (cardId, memberId) =>
  apiFetch(
    `/cards/${cardId}/idMembers`,
    {},
    {
      method: "POST",
      body: { value: memberId },
    },
  );

export const removeMemberFromCard = (cardId, memberId) =>
  apiFetch(`/cards/${cardId}/idMembers/${memberId}`, {}, { method: "DELETE" });

// ── Card labels ───────────────────────────────────────────────────────────────
export const addLabelToCard = (cardId, labelId) =>
  apiFetch(
    `/cards/${cardId}/idLabels`,
    {},
    {
      method: "POST",
      body: { value: labelId },
    },
  );

export const removeLabelFromCard = (cardId, labelId) =>
  apiFetch(`/cards/${cardId}/idLabels/${labelId}`, {}, { method: "DELETE" });

// ── Comments ──────────────────────────────────────────────────────────────────
export const addComment = (cardId, text) =>
  apiFetch(
    `/cards/${cardId}/actions/comments`,
    {},
    {
      method: "POST",
      body: { text },
    },
  );

export const deleteComment = (cardId, actionId) =>
  apiFetch(
    `/cards/${cardId}/actions/${actionId}/comments`,
    {},
    { method: "DELETE" },
  );

// ── Checklists ────────────────────────────────────────────────────────────────
export const updateCheckItem = (cardId, checkItemId, state) =>
  apiFetch(
    `/cards/${cardId}/checkItem/${checkItemId}`,
    {},
    {
      method: "PUT",
      body: { state }, // 'complete' or 'incomplete'
    },
  );

// ── Card actions (archive / delete) ──────────────────────────────────────────
export const archiveCard = (cardId) =>
  apiFetch(`/cards/${cardId}`, {}, { method: "PUT", body: { closed: true } });

export const deleteCard = (cardId) =>
  apiFetch(`/cards/${cardId}`, {}, { method: "DELETE" });

// ── Create card ───────────────────────────────────────────────────────────────
export const createCard = (listId, name) =>
  apiFetch(`/cards`, {}, { method: "POST", body: { idList: listId, name } });

export const createCardWithDates = (listId, name, start, due) =>
  apiFetch(
    "/cards",
    {},
    {
      method: "POST",
      body: {
        idList: listId,
        name,
        start,
        due,
      },
    },
  );

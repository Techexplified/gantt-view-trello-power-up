import { TRELLO_API_KEY, getStoredToken } from './auth';

const BASE = 'https://api.trello.com/1';

async function apiFetch(path, params = {}) {
  const token = getStoredToken();
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('key', TRELLO_API_KEY);
  if (token) url.searchParams.set('token', token);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trello API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Board ─────────────────────────────────────────────────────────────────────
export const getBoard = (boardId) =>
  apiFetch(`/boards/${boardId}`, { fields: 'name,url,prefs' });

// ── Lists ─────────────────────────────────────────────────────────────────────
export const getLists = (boardId) =>
  apiFetch(`/boards/${boardId}/lists`, { filter: 'open', fields: 'name,pos' });

// ── Cards ─────────────────────────────────────────────────────────────────────
export const getCards = (boardId) =>
  apiFetch(`/boards/${boardId}/cards`, {
    filter: 'open',
    fields: 'name,idList,due,start,labels,url,shortLink',
  });

// ── Member (current user) ─────────────────────────────────────────────────────
export const getMe = () =>
  apiFetch('/members/me', { fields: 'fullName,username,avatarUrl' });

// ── All boards for the current member ────────────────────────────────────────
export const getMyBoards = () =>
  apiFetch('/members/me/boards', {
    filter: 'open',
    fields: 'name,shortLink,prefs',
  });

// src/utils/api.js
import { getStoredToken } from "./auth";

// Vite injects this at build time — set per-environment (see step 3 below).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function getMe() {
  const token = getStoredToken();
  if (!token) throw new Error("No Trello token available.");

  const res = await fetch(`${API_BASE_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Backend auth failed: ${res.status}`);
  }
  return res.json(); // { atlassianId, email, displayName, plan, isPro, isTrialActive, isActive, trialEndsAt }
}

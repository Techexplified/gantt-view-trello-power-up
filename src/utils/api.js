// src/utils/api.js
//
// The ONLY place the frontend talks to the TaskFlow backend.
// Every call returns parsed JSON or throws an ApiError whose `code` matches
// the backend's `{ error: "<code>" }` body, so the UI can react precisely
// (e.g. only log the user out on a real 401, never on a server hiccup).

import { getStoredToken } from "./auth";

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE_URL = RAW_BASE.trim().replace(/\/+$/, "");

if (!API_BASE_URL) {
  // Fails loudly in the console instead of silently calling "undefined/api/…"
  console.error(
    "VITE_API_BASE_URL is not set — add it to .env (local) or the Vercel " +
      "project's Environment Variables, then rebuild.",
  );
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.name = "ApiError";
    this.status = status; // HTTP status, or 0 for network/CORS failures
    this.code = code; // backend error code, e.g. "already_pro"
  }
}

// Broadcast so App can log out from anywhere a 401 happens.
export const AUTH_EXPIRED_EVENT = "taskflow:auth-expired";

async function request(path, { method = "GET", signal } = {}) {
  const token = getStoredToken();
  if (!token) throw new ApiError(401, "missing_token", "Not signed in");
  if (!API_BASE_URL) {
    throw new ApiError(0, "not_configured", "Backend URL is not configured");
  }

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    // Network down, backend down, or blocked by CORS (backend's
    // ALLOWED_ORIGINS doesn't include this site's domain).
    throw new ApiError(0, "network_error", "Can't reach TaskFlow servers");
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body — handled below */
  }

  if (!res.ok) {
    const code = body?.error || `http_${res.status}`;
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    throw new ApiError(res.status, code, code);
  }
  return body;
}

// GET /api/users/me — creates the user (starting the 7-day trial) on the
// first call, then returns identity + plan every time:
// { atlassianId, email, displayName, created_at, plan, isPro, isTrialActive,
//   isActive, trialEndsAt, expiresAt, cancelAtPeriodEnd }
export const getMe = (opts) => request("/api/users/me", opts);

// POST /api/checkout/init → { checkoutUrl }
// Throws ApiError code "already_pro" (409) if the user is already Pro.
export async function initCheckout() {
  const { checkoutUrl } = await request("/api/checkout/init", {
    method: "POST",
  });
  if (!checkoutUrl) throw new ApiError(500, "no_checkout_url");
  return checkoutUrl;
}

// GET /api/subscription/portal → { portalUrl }
// Throws ApiError code "no_billing_account" (404) if the user never paid.
export async function getPortalUrl() {
  const { portalUrl } = await request("/api/subscription/portal");
  if (!portalUrl) throw new ApiError(500, "no_portal_url");
  return portalUrl;
}

// Human-readable message for any error thrown above.
export function describeApiError(err) {
  switch (err?.code) {
    case "network_error":
      return "Can't reach TaskFlow right now. Check your connection and try again.";
    case "not_configured":
      return "TaskFlow isn't configured correctly (missing backend URL).";
    case "auth_unavailable":
    case "service_unavailable":
      return "TaskFlow is temporarily unavailable. Please try again in a minute.";
    case "http_429":
      return "Too many attempts. Please wait a minute and try again.";
    case "already_pro":
      return "You're already on Pro.";
    case "no_billing_account":
      return "No billing account yet. If you just paid, wait a minute and try again.";
    case "invalid_token":
    case "missing_token":
      return "Your Trello session expired. Please sign in again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

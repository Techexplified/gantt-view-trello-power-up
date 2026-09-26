// src/plan/PlanProvider.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getMe,
  initCheckout,
  getPortalUrl,
  describeApiError,
} from "../utils/api";
import { PlanContext } from "./planContext";
import PricingModal from "../componenets/PricingModal";

const REFRESH_THROTTLE_MS = 5_000; // focus/visibility refreshes at most this often
const WATCH_INTERVAL_MS = 4_000; // poll while waiting for the payment webhook
const WATCH_TIMEOUT_MS = 10 * 60_000; // stop polling after 10 minutes
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000, 60_000];

// Opens a tab synchronously (inside the click) so popup blockers allow it,
// then points it at the real URL once the backend responds.
function openPendingTab(message) {
  const win = window.open("", "_blank");
  if (win) {
    try {
      win.document.title = message;
      win.document.body.style.cssText =
        "font-family:system-ui,sans-serif;background:#12172a;color:#c9d1d9;" +
        "display:flex;align-items:center;justify-content:center;height:100vh;margin:0";
      win.document.body.textContent = message;
    } catch {
      /* cross-origin or closed — fine */
    }
  }
  return win;
}

export default function PlanProvider({ children }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [busy, setBusy] = useState(null); // "checkout" | "portal" | null
  const [waitingForPayment, setWaitingForPayment] = useState(false);
  const [notice, setNotice] = useState(null); // { kind, text, href? }

  const inflight = useRef(null);
  const lastFetchAt = useRef(0);
  const retryIdx = useRef(0);
  const retryTimer = useRef(null);
  const watch = useRef({ timer: null, until: 0 });
  const mounted = useRef(true);

  const stopWatching = useCallback(() => {
    clearInterval(watch.current.timer);
    watch.current = { timer: null, until: 0 };
    setWaitingForPayment(false);
  }, []);

  const refresh = useCallback(
    ({ force = false } = {}) => {
      if (inflight.current) return inflight.current;
      if (!force && Date.now() - lastFetchAt.current < REFRESH_THROTTLE_MS) {
        return Promise.resolve(null);
      }
      lastFetchAt.current = Date.now();
      clearTimeout(retryTimer.current);

      inflight.current = getMe()
        .then((s) => {
          if (!mounted.current) return s;
          setStatus(s);
          setError(null);
          retryIdx.current = 0;
          return s;
        })
        .catch((err) => {
          if (!mounted.current || err?.name === "AbortError") return null;
          // 401 is handled by App (AUTH_EXPIRED_EVENT → sign out).
          if (err?.status !== 401) {
            setError(err);
            // Keep the last known plan; retry with backoff.
            const delay =
              RETRY_DELAYS_MS[Math.min(retryIdx.current, RETRY_DELAYS_MS.length - 1)];
            retryIdx.current += 1;
            retryTimer.current = setTimeout(
              () => refresh({ force: true }),
              delay,
            );
          }
          return null;
        })
        .finally(() => {
          inflight.current = null;
        });
      return inflight.current;
    },
    [],
  );

  // Poll /me until the payment webhook has made the user Pro.
  const startWatching = useCallback(() => {
    clearInterval(watch.current.timer);
    setWaitingForPayment(true);
    const until = Date.now() + WATCH_TIMEOUT_MS;
    const tick = async () => {
      if (Date.now() > until) {
        stopWatching();
        return;
      }
      const s = await refresh({ force: true });
      if (s?.isPro) {
        stopWatching();
        setPricingOpen(false);
        setNotice({ kind: "success", text: "Payment confirmed — you're on Pro!" });
      }
    };
    watch.current = { timer: setInterval(tick, WATCH_INTERVAL_MS), until };
  }, [refresh, stopWatching]);

  // Initial load + cleanup.
  useEffect(() => {
    mounted.current = true;
    refresh({ force: true });
    return () => {
      mounted.current = false;
      clearTimeout(retryTimer.current);
      clearInterval(watch.current.timer);
    };
  }, [refresh]);

  // Refresh when the user comes back to this tab/iframe (e.g. after paying
  // or managing billing in another tab). `visibilitychange` reaches the
  // Trello iframe even when `focus` doesn't.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // Message from public/checkout-return.js (the tab Dodo redirects to).
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "taskflow:checkout-return") return;
      if (event.data.ok) {
        startWatching();
        refresh({ force: true });
      } else {
        setNotice({
          kind: "error",
          text: "The payment didn't go through. You haven't been charged for Pro.",
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [refresh, startWatching]);

  // Auto-hide notices.
  useEffect(() => {
    if (!notice || notice.href) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const startCheckout = useCallback(async () => {
    if (busy) return;
    const win = openPendingTab("Opening secure checkout…");
    setBusy("checkout");
    try {
      const url = await initCheckout();
      if (win && !win.closed) {
        win.location.href = url;
      } else if (!window.open(url, "_blank")) {
        setNotice({
          kind: "info",
          text: "Your browser blocked the checkout window.",
          href: url,
          linkText: "Open checkout",
        });
      }
      startWatching();
    } catch (err) {
      try {
        win?.close();
      } catch {
        /* ignore */
      }
      if (err?.code === "already_pro") {
        await refresh({ force: true });
        setPricingOpen(false);
        setNotice({ kind: "success", text: "You're already on Pro." });
      } else {
        setNotice({ kind: "error", text: describeApiError(err) });
      }
    } finally {
      if (mounted.current) setBusy(null);
    }
  }, [busy, refresh, startWatching]);

  const openBillingPortal = useCallback(async () => {
    if (busy) return;
    const win = openPendingTab("Opening billing portal…");
    setBusy("portal");
    try {
      const url = await getPortalUrl();
      if (win && !win.closed) {
        win.location.href = url;
      } else if (!window.open(url, "_blank")) {
        setNotice({
          kind: "info",
          text: "Your browser blocked the billing window.",
          href: url,
          linkText: "Open billing portal",
        });
      }
    } catch (err) {
      try {
        win?.close();
      } catch {
        /* ignore */
      }
      setNotice({ kind: "error", text: describeApiError(err) });
    } finally {
      if (mounted.current) setBusy(null);
    }
  }, [busy]);

  const value = useMemo(
    () => ({
      status,
      error,
      loading: status === null && error === null,
      canUsePro: status?.isActive === true,
      waitingForPayment,
      busy,
      refresh: () => refresh({ force: true }),
      openPricing: () => setPricingOpen(true),
      closePricing: () => setPricingOpen(false),
      startCheckout,
      openBillingPortal,
      cancelWaiting: stopWatching,
    }),
    [status, error, waitingForPayment, busy, refresh, startCheckout, openBillingPortal, stopWatching],
  );

  return (
    <PlanContext.Provider value={value}>
      {children}
      {pricingOpen && <PricingModal />}
      {notice && <Toast notice={notice} onClose={() => setNotice(null)} />}
    </PlanContext.Provider>
  );
}

function Toast({ notice, onClose }) {
  const colors = {
    success: { bg: "#0f2e22", border: "#00d084" },
    error: { bg: "#2e1418", border: "#ff6b81" },
    info: { bg: "#13233d", border: "#3b82f6" },
  }[notice.kind] || { bg: "#13233d", border: "#3b82f6" };

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20000,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: "#e6edf3",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 12,
        maxWidth: "calc(100vw - 32px)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      <span>{notice.text}</span>
      {notice.href && (
        <a
          href={notice.href}
          target="_blank"
          rel="noreferrer"
          onClick={onClose}
          style={{ color: "#93c5fd", fontWeight: 700, whiteSpace: "nowrap" }}
        >
          {notice.linkText || "Open"}
        </a>
      )}
      <button
        onClick={onClose}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          color: "#8b949e",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

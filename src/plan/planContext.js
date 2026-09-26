// src/plan/planContext.js
import { createContext, useContext } from "react";

export const PlanContext = createContext(null);

// Everything plan-related the UI needs:
//   status          latest /api/users/me response (null until first load)
//   error           last ApiError from the backend (null if the last call worked)
//   canUsePro       true while Pro OR the 7-day trial is active
//   waitingForPayment  true after checkout opens, until Pro is confirmed
//   refresh()       re-fetch the plan now
//   openPricing() / closePricing()
//   startCheckout() / openBillingPortal()   MUST be called from a click handler
export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan() must be used inside <PlanProvider>");
  return ctx;
}

export function trialDaysLeft(status) {
  if (!status?.isTrialActive || !status.trialEndsAt) return 0;
  const ms = new Date(status.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

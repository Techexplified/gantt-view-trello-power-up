// src/componenets/PricingModal.jsx
import React, { useState } from "react";
import {
  X,
  Calendar,
  Move,
  Plus,
  ArrowLeftRight,
  List,
  Layers,
  LineChart,
  Target,
  Flag,
} from "lucide-react";
import { getStoredToken } from "../utils/auth";

const FREE_FEATURES = [
  { label: "Interactive Calendar View", icon: Calendar },
  { label: "Drag-and-Drop Scheduling", icon: Move },
  { label: "Quick Card Creation", icon: Plus },
  { label: "Drag to Reschedule", icon: ArrowLeftRight },
  { label: "Board Lists Panel", icon: List },
  { label: "Multi-Board Support", icon: Layers },
];

const PRO_ONLY_FEATURES = [
  { label: "Timeline Preview", icon: LineChart },
  { label: "Deadline & Progress Tracking", icon: Target },
  { label: "Add Milestones", icon: Flag },
];

const PRO_PRICE = 5; // USD / month

export default function PricingModal({ onClose }) {
  const [activeTab, setActiveTab] = useState("free"); // "free" | "pro"

  // replace the handleUpgradeClick stub with:
  const handleUpgradeClick = async () => {
    try {
      const token = getStoredToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/checkout/init`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error(`Checkout init failed: ${res.status}`);
      const { checkoutUrl } = await res.json();
      window.open(checkoutUrl, "_blank"); // opens Dodo's hosted checkout page
    } catch (err) {
      console.error("Failed to start checkout:", err);
      alert("Couldn't start checkout — please try again.");
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.logoBox}>T</div>
            <div>
              <div style={styles.title}>TaskFlow</div>
              <div style={styles.subtitle}>
                Plan. Organize. Get Things Done.
              </div>
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === "free" ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab("free")}
          >
            Free
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === "pro" ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab("pro")}
          >
            Pro
          </button>
        </div>

        {/* ── Plan card ── */}
        {activeTab === "free" ? (
          <div style={styles.card}>
            <span style={styles.planPill}>
              <span style={styles.planDot} />
              Free plan
            </span>
            <div style={styles.priceRow}>
              <span style={styles.priceSymbol}>$</span>
              <span style={styles.priceValue}>0</span>
              <span style={styles.pricePeriod}>/mo</span>
            </div>
            <p style={styles.tagline}>
              Get started with essential features. No card required.
            </p>
            <div style={styles.divider} />
            <ul style={styles.featureList}>
              {FREE_FEATURES.map(({ label, icon: Icon }) => (
                <li key={label} style={styles.featureRow}>
                  <span style={styles.featureIcon}>
                    <Icon size={15} />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <button style={styles.currentPlanBtn} disabled>
              Current plan
            </button>
          </div>
        ) : (
          <div style={styles.card}>
            <span style={styles.planPill}>
              <span style={styles.planDot} />
              Pro plan
            </span>
            <div style={styles.priceRow}>
              <span style={styles.priceSymbol}>$</span>
              <span style={styles.priceValue}>{PRO_PRICE}</span>
              <span style={styles.pricePeriod}>/mo</span>
            </div>
            <p style={styles.tagline}>
              Unlock everything TaskFlow has to offer.
            </p>
            <div style={styles.divider} />
            <ul style={styles.featureList}>
              <li style={styles.everythingInFree}>Everything in Free +</li>
              {PRO_ONLY_FEATURES.map(({ label, icon: Icon }) => (
                <li key={label} style={styles.featureRow}>
                  <span style={styles.featureIcon}>
                    <Icon size={15} />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <button style={styles.upgradeCtaBtn} onClick={handleUpgradeClick}>
              Upgrade to Pro
            </button>
          </div>
        )}

        <div style={styles.footer}>🔒 Secure checkout via Paddle</div>
      </div>
    </div>
  );
}

const ACCENT = "#3b82f6";

const styles = {
  // Scroll lives HERE — on the overlay — never inside the card itself.
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    overflowY: "auto",
    padding: "40px 16px",
    zIndex: 1000,
  },
  modal: {
    width: 380,
    maxWidth: "92vw",
    // No maxHeight / overflow here — the card grows to fit its content;
    // the overlay scrolls the page around it if needed.
    background: "#12172a",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 20,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    flexShrink: 0,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  logoBox: {
    width: 38,
    height: 38,
    borderRadius: 9,
    background: ACCENT,
    color: "#fff",
    fontWeight: 800,
    fontSize: 17,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: { color: "#e6edf3", fontSize: 16.5, fontWeight: 800 },
  subtitle: { color: "#8b949e", fontSize: 11.5, marginTop: 1 },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#8b949e",
    cursor: "pointer",
    padding: 4,
    borderRadius: 6,
  },
  tabs: { display: "flex", gap: 8, marginBottom: 14 },
  tab: {
    flex: 1,
    padding: "8px 0",
    borderRadius: 9,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent",
    color: "#8b949e",
    fontWeight: 700,
    fontSize: 12.5,
    cursor: "pointer",
  },
  tabActive: {
    border: `1px solid ${ACCENT}`,
    color: "#e6edf3",
    background: "rgba(59,130,246,0.12)",
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: 16,
  },
  planPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(59,130,246,0.12)",
    color: "#93c5fd",
    fontSize: 11.5,
    fontWeight: 700,
    borderRadius: 20,
    padding: "4px 10px",
    marginBottom: 12,
  },
  planDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: ACCENT,
    flexShrink: 0,
  },
  priceRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 3,
    marginBottom: 4,
  },
  priceSymbol: { color: "#e6edf3", fontSize: 16, fontWeight: 800 },
  priceValue: {
    color: "#e6edf3",
    fontSize: 32,
    fontWeight: 800,
    lineHeight: 1,
  },
  pricePeriod: {
    color: "#8b949e",
    fontSize: 12.5,
    marginLeft: 1,
    marginBottom: 3,
  },
  tagline: { color: "#8b949e", fontSize: 12, margin: "0 0 14px" },
  divider: { borderTop: "1px solid rgba(255,255,255,0.08)", marginBottom: 14 },
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: "0 0 16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  featureRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#e6edf3",
    fontSize: 13,
  },
  featureIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    background: "rgba(59,130,246,0.12)",
    color: ACCENT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  everythingInFree: {
    color: "#8b949e",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: -2,
  },
  currentPlanBtn: {
    width: "100%",
    padding: "10px 0",
    borderRadius: 9,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "transparent",
    color: "#8b949e",
    fontWeight: 700,
    fontSize: 13,
    cursor: "not-allowed",
  },
  upgradeCtaBtn: {
    width: "100%",
    padding: "10px 0",
    borderRadius: 9,
    border: "none",
    background: ACCENT,
    color: "#fff",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  footer: {
    textAlign: "center",
    color: "#6e7681",
    fontSize: 11.5,
    marginTop: 14,
  },
};

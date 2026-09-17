// src/componenets/PricingModal.jsx
import React, { useState } from "react";
import { X, Check, Sparkles } from "lucide-react";

const FREE_FEATURES = [
  "Interactive Calendar View",
  "Drag-and-Drop Scheduling",
  "Quick Card Creation",
  "Drag to Reschedule",
  "Board Lists Panel",
  "Multi-Board Support",
];

const PRO_ONLY_FEATURES = [
  "Timeline Preview",
  "Deadline & Progress Tracking",
  "Add Milestones",
];

const PRO_PRICE = 5; // USD / month

export default function PricingModal({ onClose }) {
  const [activeTab, setActiveTab] = useState("free"); // "free" | "pro"

  const handleUpgradeClick = () => {
    // No payment provider is wired into this project yet — this is a
    // placeholder until that's built. Swap this out for a real checkout
    // call once billing is added.
    alert("Upgrades aren't available yet — check back soon!");
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
            <X size={18} />
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
            <span style={styles.planPill}>Free plan</span>
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
              {FREE_FEATURES.map((f) => (
                <li key={f} style={styles.featureRow}>
                  <span style={styles.featureIcon}>
                    <Check size={14} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <button style={styles.currentPlanBtn} disabled>
              Current plan
            </button>
          </div>
        ) : (
          <div style={styles.card}>
            <span style={styles.planPillPro}>
              <Sparkles size={12} style={{ marginRight: 4 }} />
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
              {PRO_ONLY_FEATURES.map((f) => (
                <li key={f} style={styles.featureRow}>
                  <span style={styles.featureIconPro}>
                    <Check size={14} />
                  </span>
                  {f}
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

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    width: 420,
    maxWidth: "92vw",
    maxHeight: "88vh",
    overflowY: "auto",
    background: "#1a1f2e",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 24,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: "linear-gradient(135deg, #7c5cff, #5b3df0)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: { color: "#e6edf3", fontSize: 18, fontWeight: 800 },
  subtitle: { color: "#8b949e", fontSize: 12.5, marginTop: 2 },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#8b949e",
    cursor: "pointer",
    padding: 4,
    borderRadius: 6,
  },
  tabs: {
    display: "flex",
    gap: 8,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    padding: "10px 0",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent",
    color: "#8b949e",
    fontWeight: 700,
    fontSize: 13.5,
    cursor: "pointer",
  },
  tabActive: {
    border: "1px solid #7c5cff",
    color: "#e6edf3",
    background: "rgba(124,92,255,0.12)",
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: 20,
  },
  planPill: {
    display: "inline-block",
    background: "rgba(255,255,255,0.08)",
    color: "#8b949e",
    fontSize: 12,
    fontWeight: 700,
    borderRadius: 20,
    padding: "4px 12px",
    marginBottom: 14,
  },
  planPillPro: {
    display: "inline-flex",
    alignItems: "center",
    background: "rgba(124,92,255,0.15)",
    color: "#a78bfa",
    fontSize: 12,
    fontWeight: 700,
    borderRadius: 20,
    padding: "4px 12px",
    marginBottom: 14,
  },
  priceRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 4,
    marginBottom: 6,
  },
  priceSymbol: { color: "#e6edf3", fontSize: 22, fontWeight: 800 },
  priceValue: {
    color: "#e6edf3",
    fontSize: 40,
    fontWeight: 800,
    lineHeight: 1,
  },
  pricePeriod: {
    color: "#8b949e",
    fontSize: 14,
    marginLeft: 2,
    marginBottom: 4,
  },
  tagline: { color: "#8b949e", fontSize: 13, margin: "0 0 16px" },
  divider: { borderTop: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 },
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: "0 0 20px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  featureRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#e6edf3",
    fontSize: 14,
  },
  featureIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    background: "rgba(0,208,132,0.15)",
    color: "#00d084",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureIconPro: {
    width: 22,
    height: 22,
    borderRadius: 6,
    background: "rgba(124,92,255,0.15)",
    color: "#a78bfa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  everythingInFree: {
    color: "#8b949e",
    fontSize: 13,
    fontWeight: 700,
    marginBottom: -2,
  },
  currentPlanBtn: {
    width: "100%",
    padding: "12px 0",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "transparent",
    color: "#8b949e",
    fontWeight: 700,
    fontSize: 14,
    cursor: "not-allowed",
  },
  upgradeCtaBtn: {
    width: "100%",
    padding: "12px 0",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #7c5cff, #5b3df0)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  footer: {
    textAlign: "center",
    color: "#6e7681",
    fontSize: 12,
    marginTop: 16,
  },
};

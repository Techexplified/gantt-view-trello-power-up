import React, { useState } from "react";
import { authorizeWithTrello } from "../utils/auth";
import { ChartNoAxesGantt } from "lucide-react";

export default function LoginScreen({ onAuth }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await authorizeWithTrello();
      onAuth(token);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      {/* subtle grid background */}
      <div style={styles.gridBg} />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(0,208,132,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ChartNoAxesGantt size={22} color="#00d084" />
          </div>
          <span style={styles.logoText}>TaskFlow</span>
        </div>

        <div style={styles.divider} />

        <h1 style={styles.heading}>Welcome to TaskFlow!</h1>
        <p style={styles.subtext}>To get started, please sign in</p>

        {error && <div style={styles.error}>{error}</div>}

        <button
          style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}
          onClick={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <>
              <Spinner />
              <span>Connecting…</span>
            </>
          ) : (
            <>
              <TrelloIcon />
              <span>Sign in with Trello</span>
            </>
          )}
        </button>

        <p style={styles.footer}>
          By signing in, you agree to grant TaskFlow read access to your Trello
          boards.
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        marginRight: 8,
      }}
    />
  );
}

function TrelloIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="white"
      style={{ marginRight: 8 }}
    >
      <rect x="1" y="1" width="10" height="14" rx="2" />
      <rect x="13" y="1" width="10" height="9" rx="2" />
    </svg>
  );
}

const styles = {
  wrapper: {
    width: "100vw",
    height: "100vh",
    background: "#1a1f2e",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  gridBg: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    pointerEvents: "none",
  },
  card: {
    background: "rgba(30,36,50,0.95)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: "48px 52px",
    width: "calc(100% - 48px)",
    maxWidth: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 0,
    boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
    backdropFilter: "blur(16px)",
    position: "relative",
    zIndex: 1,
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 700,
    color: "#e6edf3",
    letterSpacing: "-0.5px",
  },
  divider: {
    width: "100%",
    height: 1,
    background: "rgba(255,255,255,0.07)",
    marginBottom: 36,
  },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    color: "#e6edf3",
    margin: "0 0 10px",
    textAlign: "center",
  },
  subtext: {
    fontSize: 14,
    color: "#8b949e",
    margin: "0 0 28px",
    textAlign: "center",
  },
  error: {
    background: "rgba(220,53,69,0.15)",
    border: "1px solid rgba(220,53,69,0.4)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#ff8fa3",
    fontSize: 13,
    marginBottom: 16,
    width: "100%",
    textAlign: "center",
  },
  btn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0079bf, #026aa7)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "14px 28px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    width: "auto",
    minWidth: 260,
    maxWidth: 360,
    alignSelf: "center",
    transition: "opacity 0.2s, transform 0.15s",
    marginBottom: 20,
    letterSpacing: "0.2px",
  },
  btnDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
  footer: {
    fontSize: 11,
    color: "#484f58",
    textAlign: "center",
    lineHeight: 1.6,
    margin: 0,
  },
};

// Inject keyframe animation for the spinner
const styleTag = document.createElement("style");
styleTag.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(styleTag);

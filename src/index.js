import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Reset default browser styles
const reset = document.createElement("style");
reset.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #1a1f2e; color: #e6edf3; font-family: 'Segoe UI', system-ui, sans-serif; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
  button:focus-visible { outline: 2px solid #00d084; outline-offset: 2px; }
  html, body, #root {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
#root { width: 100%; height: 100%; display: flex; flex-direction: column; }
`;
document.head.appendChild(reset);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles.css";

// Intercept global fetch to redirect relative API & Auth calls to VITE_API_URL if configured
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  let url = typeof input === "string" ? input : (input as Request).url;
  const apiHost = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

  if (apiHost && (url.startsWith("/api/") || url.startsWith("/auth/"))) {
    url = `${apiHost}${url}`;
    if (typeof input === "string") {
      input = url;
    } else {
      input = new Request(url, input as any);
    }
    // Cross-origin request requires credentials: "include" for cookie session passing
    if (init) {
      init.credentials = "include";
    } else {
      init = { credentials: "include" };
    }
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

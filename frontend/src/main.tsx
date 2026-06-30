import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles.css";

// Intercept global fetch to redirect relative API & Auth calls to VITE_API_URL if configured
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  let url = typeof input === "string" ? input : (input as Request).url;
  const apiHost = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  const isApiOrAuth = url.startsWith("/api/") || url.startsWith("/auth/");

  if (isApiOrAuth) {
    if (apiHost) {
      url = `${apiHost}${url}`;
      if (typeof input === "string") {
        input = url;
      } else {
        input = new Request(url, input as any);
      }
    }

    // Ensure credentials are sent
    init = init || {};
    init.credentials = "include";

    // Inject token if present (cross-origin fallback)
    const token = localStorage.getItem("sn_token");
    if (token) {
      const headers = new Headers(init.headers || {});
      headers.set("Authorization", `Bearer ${token}`);
      init.headers = headers;
    }
  }
  return originalFetch(input, init);
};

// Keep-alive ping to prevent Render free tier backend from spinning down (sleeps after 15 mins)
setInterval(() => {
  fetch("/api/health").catch(() => {});
}, 12 * 60 * 1000);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";

// A home-screen install on iOS is rarely fully quit, so it can go a long
// time without the browser-level check the injected SW registration does
// on page load. Poll explicitly so "autoUpdate" actually reaches devices
// that just get backgrounded and reopened, like Emma's — hourly in case the
// app is just left open, and also right away whenever it's reopened/brought
// to the foreground, since that's the moment someone's most likely to hit a
// stale build (an hour is a long time to wait after a fresh deploy).
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    setInterval(() => registration.update(), 60 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") registration.update();
    });
    window.addEventListener("pageshow", () => registration.update());
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

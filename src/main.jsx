import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";

// A home-screen install on iOS is rarely fully quit, so it can go a long
// time without the browser-level check the injected SW registration does
// on page load. Poll explicitly so "autoUpdate" actually reaches devices
// that just get backgrounded and reopened, like Emma's.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    setInterval(() => registration.update(), 60 * 60 * 1000);
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

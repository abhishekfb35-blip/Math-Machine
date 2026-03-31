import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(r => r.unregister());
    });
    if (typeof caches !== 'undefined') {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
  }
}

createRoot(document.getElementById("root")!).render(<App />);

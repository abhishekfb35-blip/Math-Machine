import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Catch any JS crash (incl. useEffect errors that bypass React error boundaries)
// and display the error even after React unmounts #root.
window.addEventListener('error', (event) => {
  setTimeout(() => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;background:#fff3f3;color:#900;font:13px monospace;padding:32px;z-index:99999;white-space:pre-wrap;overflow:auto;border-top:4px solid #c00';
    div.textContent = 'CRASH CAUGHT:\n\n' + event.message + '\n\nat ' + event.filename + ':' + event.lineno + '\n\n' + (event.error?.stack ?? '(no stack)');
    document.body?.appendChild(div);
  }, 200);
});
window.addEventListener('unhandledrejection', (event) => {
  setTimeout(() => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;background:#fff3f3;color:#900;font:13px monospace;padding:32px;z-index:99999;white-space:pre-wrap;overflow:auto;border-top:4px solid #c00';
    div.textContent = 'UNHANDLED REJECTION:\n\n' + String(event.reason?.message ?? event.reason) + '\n\n' + (event.reason?.stack ?? '(no stack)');
    document.body?.appendChild(div);
  }, 200);
});

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);

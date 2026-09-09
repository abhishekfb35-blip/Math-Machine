import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloadingForUpdate = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloadingForUpdate) return;
      reloadingForUpdate = true;
      window.location.reload();
    });

    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        updateViaCache: "none",
      });

      const checkForUpdate = () => {
        if (document.visibilityState === "visible") {
          registration.update().catch(() => {});
        }
      };

      await registration.update();
      document.addEventListener("visibilitychange", checkForUpdate);
    } catch {
      // The storefront remains fully usable when service workers are unavailable.
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);

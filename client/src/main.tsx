import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { queryClient } from "./lib/queryClient";

function seedInitialQueries() {
  const node = document.getElementById("catalogue-initial-data");
  if (!node?.textContent) return;

  try {
    const payload: unknown = JSON.parse(node.textContent);
    if (payload && typeof payload === "object" && "queries" in payload) {
      const queries = (payload as { queries?: unknown }).queries;
      if (Array.isArray(queries)) {
        for (const query of queries) {
          if (!query || typeof query !== "object") continue;
          const entry = query as { queryKey?: unknown; data?: unknown };
          if (Array.isArray(entry.queryKey) && "data" in entry) {
            queryClient.setQueryData(entry.queryKey, entry.data);
          }
        }
      }
    }
  } catch (error) {
    console.error("Could not read initial storefront data:", error);
  } finally {
    node.remove();
  }
}

seedInitialQueries();
document.querySelectorAll("[data-storefront-seo]").forEach((node) => node.remove());

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

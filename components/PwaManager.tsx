"use client";
import { useEffect, useState } from "react";
import { detectLegacy } from "../lib/data/legacy";
export default function PwaManager() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    )
      return;
    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    void detectLegacy()
      .catch(() => null)
      .then(() =>
        navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }),
      )
      .then((r) => {
        if (!active) return;
        registration = r;
        if (r.waiting) setWaiting(r.waiting);
        r.addEventListener("updatefound", () => {
          const worker = r.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setWaiting(worker);
          });
        });
        timer = setInterval(() => void r.update(), 60 * 60 * 1000);
      })
      .catch(() => {});
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  return waiting ? (
    <button
      className="pwa-update"
      onClick={() => {
        waiting.postMessage({ type: "ACTIVATE" });
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => window.location.reload(),
          { once: true },
        );
      }}
    >
      Nueva versión disponible · actualizar
    </button>
  ) : null;
}

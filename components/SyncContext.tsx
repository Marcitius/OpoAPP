"use client";
import { createContext, useContext } from "react";
import type { SyncEngine } from "../lib/sync/engine";
export const SyncContext = createContext<SyncEngine | null>(null);
export function useEngine() {
  const engine = useContext(SyncContext);
  if (!engine) throw new Error("No hay sesión activa.");
  return engine;
}

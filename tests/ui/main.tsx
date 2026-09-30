// Isolated component fixtures for responsive QA. Production always uses Supabase Auth + SyncEngine.
import React from "react";
import { createRoot } from "react-dom/client";
import OpoApp from "../../app/OpoApp";
import { SyncContext } from "../../components/SyncContext";
import { emptyState } from "../../lib/data/models";
import "../../app/globals.css";
import "../../app/account.css";
const state = emptyState();
const today = new Date().toLocaleDateString("en-CA");
state.studyNodes = [
  {
    id: "root",
    name: "Constitución Española",
    parentId: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: "title",
    name: "Título IX — Tribunal Constitucional",
    parentId: "root",
    createdAt: new Date().toISOString(),
  },
  {
    id: "article",
    name: "Artículo 164 — Sentencias del Tribunal Constitucional",
    parentId: "title",
    createdAt: new Date().toISOString(),
  },
];
state.studyTasks = [
  {
    id: "task",
    nodeId: "article",
    plannedFor: today,
    note: "Me cuesta recordar la literalidad.",
    reason: "regular",
    status: "pending",
    createdAt: new Date().toISOString(),
    completedAt: null,
    assessment: null,
    completionNote: "",
    queueOrder: 0,
  },
];
const listeners = new Set<() => void>();
const engine = {
  state,
  status: { phase: "saved", pending: 0 },
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  update: async (_before: any, next: any) => {
    engine.state = next;
    listeners.forEach((fn) => fn());
  },
};
createRoot(document.getElementById("root")!).render(
  <SyncContext.Provider value={engine as any}>
    <OpoApp />
  </SyncContext.Provider>,
);

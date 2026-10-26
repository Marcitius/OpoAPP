"use client";
import { useEffect, useRef } from "react";
import type { SessionPresentation } from "../../lib/memory/session";
import { writeReviewDraft } from "../../lib/memory/draft";

// Small, account-scoped draft writes never update the app-wide account. The
// canonical checkpoint is coalesced; exit/visibility always drain the latest view.
export default function useSessionCheckpoint(config: {
  user: string;
  revision: string | undefined;
  getRevision: (id: string) => string | undefined;
  id: string | undefined;
  turn: number;
  open: boolean;
  busy: boolean;
  presentation: SessionPresentation;
  onSave: (
    id: string,
    turn: number,
    view: SessionPresentation,
  ) => Promise<boolean>;
}) {
  const latest = useRef(config);
  latest.current = config;
  const last = useRef("");
  const chain = useRef(Promise.resolve(true));
  const draftChain = useRef(Promise.resolve());
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const generation = useRef(0);
  const serial = JSON.stringify(config.presentation);
  const journal = () => {
    const s = latest.current;
    if (!s.id || !s.revision || !s.open || s.busy) return;
    const { user, id, turn, presentation } = s;
    const base = s.getRevision(id) ?? s.revision;
    // Snapshot before queuing: later input must not mutate the stored envelope.
    draftChain.current = draftChain.current
      .catch(() => {})
      .then(() => writeReviewDraft(user, id, turn, base, presentation));
    void draftChain.current.catch(() => {});
  };
  const flush = () => {
    clearTimeout(pending.current);
    const perform = async () => {
      const s = latest.current;
      if (!s.open || !s.id || s.busy) return !s.busy;
      const key = s.id + ":" + s.turn + ":" + JSON.stringify(s.presentation);
      if (last.current === key) return true;
      const before = generation.current;
      const ok = await s.onSave(s.id, s.turn, s.presentation);
      if (ok) {
        last.current = key;
        // Input typed during a canonical write must be rebased onto that commit,
        // otherwise an abrupt reload could discard the newer local draft.
        const current = latest.current;
        if (
          before !== generation.current &&
          current.id === s.id &&
          current.turn === s.turn
        )
          journal();
      }
      return ok;
    };
    chain.current = chain.current.catch(() => false).then(perform);
    return chain.current;
  };
  const stage = (patch: Partial<SessionPresentation>) => {
    generation.current++;
    latest.current = {
      ...latest.current,
      presentation: { ...latest.current.presentation, ...patch },
    };
    journal();
    clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      void flush();
    }, 1500);
  };
  useEffect(() => {
    if (!config.open || config.busy || !config.id) return;
    clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      void flush();
    }, 1500);
    return () => clearTimeout(pending.current);
  }, [config.id, config.turn, config.open, config.busy, serial]);
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const pagehide = () => {
      void flush();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", pagehide);
    return () => {
      clearTimeout(pending.current);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", pagehide);
    };
  }, []);
  return Object.assign(flush, { stage });
}

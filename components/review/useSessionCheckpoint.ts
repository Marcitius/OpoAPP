"use client";
import { useEffect, useRef } from "react";
import type { SessionPresentation } from "../../lib/memory/session";

// Checkpoints use the app's existing local transaction/outbox. Draft text is
// coalesced; pause and visibility changes flush it immediately.
export default function useSessionCheckpoint({
  id,
  turn,
  open,
  busy,
  presentation,
  onSave,
}: {
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
  const latest = useRef({ id, turn, open, busy, presentation, onSave });
  latest.current = { id, turn, open, busy, presentation, onSave };
  const last = useRef("");
  const serial = JSON.stringify(presentation);
  const flush = async () => {
    const s = latest.current;
    if (!s.open || !s.id || s.busy) return !s.busy;
    const key = s.id + ":" + s.turn + ":" + JSON.stringify(s.presentation);
    if (last.current === key) return true;
    const ok = await s.onSave(s.id, s.turn, s.presentation);
    if (ok) last.current = key;
    return ok;
  };
  useEffect(() => {
    if (!open || busy || !id) return;
    const timer = setTimeout(() => {
      void flush();
    }, 150);
    return () => clearTimeout(timer);
  }, [id, turn, open, busy, serial]);
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
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", pagehide);
    };
  }, []);
  return flush;
}

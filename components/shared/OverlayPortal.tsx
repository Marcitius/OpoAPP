"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Keep document editors above sheets and outside their transformed containers.
export default function OverlayPortal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    if (!root) return;
    const controls = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length);
    controls()[0]?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (
        Array.from(document.querySelectorAll(".overlay-portal")).at(-1) !== root
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const all = controls(),
        first = all[0],
        last = all.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return typeof document === "undefined"
    ? null
    : createPortal(
        <div className="overlay-portal" ref={ref}>
          {children}
        </div>,
        document.body,
      );
}

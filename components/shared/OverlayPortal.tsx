"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { nextOverlayLayer, isTopOverlay } from "./overlayLayer";
import { createPortal } from "react-dom";

// Keep document editors above sheets and outside their transformed containers.
export default function OverlayPortal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const [layer] = useState(nextOverlayLayer);
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
    root.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (!isTopOverlay(root)) return;
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
      if (!root.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === root)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === root)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (
        previous?.isConnected &&
        !previous.matches("input,textarea,select,[contenteditable=true]")
      )
        previous.focus({ preventScroll: true });
    };
  }, []);
  return typeof document === "undefined"
    ? null
    : createPortal(
        <div
          className="overlay-portal"
          data-overlay-layer={layer}
          style={{ zIndex: layer }}
          tabIndex={-1}
          ref={ref}
        >
          {children}
        </div>,
        document.body,
      );
}

"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import Icon from "../shared/Icon";
export default function BottomSheet({
  title,
  subtitle,
  children,
  onClose,
  fullScreen = false,
  className = "",
  dismissible = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  fullScreen?: boolean;
  className?: string;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLElement>(null),
    id = useId(),
    startY = useRef<number | null>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    if (!el.contains(document.activeElement)) el.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (document.querySelector(".overlay-portal")) return;
      if (e.key === "Escape" && dismissible) {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key !== "Tab") return;
      const all = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]):not([hidden]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]',
        ),
      ).filter((x) => x.getClientRects().length);
      const first = all[0],
        last = all.at(-1);
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === el)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || document.activeElement === el)
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [dismissible]);
  return (
    <div
      className="sheet-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`ux-sheet ${fullScreen ? "sheet-fullscreen" : ""} ${className}`}
      >
        <div
          className="sheet-drag-area"
          aria-hidden="true"
          onPointerDown={(e) => {
            startY.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            if (
              startY.current !== null &&
              e.clientY - startY.current > 70 &&
              dismissible
            )
              onClose();
            startY.current = null;
          }}
        >
          <i />
        </div>
        <header className="sheet-header">
          <div>
            <h2 id={id}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar"
            disabled={!dismissible}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-content">{children}</div>
      </section>
    </div>
  );
}

"use client";
import type { ReactNode } from "react";
import BottomSheet from "./BottomSheet";
export function ModalShell({
  title,
  subtitle,
  label = "NUEVO",
  onClose,
  children,
  dismissible = true,
}: {
  title: string;
  subtitle: string;
  label?: string;
  onClose: () => void;
  children: ReactNode;
  dismissible?: boolean;
}) {
  const fullScreen = /tarjeta|importar|psicotécnico/i.test(title);
  return (
    <BottomSheet
      dismissible={dismissible}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      fullScreen={fullScreen}
      className="legacy-editor"
    >
      <span className="ux-label">{label}</span>
      {children}
    </BottomSheet>
  );
}

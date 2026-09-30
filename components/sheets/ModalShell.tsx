"use client";
import type { ReactNode } from "react";
import BottomSheet from "./BottomSheet";
export function ModalShell({
  title,
  subtitle,
  label = "NUEVO",
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  label?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const fullScreen = /tarjeta|importar|psicotécnico/i.test(title);
  return (
    <BottomSheet
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

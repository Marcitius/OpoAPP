"use client";
import { useRef, type ReactNode } from "react";
// Preserve the mounted screen and its local UI state while an immersive session
// is in front. Refresh it with the newest data immediately when the session exits.
export default function StudyBackground({
  frozen,
  children,
}: {
  frozen: boolean;
  children: ReactNode;
}) {
  const content = useRef(children);
  if (!frozen) content.current = children;
  return content.current;
}

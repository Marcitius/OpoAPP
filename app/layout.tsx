import type { Metadata, Viewport } from "next";
import "@fontsource/geist/latin-400.css";
import "@fontsource/geist/latin-500.css";
import "@fontsource/geist/latin-600.css";
import "@fontsource/geist/latin-700.css";
import PwaManager from "../components/PwaManager";
import "./globals.css";
import "./account.css";
export const metadata: Metadata = {
  title: "OpoGC",
  description: "Organiza, estudia y repasa tu oposición",
  applicationName: "OpoGC",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "OpoGC" },
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = {
  themeColor: "#285943",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <PwaManager />
      </body>
    </html>
  );
}

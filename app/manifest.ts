import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpoGC · Preparación inteligente",
    short_name: "OpoGC",
    description: "Tarjetas adaptativas, psicotécnicos y progreso para Guardia Civil",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F3ED",
    theme_color: "#285943",
    orientation: "any",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/maskable-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

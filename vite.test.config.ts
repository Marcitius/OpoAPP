// Component layout harness only. It is not included in the production export.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("test") },
  server: { host: "127.0.0.1", port: 4174 },
  build: { outDir: "test-results/component-build" },
});

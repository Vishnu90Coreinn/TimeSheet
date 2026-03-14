import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward /api/* to the ASP.NET Core dev server, bypassing CORS and
      // self-signed certificate issues entirely in local development
      "/api": {
        target: "https://localhost:7012",
        changeOrigin: true,
        secure: false, // trust the ASP.NET Core self-signed dev cert
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});

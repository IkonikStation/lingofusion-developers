import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/lingofusion-developers/" : "/",
  plugins: [react()],
  oxc: { jsx: { importSource: "@lingofusion/localization" } },
  resolve: { alias: { "@lingofusion/localization": new URL("./src/locales", import.meta.url).pathname } },
  optimizeDeps: { exclude: ["@lingofusion/localization/jsx-runtime", "@lingofusion/localization/jsx-dev-runtime"] },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/v1": "http://127.0.0.1:8787",
    },
  },
}));

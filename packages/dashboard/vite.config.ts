import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import ipServicePackage from "../ip-service/package.json";

export default defineConfig({
  base: "/admin/",
  define: {
    __ECHO_VERSION__: JSON.stringify(ipServicePackage.version),
  },
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 7011,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:7010",
      },
    },
  },
});

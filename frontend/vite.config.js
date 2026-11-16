import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development the API answers on the same address as the page, so the browser sends the
    // session cookie with no CORS setup (backend PORT in backend/.env)
    proxy: {
      "/api": "http://localhost:5600",
    },
  },
});

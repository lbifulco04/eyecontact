import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Il backend FastAPI gira di default su :8000 (vedi docker-compose.yaml / BACKEND_PORT).
// In sviluppo proxughiamo /api verso il backend per evitare problemi CORS/URL hardcoded.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // necessario per essere raggiungibile da fuori il container Docker
    port: 5173,
    proxy: {
      // Usato solo se VITE_API_URL non è impostata (vedi src/lib/api.js) e si vuole
      // chiamare il backend con percorsi relativi "/api/..." in dev.
      "/api": {
        target: process.env.VITE_BACKEND_ORIGIN || "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
});

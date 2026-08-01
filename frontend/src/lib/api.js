import axios from "axios";

// In dev, Vite proxya /api verso il backend FastAPI (vedi vite.config.js), quindi
// baseURL relativo "/api/v1" basta e avanza.
// In produzione (build statica servita da un altro dominio) VITE_API_URL deve puntare
// all'origine del backend (es. https://api.tuodominio.com), senza il prefisso /api/v1.
const apiOrigin = import.meta.env.VITE_API_URL;
const baseURL = apiOrigin ? `${apiOrigin.replace(/\/$/, "")}/api/v1` : "/api/v1";

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("eyecontact_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Se il token è scaduto/non valido, il backend risponde 401: ripuliamo la sessione locale.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("eyecontact_token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(error, fallback = "Si è verificato un errore imprevisto.") {
  return error?.response?.data?.detail || error?.message || fallback;
}

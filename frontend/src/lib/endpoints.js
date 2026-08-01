import { api } from "./api.js";

// --- auth.py ---
export const AuthAPI = {
  register: (payload) => api.post("/auth/register", payload),
  // /auth/login usa OAuth2PasswordRequestForm -> richiede form-urlencoded, non JSON
  login: (email, password) => {
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);
    return api.post("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },
  me: () => api.get("/auth/me"),
};

// --- exercises.py ---
export const ExercisesAPI = {
  list: () => api.get("/exercises/"),
  recommended: (affaticamentoPre = 5) =>
    api.get("/exercises/recommended", { params: { affaticamento_pre: affaticamentoPre } }),
  detail: (id) => api.get(`/exercises/${id}`),
};

// --- sessions.py ---
export const SessionsAPI = {
  create: (payload) => api.post("/sessions/", payload),
  mine: () => api.get("/sessions/me"),
  detail: (id) => api.get(`/sessions/${id}`),
  addExercise: (idSessione, payload) => api.post(`/sessions/${idSessione}/esercizi`, payload),
};

// --- metrics.py ---
export const MetricsAPI = {
  dashboard: () => api.get("/metrics/dashboard"),
};

// --- calibration.py ---
export const CalibrationAPI = {
  save: (payload) => api.post("/calibration/", payload),
  me: () => api.get("/calibration/me"),
};

// --- achievements.py ---
export const AchievementsAPI = {
  mine: () => api.get("/achievements/me"),
};

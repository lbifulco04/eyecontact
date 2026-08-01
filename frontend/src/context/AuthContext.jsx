import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AuthAPI } from "../lib/endpoints.js";
import { warmupGazeEngine, disposeGazeEngine } from "../lib/gazeEngine.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Parte subito, in parallelo alla verifica del token: se l'utente ha già una sessione valida
  // (caso più comune), il modello di tracciamento inizia a scaricarsi mentre /auth/me è ancora
  // in volo, invece di aspettare che la chiamata finisca prima di partire.
  useEffect(() => {
    warmupGazeEngine().catch(() => {});
  }, []);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("eyecontact_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await AuthAPI.me();
      setUser(data);
    } catch {
      localStorage.removeItem("eyecontact_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Precarica il modello di eye-tracking in background non appena sappiamo che l'utente
  // è autenticato: quando arriverà alla pagina di calibrazione o al primo esercizio,
  // il worker sarà già caldo invece di far attendere il download+parsing del modello.
  useEffect(() => {
    if (user) warmupGazeEngine().catch(() => {});
  }, [user]);

  const login = async (email, password) => {
    const { data } = await AuthAPI.login(email, password);
    localStorage.setItem("eyecontact_token", data.access_token);
    await loadUser();
  };

  const register = async (payload) => {
    const { data } = await AuthAPI.register(payload);
    localStorage.setItem("eyecontact_token", data.access_token);
    await loadUser();
  };

  const logout = () => {
    localStorage.removeItem("eyecontact_token");
    setUser(null);
    disposeGazeEngine();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve essere usato dentro AuthProvider");
  return ctx;
}

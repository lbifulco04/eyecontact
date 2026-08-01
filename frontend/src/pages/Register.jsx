import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../lib/api.js";
import GazeTarget from "../components/GazeTarget.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", nome_display: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      navigate("/calibrazione");
    } catch (err) {
      setError(apiErrorMessage(err, "Registrazione non riuscita."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <GazeTarget size={56} color="lilac" />
          <h1 className="font-display text-2xl font-semibold mt-4">Crea il tuo profilo</h1>
          <p className="text-ink-500 text-sm mt-1">Inizia a monitorare i tuoi esercizi oculari</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel p-6 flex flex-col gap-4">
          {error && (
            <div className="text-sm text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-500 font-medium">Nome (opzionale)</span>
            <input className="input-field" value={form.nome_display} onChange={update("nome_display")} placeholder="Come vuoi essere chiamato" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-500 font-medium">Email</span>
            <input type="email" required className="input-field" value={form.email} onChange={update("email")} placeholder="tu@esempio.com" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-500 font-medium">Password</span>
            <input type="password" required minLength={8} className="input-field" value={form.password} onChange={update("password")} placeholder="Almeno 8 caratteri" />
          </label>
          <button type="submit" disabled={loading} className="btn-primary mt-2 disabled:opacity-60">
            {loading ? "Creazione in corso…" : "Crea account"}
          </button>
        </form>

        <p className="text-center text-sm text-ink-500 mt-6">
          Hai già un account?{" "}
          <Link to="/login" className="text-sea-500 hover:underline">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}

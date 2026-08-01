import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../lib/api.js";
import GazeTarget from "../components/GazeTarget.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(apiErrorMessage(err, "Email o password non corrette."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <GazeTarget size={56} />
          <h1 className="font-display text-2xl font-semibold mt-4">Bentornato</h1>
          <p className="text-ink-500 text-sm mt-1">Accedi per continuare il tuo allenamento</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel p-6 flex flex-col gap-4">
          {error && (
            <div className="text-sm text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-500 font-medium">Email</span>
            <input
              type="email"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@esempio.com"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-500 font-medium">Password</span>
            <input
              type="password"
              required
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <button type="submit" disabled={loading} className="btn-primary mt-2 disabled:opacity-60">
            {loading ? "Accesso in corso…" : "Accedi"}
          </button>
        </form>

        <p className="text-center text-sm text-ink-500 mt-6">
          Non hai un account?{" "}
          <Link to="/registrati" className="text-sea-500 hover:underline">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}

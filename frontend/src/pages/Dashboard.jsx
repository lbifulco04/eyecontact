import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetricsAPI } from "../lib/endpoints.js";
import { apiErrorMessage } from "../lib/api.js";
import StatCard from "../components/StatCard.jsx";
import WeeklyChart from "../components/WeeklyChart.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    MetricsAPI.dashboard()
      .then(({ data }) => setData(data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <span className="eyebrow">Dashboard</span>
      <h1 className="font-display text-3xl font-semibold mt-2">
        Bentornato, {user?.nome_display || user?.email?.split("@")[0]}
      </h1>

      {error && (
        <div className="mt-6 text-sm text-amber-400 bg-amber-400/10 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {!data && !error && (
        <div className="mt-10 text-ink-500 text-sm">Caricamento metriche…</div>
      )}

      {data && (
        <>
          <div className="grid sm:grid-cols-3 gap-5 mt-8">
            <StatCard label="Streak" value={data.streak_giorni} unit="giorni consecutivi" />
            <StatCard
              label="Tempo totale"
              value={data.tempo_totale_minuti}
              unit="minuti"
              accent="lilac"
            />
            <StatCard label="Sessioni completate" value={data.sessioni_completate_totali} unit="totali" />
          </div>

          <div className="grid lg:grid-cols-3 gap-5 mt-5">
            <div className="lg:col-span-2">
              <WeeklyChart data={data.attivita_settimanale} />
            </div>
            <div className="glass-panel p-6 flex flex-col justify-between">
              <div>
                <span className="eyebrow">Ultimo allenamento</span>
                <p className="font-display text-lg mt-2">
                  {data.ultimo_allenamento
                    ? new Date(data.ultimo_allenamento).toLocaleString("it-IT")
                    : "Nessun allenamento ancora registrato"}
                </p>
              </div>
              <Link to="/esercizi" className="btn-primary mt-6">
                Inizia un esercizio
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

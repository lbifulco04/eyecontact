import React from "react";
import { useNavigate } from "react-router-dom";

const CATEGORY_COLOR = {
  Fissazione: "sea",
  Saccadi: "lilac",
  Inseguimento: "sea",
};

export default function ExerciseCard({ esercizio }) {
  const navigate = useNavigate();
  const accent = CATEGORY_COLOR[esercizio.categoria] || "sea";
  const accentText = accent === "lilac" ? "text-lilac-600" : "text-sea-600";

  return (
    <button
      onClick={() => navigate(`/esercizi/${esercizio.id_esercizio}`)}
      className="glass-panel p-6 text-left hover:border-lilac-400/50 hover:-translate-y-0.5 transition group w-full"
    >
      <div className="flex items-center justify-between">
        <span className={`eyebrow ${accentText}`}>{esercizio.categoria || "Esercizio"}</span>
        <span className="font-mono text-xs text-ink-300">
          {esercizio.durata_consigliata_sec}s
        </span>
      </div>
      <h3 className="font-display text-xl font-semibold mt-3 group-hover:text-lilac-600 transition">
        {esercizio.nome}
      </h3>
      {esercizio.descrizione && (
        <p className="text-sm text-ink-500 mt-2 line-clamp-2">{esercizio.descrizione}</p>
      )}
    </button>
  );
}

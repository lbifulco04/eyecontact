import React, { useEffect, useState } from "react";
import { ExercisesAPI } from "../lib/endpoints.js";
import { apiErrorMessage } from "../lib/api.js";
import ExerciseCard from "../components/ExerciseCard.jsx";

export default function Exercises() {
  const [esercizi, setEsercizi] = useState([]);
  const [affaticamento, setAffaticamento] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRecommended = (livello) => {
    setLoading(true);
    ExercisesAPI.recommended(livello)
      .then(({ data }) => setEsercizi(data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRecommended(affaticamento);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <span className="eyebrow">Catalogo</span>
      <h1 className="font-display text-3xl font-semibold mt-2">Scegli il tuo esercizio</h1>
      <p className="text-ink-500 mt-2 max-w-xl">
        Indica il tuo livello di affaticamento visivo attuale: ti consigliamo gli esercizi più
        adatti in questo momento.
      </p>

      <div className="glass-panel p-5 mt-6 flex items-center gap-4">
        <span className="text-sm text-ink-500 shrink-0 font-mono">Affaticamento</span>
        <input
          type="range"
          min={1}
          max={10}
          value={affaticamento}
          onChange={(e) => {
            const v = Number(e.target.value);
            setAffaticamento(v);
            loadRecommended(v);
          }}
          className="w-full accent-sea-500"
        />
        <span className="font-mono text-sea-500 w-6 text-right">{affaticamento}</span>
      </div>

      {error && (
        <div className="mt-6 text-sm text-amber-400 bg-amber-400/10 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-10 text-ink-500 text-sm">Caricamento esercizi…</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          {esercizi.map((e) => (
            <ExerciseCard key={e.id_esercizio} esercizio={e} />
          ))}
          {esercizi.length === 0 && (
            <p className="text-ink-500 text-sm">Nessun esercizio disponibile al momento.</p>
          )}
        </div>
      )}
    </div>
  );
}

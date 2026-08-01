import React, { useEffect, useState } from "react";
import { AchievementsAPI } from "../lib/endpoints.js";
import { apiErrorMessage } from "../lib/api.js";
import BadgeCard from "../components/BadgeCard.jsx";

export default function Achievements() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    AchievementsAPI.mine()
      .then(({ data }) => setData(data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <span className="eyebrow">Traguardi</span>
      <div className="flex items-baseline justify-between mt-2">
        <h1 className="font-display text-3xl font-semibold">I tuoi badge</h1>
        {data && (
          <span className="font-mono text-sm text-ink-500">
            {data.totale_badge_sbloccati}/{data.totale_badge} sbloccati
          </span>
        )}
      </div>

      {error && (
        <div className="mt-6 text-sm text-amber-400 bg-amber-400/10 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {!data && !error && <div className="mt-10 text-ink-500 text-sm">Caricamento traguardi…</div>}

      {data && (
        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          {data.badge.map((b) => (
            <BadgeCard key={b.id_badge} badge={b} />
          ))}
        </div>
      )}
    </div>
  );
}

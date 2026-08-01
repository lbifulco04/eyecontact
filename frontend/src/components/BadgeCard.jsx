import React from "react";

export default function BadgeCard({ badge }) {
  const { titolo, descrizione, icona_emoji, sbloccato, progresso_pct } = badge;
  return (
    <div
      className={`glass-panel p-5 flex items-start gap-4 transition ${
        sbloccato ? "border-sea-500/30" : "opacity-70"
      }`}
    >
      <div
        className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-2xl ${
          sbloccato ? "bg-sea-500/15" : "bg-ink-300/10 grayscale"
        }`}
      >
        {icona_emoji}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display text-base font-semibold">{titolo}</h3>
        <p className="text-sm text-ink-500 mt-0.5">{descrizione}</p>
        <div className="mt-3 h-1.5 rounded-full bg-paper-200 overflow-hidden">
          <div
            className={`h-full rounded-full ${sbloccato ? "bg-sea-500" : "bg-ink-300"}`}
            style={{ width: `${progresso_pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

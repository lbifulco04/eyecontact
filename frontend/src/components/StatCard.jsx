import React from "react";

export default function StatCard({ label, value, unit, accent = "sea" }) {
  const accentClass = accent === "lilac" ? "text-lilac-600" : "text-sea-600";
  return (
    <div className="glass-panel p-6 flex flex-col gap-2">
      <span className="eyebrow">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-display text-4xl font-semibold ${accentClass}`}>{value}</span>
        {unit && <span className="text-ink-500 text-sm">{unit}</span>}
      </div>
    </div>
  );
}

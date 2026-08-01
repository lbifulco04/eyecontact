import React from "react";

/**
 * Elemento firma del prodotto: il "punto di fissazione" che l'utente insegue
 * con lo sguardo durante gli esercizi. Riusato come motivo visivo ricorrente
 * (hero, stati di caricamento, empty state) per dare identità coerente al sito.
 */
export default function GazeTarget({ size = 64, color = "sea", animate = true, style }) {
  const colorMap = {
    sea: { core: "#3FAF93", ring: "rgba(63,175,147,0.35)" },
    lilac: { core: "#8B6FC7", ring: "rgba(139,111,199,0.35)" },
  };
  const c = colorMap[color] || colorMap.sea;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size, ...style }}
    >
      {animate && (
        <span
          className="absolute inset-0 rounded-full animate-pulseRing"
          style={{ background: c.ring }}
        />
      )}
      <span
        className="relative rounded-full"
        style={{
          width: size * 0.32,
          height: size * 0.32,
          background: c.core,
          boxShadow: `0 0 ${size * 0.5}px ${c.ring}`,
        }}
      />
    </div>
  );
}

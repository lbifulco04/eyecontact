import React from "react";

/**
 * Il "cerchietto" che segnala la posizione degli occhi/sguardo rilevati, sovrapposto
 * all'anteprima della webcam. Le coordinate sono in percentuale (0-100) rispetto al
 * contenitore; `mirrored` va passato a true quando il video sottostante è specchiato
 * (vedi CameraPreview) così il cerchietto resta allineato visivamente agli occhi veri.
 */
export default function GazeCircle({ x, y, mirrored = true, size = 26 }) {
  const displayX = mirrored ? 100 - x : x;
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-[left,top] duration-75 ease-out"
      style={{ left: `${displayX}%`, top: `${y}%` }}
    >
      <div
        className="rounded-full border-2 border-sea-500 bg-sea-400/20 shadow-seaGlow animate-pulse"
        style={{ width: size, height: size }}
      />
    </div>
  );
}

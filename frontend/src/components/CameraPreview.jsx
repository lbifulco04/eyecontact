import React from "react";

/**
 * Anteprima della webcam, sempre visibile quando la fotocamera è richiesta (come da requisito):
 * un video nascosto (display:none) non è solo poco trasparente per l'utente, su diversi
 * browser impedisce anche a `requestVideoFrameCallback` di scattare, bloccando di fatto
 * l'intero loop di rilevamento — quindi mostrarla non è solo una scelta di UX, è anche
 * parte del fix del rilevamento volto/occhi.
 *
 * Specchiata orizzontalmente (comportamento "specchio", standard per le webcam frontali):
 * l'analisi lavora comunque sui pixel reali del video, lo specchio è solo visivo (CSS).
 */
export default function CameraPreview({ videoRef }) {
  return (
    <video
      ref={videoRef}
      className="absolute inset-0 w-full h-full object-cover [transform:scaleX(-1)]"
      playsInline
      muted
      aria-hidden="true"
    />
  );
}

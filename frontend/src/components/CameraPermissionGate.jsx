import React from "react";
import { PERMISSION_STATE } from "../hooks/useEyeTracking.js";

const STAGE_LABEL = {
  idle: "In attesa…",
  "loading-wasm": "Caricamento del motore di tracciamento…",
  "loading-model": "Download del modello di rilevamento del volto…",
  initializing: "Inizializzazione del modello…",
  ready: "Pronto",
};

export default function CameraPermissionGate({
  permissionState,
  errorMessage,
  workerReady,
  modelStage,
  modelProgress,
  modelError,
  onRetry,
  onRetryModel,
  compact = false,
}) {
  const modelFailed = modelStage === "error";
  const cameraBlocked = [
    PERMISSION_STATE.DENIED,
    PERMISSION_STATE.UNAVAILABLE,
    PERMISSION_STATE.ERROR,
  ].includes(permissionState);

  if (permissionState === PERMISSION_STATE.GRANTED && workerReady && !modelFailed) return null;

  if (compact) {
    const failed = modelFailed || cameraBlocked;
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ink-900/85 text-center px-2">
        {!failed ? (
          <div className="w-5 h-5 rounded-full border-2 border-sea-400/40 border-t-sea-400 animate-spin" />
        ) : (
          <button
            onClick={modelFailed ? onRetryModel : onRetry}
            className="text-[10px] font-medium text-white underline underline-offset-2"
          >
            Riprova
          </button>
        )}
        <span className="text-[10px] leading-tight text-white/80">
          {failed ? "Webcam non disponibile" : "Avvio…"}
        </span>
      </div>
    );
  }

  // Errore nel caricamento del modello: caso distinto dai permessi webcam,
  // con messaggio diagnostico esplicito invece di uno spinner che gira all'infinito.
  if (modelFailed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-paper-50/95 backdrop-blur-sm rounded-2xl text-center px-6">
        <div className="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-lg">
          !
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold">Modello non caricato</h3>
          <p className="text-sm text-ink-500 mt-1 max-w-sm">{modelError}</p>
          <p className="text-xs text-ink-300 mt-2 max-w-sm">
            Controlla la console del browser (F12) per il dettaglio tecnico completo.
          </p>
        </div>
        <button onClick={onRetryModel} className="btn-primary !px-5 !py-2.5 text-sm">
          Riprova
        </button>
      </div>
    );
  }

  if (cameraBlocked) {
    let title = "Impossibile avviare il tracciamento";
    if (permissionState === PERMISSION_STATE.DENIED) title = "Accesso alla webcam negato";
    if (permissionState === PERMISSION_STATE.UNAVAILABLE) title = "Webcam non disponibile";
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-paper-50/95 backdrop-blur-sm rounded-2xl text-center px-6">
        <div>
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <p className="text-sm text-ink-500 mt-1 max-w-sm">{errorMessage}</p>
        </div>
        <button onClick={onRetry} className="btn-primary !px-5 !py-2.5 text-sm">
          Riprova
        </button>
      </div>
    );
  }

  // Stato "in caricamento": modello e/o webcam ancora in preparazione.
  const pct =
    modelProgress?.total > 0
      ? Math.min(100, Math.round((modelProgress.loaded / modelProgress.total) * 100))
      : null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-paper-50/95 backdrop-blur-sm rounded-2xl text-center px-6">
      <div className="w-10 h-10 rounded-full border-2 border-sea-500/30 border-t-sea-500 animate-spin" />
      <div className="w-full max-w-xs">
        <h3 className="font-display text-base font-semibold">
          {STAGE_LABEL[modelStage] || "Preparazione…"}
        </h3>

        {modelStage === "loading-model" && (
          <div className="mt-3">
            <div className="h-2 rounded-full bg-paper-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-sea-500 transition-[width] duration-200"
                style={{ width: pct != null ? `${pct}%` : "30%" }}
              />
            </div>
            <p className="text-xs text-ink-300 mt-1.5 font-mono">
              {modelProgress?.cached
                ? "letto dalla cache locale"
                : pct != null
                ? `${pct}% — ${formatBytes(modelProgress.loaded)} / ${formatBytes(modelProgress.total)}`
                : formatBytes(modelProgress?.loaded || 0)}
            </p>
          </div>
        )}

        <p className="text-sm text-ink-500 mt-3">
          {permissionState === PERMISSION_STATE.REQUESTING
            ? "Concedi l'accesso alla webcam quando richiesto dal browser."
            : "Il primo avvio scarica il modello di rilevamento del volto: le volte successive sarà istantaneo."}
        </p>
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

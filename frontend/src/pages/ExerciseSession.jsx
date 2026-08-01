import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useEyeTracking, PERMISSION_STATE } from "../hooks/useEyeTracking.js";
import CameraPermissionGate from "../components/CameraPermissionGate.jsx";
import GazeTarget from "../components/GazeTarget.jsx";
import CameraPreview from "../components/CameraPreview.jsx";
import GazeCircle from "../components/GazeCircle.jsx";
import { ExercisesAPI, CalibrationAPI, SessionsAPI } from "../lib/endpoints.js";
import { apiErrorMessage } from "../lib/api.js";

const TOLERANCE_PCT = 12; // distanza massima (in % schermo) perché il punto sia considerato "fissato"

export default function ExerciseSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [esercizio, setEsercizio] = useState(null);
  const [calibrazione, setCalibrazione] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [phase, setPhase] = useState("intro"); // intro | pre | running | post | done
  const [affaticamentoPre, setAffaticamentoPre] = useState(5);
  const [affaticamentoPost, setAffaticamentoPost] = useState(5);
  const [elapsed, setElapsed] = useState(0);
  const [inTargetMs, setInTargetMs] = useState(0);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    videoRef,
    permissionState,
    errorMessage,
    workerReady,
    modelStage,
    modelProgress,
    modelError,
    gaze,
    faceDetected,
    retry,
    retryModel,
  } = useEyeTracking({ enabled: phase === "running" });

  useEffect(() => {
    ExercisesAPI.detail(id)
      .then(({ data }) => setEsercizio(data))
      .catch((err) => setLoadError(apiErrorMessage(err, "Esercizio non trovato.")));
    CalibrationAPI.me()
      .then(({ data }) => setCalibrazione(data))
      .catch(() => setCalibrazione(null));
  }, [id]);

  const durata = esercizio?.durata_consigliata_sec || 60;

  // Timer di sessione: avanza ogni 100ms mentre l'esercizio è "running"
  const startTsRef = useRef(null);
  const lastTsRef = useRef(null);
  useEffect(() => {
    if (phase !== "running") return;
    startTsRef.current = performance.now();
    lastTsRef.current = startTsRef.current;
    const id = setInterval(() => {
      const now = performance.now();
      const total = now - startTsRef.current;
      setElapsed(total / 1000);
      if (total / 1000 >= durata) {
        setPhase("post");
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, durata]);

  // Posizione target in % schermo, in base alla categoria dell'esercizio
  const targetPos = useMemo(() => {
    const cat = esercizio?.categoria;
    const t = elapsed;
    if (cat === "Saccadi") {
      const pts = [[15, 50], [85, 50], [50, 20], [50, 80], [15, 20], [85, 80]];
      const idx = Math.floor(t / 1.4) % pts.length;
      return pts[idx];
    }
    if (cat === "Inseguimento") {
      const cx = 50 + 34 * Math.sin(t * 0.6);
      const cy = 50 + 24 * Math.cos(t * 0.9);
      return [cx, cy];
    }
    // Fissazione: punto fermo al centro
    return [50, 50];
  }, [esercizio?.categoria, elapsed]);

  // Proietta il gaze grezzo in coordinate schermo usando la calibrazione salvata (se presente)
  const projectedGaze = useMemo(() => {
    if (!gaze) return null;
    if (!calibrazione?.parametri_matrice) {
      // Senza calibrazione, fallback grezzo: mappa direttamente 0..1 -> 0..100%
      return { x: gaze.x * 100, y: gaze.y * 100 };
    }
    const { a, b, c, d, e, f } = calibrazione.parametri_matrice;
    return {
      x: clampPct(a * gaze.x + b * gaze.y + c),
      y: clampPct(d * gaze.x + e * gaze.y + f),
    };
  }, [gaze, calibrazione]);

  // Accumula il tempo in cui lo sguardo proiettato è entro la tolleranza dal target
  const lastAccumTsRef = useRef(null);
  useEffect(() => {
    if (phase !== "running") {
      lastAccumTsRef.current = null;
      return;
    }
    const now = performance.now();
    if (lastAccumTsRef.current == null) {
      lastAccumTsRef.current = now;
      return;
    }
    const dt = now - lastAccumTsRef.current;
    lastAccumTsRef.current = now;
    if (projectedGaze && faceDetected) {
      const dist = Math.hypot(projectedGaze.x - targetPos[0], projectedGaze.y - targetPos[1]);
      if (dist <= TOLERANCE_PCT) setInTargetMs((v) => v + dt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectedGaze, faceDetected, phase, targetPos]);

  const precisionPct = elapsed > 0 ? Math.min(100, Math.round((inTargetMs / 1000 / elapsed) * 100)) : 0;

  const submitSession = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await SessionsAPI.create({
        durata_totale_sec: Math.round(elapsed),
        affaticamento_pre: affaticamentoPre,
        affaticamento_post: affaticamentoPost,
        note: `Precisione fissazione stimata: ${precisionPct}%`,
        dettagli_esercizi: [
          {
            id_esercizio: Number(id),
            tempo_target_sec: durata,
            tempo_effettivo_sec: Math.round(elapsed),
            completato: elapsed >= durata - 1,
          },
        ],
      });
      setPhase("done");
    } catch (err) {
      setSubmitError(apiErrorMessage(err, "Impossibile salvare la sessione."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-amber-400">{loadError}</p>
        <Link to="/esercizi" className="btn-ghost mt-6 inline-flex">
          Torna al catalogo
        </Link>
      </div>
    );
  }
  if (!esercizio) {
    return <div className="max-w-2xl mx-auto px-6 py-16 text-ink-500 text-sm">Caricamento…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <span className="eyebrow">{esercizio.categoria || "Esercizio"}</span>
      <h1 className="font-display text-3xl font-semibold mt-2">{esercizio.nome}</h1>
      {esercizio.descrizione && <p className="text-ink-500 mt-2">{esercizio.descrizione}</p>}

      {!calibrazione && phase !== "done" && (
        <div className="mt-5 text-sm text-amber-400 bg-amber-400/10 rounded-lg px-4 py-3">
          Non hai ancora una calibrazione salvata: il tracciamento userà una stima grezza, meno
          precisa.{" "}
          <Link to="/calibrazione" className="underline">
            Calibra ora
          </Link>
        </div>
      )}

      {phase === "intro" && (
        <div className="glass-panel p-8 mt-6 text-center">
          <p className="text-ink-700">
            Durata consigliata: <span className="text-sea-500 font-mono">{durata}s</span>
          </p>
          <button onClick={() => setPhase("pre")} className="btn-primary mt-6">
            Continua
          </button>
        </div>
      )}

      {phase === "pre" && (
        <FatigueStep
          label="Quanto ti senti affaticato ORA, prima di iniziare?"
          value={affaticamentoPre}
          onChange={setAffaticamentoPre}
          onConfirm={() => setPhase("running")}
          confirmLabel="Inizia esercizio"
        />
      )}

      {phase === "running" && (
        <div className="relative mt-6 aspect-video w-full glass-panel overflow-hidden bg-gradient-to-br from-paper-100 to-paper-200">
          {/* Target dell'esercizio: sfondo pulito, non la webcam, per non distrarre durante il tracciamento */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-100 ease-linear"
            style={{ left: `${targetPos[0]}%`, top: `${targetPos[1]}%` }}
          >
            <GazeTarget size={44} />
          </div>

          {/* Cerchietto sulla posizione dello sguardo rilevato/calibrato: feedback per l'utente
              su dove il sistema pensa stia guardando rispetto al target dell'esercizio.
              Coordinate già in spazio schermo (dopo la calibrazione), non specchiate. */}
          {projectedGaze && faceDetected && (
            <GazeCircle x={projectedGaze.x} y={projectedGaze.y} mirrored={false} size={22} />
          )}

          <div className="absolute top-4 left-4 right-4 flex items-center justify-between font-mono text-xs text-ink-500">
            <span>{Math.max(0, Math.round(durata - elapsed))}s rimanenti</span>
            <span className="text-sea-600">precisione {precisionPct}%</span>
          </div>

          {/* Webcam in piccolo, angolo in basso a destra: conferma visiva che il tracciamento
              sta funzionando senza che l'anteprima a schermo intero distragga dall'esercizio. */}
          <div className="absolute bottom-4 right-4 w-32 h-24 sm:w-40 sm:h-28 rounded-xl overflow-hidden ring-2 ring-white shadow-lg z-20 bg-ink-900">
            <CameraPreview videoRef={videoRef} />
            {faceDetected && gaze && (
              <GazeCircle x={gaze.x * 100} y={gaze.y * 100} mirrored size={16} />
            )}
            <span
              className={`absolute bottom-1 left-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                faceDetected ? "bg-sea-500/90 text-white" : "bg-black/60 text-white/80"
              }`}
            >
              {faceDetected ? "● volto" : "○ nessun volto"}
            </span>
            <CameraPermissionGate
              permissionState={permissionState}
              errorMessage={errorMessage}
              workerReady={workerReady}
              modelStage={modelStage}
              modelProgress={modelProgress}
              modelError={modelError}
              onRetry={retry}
              onRetryModel={retryModel}
              compact
            />
          </div>
        </div>
      )}

      {phase === "post" && (
        <FatigueStep
          label="Come ti senti ORA, dopo l'esercizio?"
          value={affaticamentoPost}
          onChange={setAffaticamentoPost}
          onConfirm={submitSession}
          confirmLabel={submitting ? "Salvataggio…" : "Salva sessione"}
          disabled={submitting}
          error={submitError}
        />
      )}

      {phase === "done" && (
        <div className="glass-panel p-8 mt-6 text-center">
          <GazeTarget size={56} style={{ margin: "0 auto" }} />
          <h3 className="font-display text-xl font-semibold mt-4">Sessione completata</h3>
          <p className="text-ink-500 mt-2">
            Precisione di fissazione stimata: <span className="text-sea-500">{precisionPct}%</span>
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Link to="/dashboard" className="btn-primary">
              Vai alla dashboard
            </Link>
            <Link to="/esercizi" className="btn-ghost">
              Altro esercizio
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function FatigueStep({ label, value, onChange, onConfirm, confirmLabel, disabled, error }) {
  return (
    <div className="glass-panel p-8 mt-6 text-center">
      <p className="text-ink-700">{label}</p>
      <div className="flex items-center gap-4 mt-6 max-w-xs mx-auto">
        <span className="text-ink-300 text-sm">Riposato</span>
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-sea-500"
        />
        <span className="text-ink-300 text-sm">Affaticato</span>
      </div>
      <span className="font-mono text-sea-500 text-lg mt-2 inline-block">{value}</span>
      {error && <p className="text-amber-400 text-sm mt-3">{error}</p>}
      <div>
        <button onClick={onConfirm} disabled={disabled} className="btn-primary mt-6 disabled:opacity-60">
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

function clampPct(v) {
  return Math.min(100, Math.max(0, v));
}

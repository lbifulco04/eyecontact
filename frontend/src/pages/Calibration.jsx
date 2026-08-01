import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEyeTracking, PERMISSION_STATE } from "../hooks/useEyeTracking.js";
import CameraPermissionGate from "../components/CameraPermissionGate.jsx";
import { CalibrationAPI } from "../lib/endpoints.js";
import { apiErrorMessage } from "../lib/api.js";
import GazeTarget from "../components/GazeTarget.jsx";
import CameraPreview from "../components/CameraPreview.jsx";
import GazeCircle from "../components/GazeCircle.jsx";

// Griglia 3x3 in percentuale della superficie di calibrazione
const CALIB_POINTS = [
  [10, 10], [50, 10], [90, 10],
  [10, 50], [50, 50], [90, 50],
  [10, 90], [50, 90], [90, 90],
];

const SAMPLES_PER_POINT = 12;

export default function Calibration() {
  const navigate = useNavigate();
  const areaRef = useRef(null);
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
    calibratingBaseline,
    retry,
    retryModel,
  } = useEyeTracking({ enabled: true });

  const [pointIndex, setPointIndex] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const [samples, setSamples] = useState([]); // { screenX, screenY, rawX, rawY }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const ready = permissionState === PERMISSION_STATE.GRANTED && workerReady;
  const currentPoint = CALIB_POINTS[pointIndex];

  const collectForCurrentPoint = () => {
    if (!faceDetected || !gaze) return;
    setCollecting(true);
    const collected = [];
    const interval = setInterval(() => {
      if (gaze) collected.push({ rawX: gaze.x, rawY: gaze.y });
      if (collected.length >= SAMPLES_PER_POINT) {
        clearInterval(interval);
        const avgRawX = collected.reduce((s, p) => s + p.rawX, 0) / collected.length;
        const avgRawY = collected.reduce((s, p) => s + p.rawY, 0) / collected.length;
        setSamples((prev) => [
          ...prev,
          { screenX: currentPoint[0], screenY: currentPoint[1], rawX: avgRawX, rawY: avgRawY },
        ]);
        setCollecting(false);
        if (pointIndex + 1 < CALIB_POINTS.length) {
          setPointIndex((i) => i + 1);
        } else {
          setDone(true);
        }
      }
    }, 90);
  };

  const finalSamples = useMemo(() => samples, [samples]);

  const saveCalibration = async () => {
    setSaving(true);
    setError(null);
    try {
      const matrix = solveAffine(finalSamples);
      await CalibrationAPI.save({
        device_info: `${navigator.userAgent}`,
        larghezza_schermo_px: window.screen.width,
        altezza_schermo_px: window.screen.height,
        distanza_media_cm: null,
        punti_calibrazione_count: CALIB_POINTS.length,
        qualita_calibrazione_pct: estimateQuality(finalSamples, matrix),
        parametri_matrice: matrix,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(apiErrorMessage(err, "Impossibile salvare la calibrazione."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <span className="eyebrow">Calibrazione</span>
      <h1 className="font-display text-3xl font-semibold mt-2">Allinea il tracciamento</h1>
      <p className="text-ink-500 mt-2 max-w-lg">
        Fissa ogni punto finché non diventa pieno. Servono {CALIB_POINTS.length} punti per
        costruire il tuo profilo di calibrazione.
      </p>

      <div
        ref={areaRef}
        className="relative mt-8 aspect-video w-full glass-panel overflow-hidden"
      >
        <CameraPreview videoRef={videoRef} />

        {faceDetected && gaze && !done && <GazeCircle x={gaze.x * 100} y={gaze.y * 100} />}

        {!done &&
          CALIB_POINTS.map(([x, y], i) => (
            <button
              key={i}
              onClick={() => i === pointIndex && !collecting && collectForCurrentPoint()}
              disabled={i !== pointIndex || collecting}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <GazeTarget
                size={i === pointIndex ? 48 : 22}
                color={i === pointIndex ? "lilac" : "sea"}
                animate={i === pointIndex}
              />
            </button>
          ))}

        {done && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6 bg-paper-50/90 backdrop-blur-sm">
            <GazeTarget size={56} />
            <h3 className="font-display text-xl font-semibold">Calibrazione completata</h3>
            <p className="text-ink-500 text-sm max-w-sm">
              Salva il profilo per iniziare ad allenarti con il tracciamento personalizzato.
            </p>
            {error && <p className="text-amber-400 text-sm">{error}</p>}
            <button onClick={saveCalibration} disabled={saving} className="btn-primary mt-2">
              {saving ? "Salvataggio…" : "Salva calibrazione"}
            </button>
          </div>
        )}

        <CameraPermissionGate
          permissionState={permissionState}
          errorMessage={errorMessage}
          workerReady={workerReady}
          modelStage={modelStage}
          modelProgress={modelProgress}
          modelError={modelError}
          onRetry={retry}
          onRetryModel={retryModel}
        />
      </div>

      <div className="flex items-center justify-between mt-4 text-sm">
        <span className="text-ink-500 font-mono">
          Punto {Math.min(pointIndex + 1, CALIB_POINTS.length)}/{CALIB_POINTS.length}
        </span>
        <span className={faceDetected ? "text-sea-500" : "text-ink-300"}>
          {faceDetected ? "● Volto rilevato" : "○ Nessun volto rilevato"}
        </span>
      </div>

      {ready && !faceDetected && !done && (
        <p className="text-xs text-ink-300 mt-2">
          Assicurati che il viso sia ben illuminato e centrato nell'inquadratura.
        </p>
      )}

      {calibratingBaseline && !done && (
        <p className="text-xs text-lilac-600 mt-2">
          Guarda dritto verso lo schermo per un istante — sto misurando il tuo punto di riposo…
        </p>
      )}
    </div>
  );
}

/**
 * Risolve una trasformazione affine 2D (6 parametri) che mappa le coordinate grezze
 * dello sguardo (0..1) sulle coordinate percentuali dello schermo, tramite minimi quadrati.
 * screenX = a*rawX + b*rawY + c
 * screenY = d*rawX + e*rawY + f
 */
function solveAffine(samples) {
  // Costruzione delle equazioni normali (A^T A) x = A^T b per le due componenti indipendentemente
  const solveComponent = (target) => {
    let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, sxt = 0, syt = 0, st = 0, n = samples.length;
    for (const s of samples) {
      const x = s.rawX, y = s.rawY, t = target(s);
      sxx += x * x; sxy += x * y; sx += x;
      syy += y * y; sy += y;
      sxt += x * t; syt += y * t; st += t;
    }
    // Sistema 3x3 simmetrico: [ [sxx,sxy,sx],[sxy,syy,sy],[sx,sy,n] ] * [a,b,c] = [sxt,syt,st]
    const A = [
      [sxx, sxy, sx],
      [sxy, syy, sy],
      [sx, sy, n],
    ];
    const B = [sxt, syt, st];
    return solveLinearSystem3(A, B);
  };

  const [a, b, c] = solveComponent((s) => s.screenX);
  const [d, e, f] = solveComponent((s) => s.screenY);
  return { a, b, c, d, e, f };
}

function solveLinearSystem3(A, B) {
  // Eliminazione di Gauss con pivot parziale per un sistema 3x3
  const M = A.map((row, i) => [...row, B[i]]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const div = M[col][col] || 1e-9;
    for (let c = col; c < 4; c++) M[col][c] /= div;
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let c = col; c < 4; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return [M[0][3], M[1][3], M[2][3]];
}

function estimateQuality(samples, matrix) {
  if (!samples.length) return 0;
  const { a, b, c, d, e, f } = matrix;
  let errSum = 0;
  for (const s of samples) {
    const px = a * s.rawX + b * s.rawY + c;
    const py = d * s.rawX + e * s.rawY + f;
    errSum += Math.hypot(px - s.screenX, py - s.screenY);
  }
  const avgErr = errSum / samples.length; // errore medio in punti percentuali di schermo
  return Math.max(0, Math.min(100, 100 - avgErr * 2));
}

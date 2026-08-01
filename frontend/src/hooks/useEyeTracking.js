import { useCallback, useEffect, useRef, useState } from "react";
import {
  warmupGazeEngine,
  subscribeGazeEngine,
  getGazeEngineState,
  retryGazeEngine,
  resetGazeSmoothing,
  detectFrame,
} from "../lib/gazeEngine.js";

// FIX #2 (Performance): target FPS configurabile. Girando ora sul thread principale
// (vedi gazeEngine.js) il throttling è ancora più importante per non bloccare il rendering.
const TARGET_FPS = 24;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

// Il rapporto grezzo iride/angoli-occhio ha un intervallo naturale molto compresso: anche
// guardando da un bordo all'altro dello schermo, il valore grezzo si sposta tipicamente solo
// di ±0.1/±0.15 attorno al centro. Senza amplificazione centrata il punto sembra "non
// muoversi" quasi per niente. Questi guadagni espandono lo scostamento dal centro prima di
// mapparlo su schermo — aumentali se il punto si muove ancora troppo poco, riducili se
// diventa nervoso/instabile. GAZE_GAIN_Y è più alto di GAZE_GAIN_X perché il movimento
// verticale fisiologico dell'occhio ha un range più piccolo di quello orizzontale, anche
// ora che entrambi gli assi sono normalizzati sulla stessa scala (vedi gazeEngine.js).
// La calibrazione a 9 punti (Calibration.jsx) applica poi una correzione fine per-utente
// sopra questo segnale già espanso.
const GAZE_GAIN_X = 9.5;
const GAZE_GAIN_Y = 10;
const GAZE_CENTER_X = 0.5;
// Numero di frame usati per catturare il "punto di riposo" (guardando dritto verso lo
// schermo) all'avvio di ogni sessione webcam, invece di assumere un centro teorico fisso.
// Ogni persona/posizione della camera ha un piccolo bias naturale (es. camera sopra lo
// schermo -> leggero sguardo verso il basso guardando il centro): misurarlo invece di
// indovinarlo evita che il punto appaia scentrato all'avvio.
const BASELINE_SAMPLE_COUNT = 20; // ~0.8s a TARGET_FPS=24

export const PERMISSION_STATE = {
  IDLE: "idle",
  REQUESTING: "requesting",
  GRANTED: "granted",
  DENIED: "denied",
  UNAVAILABLE: "unavailable", // no webcam / contesto non sicuro (http non-localhost)
  ERROR: "error",
};

/**
 * Hook per il tracciamento oculare in tempo reale.
 *
 * Il rilevamento (MediaPipe FaceLandmarker) gira sul thread principale tramite
 * src/lib/gazeEngine.js — non in un Web Worker, perché @mediapipe/tasks-vision non
 * inizializza correttamente il proprio runtime WASM dentro un module worker sotto Vite
 * (errore "ModuleFactory not set"). Il costo CPU resta sotto controllo grazie a:
 *  - throttling a TARGET_FPS basato sul tempo trascorso (non sul refresh rate del display);
 *  - detectForVideo chiamato direttamente sull'elemento <video> (nessun downscale/bitmap
 *    intermedio necessario: la libreria gestisce internamente il ridimensionamento);
 *  - backpressure implicita: si aspetta il prossimo tick throttlato, non si accodano frame.
 *
 * Risolve inoltre i problemi di lifecycle tipici di questo tipo di moduli: permessi webcam
 * gestiti esplicitamente (mai un fallimento silenzioso), stream fermato e track chiuse
 * esplicitamente allo smontaggio (niente webcam "bloccata" o memory leak).
 */
export function useEyeTracking({ enabled }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafIdRef = useRef(null);
  const rvfcIdRef = useRef(null);
  const lastTickRef = useRef(0);
  const mountedRef = useRef(true);
  const baselineRef = useRef(null); // { x, y } — punto di riposo catturato automaticamente
  const baselineSamplesRef = useRef([]);

  const [permissionState, setPermissionState] = useState(PERMISSION_STATE.IDLE);
  const [errorMessage, setErrorMessage] = useState(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [modelStage, setModelStage] = useState("idle");
  const [modelProgress, setModelProgress] = useState(null);
  const [modelError, setModelError] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [calibratingBaseline, setCalibratingBaseline] = useState(false);
  const [gaze, setGaze] = useState(null); // { x: 0..1, y: 0..1 } normalizzato
  const [fps, setFps] = useState(0);

  const fpsCounterRef = useRef({ count: 0, windowStart: 0 });

  // --- Motore di rilevamento: singleton condiviso per tutta la sessione della tab -------
  useEffect(() => {
    mountedRef.current = true;

    const initial = getGazeEngineState();
    setModelStage(initial.stage);
    setModelProgress(initial.progress);
    setModelError(initial.error);
    if (initial.stage === "ready") setWorkerReady(true);

    warmupGazeEngine()
      .then(() => {
        if (mountedRef.current) setWorkerReady(true);
      })
      .catch(() => {
        /* l'errore è già propagato via subscribeGazeEngine */
      });

    const unsubscribe = subscribeGazeEngine((data) => {
      if (!mountedRef.current) return;
      if (data.type === "stage") {
        setModelStage(data.stage);
        if (data.stage !== "error") setModelError(null);
        if (data.stage === "ready") setWorkerReady(true);
      } else if (data.type === "download-progress") {
        setModelProgress(data);
      } else if (data.type === "error") {
        console.error("[gazeEngine]", data.message);
        setModelStage("error");
        setModelError(data.message);
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, []);

  const retryModel = useCallback(() => {
    setModelError(null);
    setWorkerReady(false);
    setModelStage("idle");
    setModelProgress(null);
    retryGazeEngine()
      .then(() => {
        if (mountedRef.current) setWorkerReady(true);
      })
      .catch(() => { });
  }, []);

  // --- Camera + detection loop lifecycle ------------------------------------
  const stopCamera = useCallback(() => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    if (rvfcIdRef.current && videoRef.current?.cancelVideoFrameCallback) {
      videoRef.current.cancelVideoFrameCallback(rvfcIdRef.current);
    }
    rafIdRef.current = null;
    rvfcIdRef.current = null;

    // FIX memory leak / webcam "occupata" dopo la chiusura: bisogna fermare esplicitamente
    // ogni singola track, non basta smettere di referenziare lo stream.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const processFrame = useCallback((timestamp) => {
    const video = videoRef.current;
    if (!video) return;

    // FIX bug funzionale: se il video non ha ancora un frame decodificato (readyState < 2),
    // il modello non troverà mai un volto.
    if (video.readyState < 2) return;

    // Throttling a TARGET_FPS basato sul tempo trascorso, non sul framerate del display.
    if (timestamp - lastTickRef.current < FRAME_INTERVAL_MS) return;
    lastTickRef.current = timestamp;

    const result = detectFrame(video, timestamp);
    if (result === null || result === undefined) return; // modello non pronto o frame scartato

    if (!result.faceDetected) {
      setFaceDetected(false);
      return;
    }

    setFaceDetected(true);

    // Cattura automatica del punto di riposo: i primi BASELINE_SAMPLE_COUNT frame in cui
    // vediamo un volto vengono usati per misurare "dove sei quando guardi dritto" invece di
    // assumere un centro teorico fisso (0.5/0), che varia da persona a persona e in base a
    // dove si trova fisicamente la webcam rispetto allo schermo.
    if (!baselineRef.current) {
      baselineSamplesRef.current.push({ x: result.rawX, y: result.rawY });
      if (baselineSamplesRef.current.length === 1 && mountedRef.current) {
        setCalibratingBaseline(true);
      }
      if (baselineSamplesRef.current.length >= BASELINE_SAMPLE_COUNT) {
        const samples = baselineSamplesRef.current;
        const n = samples.length;
        baselineRef.current = {
          x: samples.reduce((s, p) => s + p.x, 0) / n,
          y: samples.reduce((s, p) => s + p.y, 0) / n,
        };
        if (mountedRef.current) setCalibratingBaseline(false);
      }
      return; // non pubblichiamo ancora coordinate: eviterebbe un salto visivo a metà cattura
    }

    const { x: baseX, y: baseY } = baselineRef.current;
    setGaze({
      x: clamp01(GAZE_CENTER_X + (result.rawX - baseX) * GAZE_GAIN_X),
      // Direzione confermata: uno sguardo verso l'alto deve spostare il punto verso l'alto
      // (percentuale "top" più piccola). Lo scostamento è calcolato dal punto di riposo
      // misurato sopra, non da uno zero teorico.
      y: clamp01(0.5 + (result.rawY - baseY) * GAZE_GAIN_Y),
    });
    tickFps(fpsCounterRef, setFps);
  }, []);

  const loop = useCallback(
    (timestamp) => {
      processFrame(timestamp);
      rafIdRef.current = requestAnimationFrame(loop);
    },
    [processFrame]
  );

  const startCamera = useCallback(async () => {
    setErrorMessage(null);

    // Un contesto non sicuro (http:// diverso da localhost) fa fallire getUserMedia
    // silenziosamente in molti browser: intercettiamolo esplicitamente con un messaggio chiaro.
    if (!window.isSecureContext) {
      setPermissionState(PERMISSION_STATE.UNAVAILABLE);
      setErrorMessage("La webcam richiede una connessione sicura (HTTPS) per essere attivata.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionState(PERMISSION_STATE.UNAVAILABLE);
      setErrorMessage("Questo browser non supporta l'accesso alla webcam.");
      return;
    }

    setPermissionState(PERMISSION_STATE.REQUESTING);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setPermissionState(PERMISSION_STATE.GRANTED);
      lastTickRef.current = 0;
      fpsCounterRef.current = { count: 0, windowStart: performance.now() };
      resetGazeSmoothing();
      baselineRef.current = null;
      baselineSamplesRef.current = [];
      setCalibratingBaseline(false);

      // Preferisci requestVideoFrameCallback quando disponibile: si allinea al framerate
      // reale della webcam invece che al refresh rate del monitor. Usiamo il primo argomento
      // "now" (orologio monotono globale, come performance.now()), mai metadata.mediaTime
      // (relativo al singolo stream: riparte da zero ad ogni riavvio della webcam).
      if (videoRef.current?.requestVideoFrameCallback) {
        const rvfcLoop = (now) => {
          processFrame(now);
          rvfcIdRef.current = videoRef.current.requestVideoFrameCallback(rvfcLoop);
        };
        rvfcIdRef.current = videoRef.current.requestVideoFrameCallback(rvfcLoop);
      } else {
        rafIdRef.current = requestAnimationFrame(loop);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if (err.name === "NotAllowedError" || err.name === "SecurityError") {
        setPermissionState(PERMISSION_STATE.DENIED);
        setErrorMessage("Permesso webcam negato. Abilitalo dalle impostazioni del browser per continuare.");
      } else if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
        setPermissionState(PERMISSION_STATE.UNAVAILABLE);
        setErrorMessage("Nessuna webcam compatibile trovata sul dispositivo.");
      } else if (err.name === "NotReadableError") {
        setPermissionState(PERMISSION_STATE.ERROR);
        setErrorMessage("La webcam è già in uso da un'altra applicazione.");
      } else {
        setPermissionState(PERMISSION_STATE.ERROR);
        setErrorMessage("Impossibile avviare la webcam.");
      }
    }
  }, [loop, processFrame]);

  useEffect(() => {
    if (enabled) {
      startCamera();
    } else {
      stopCamera();
      setPermissionState(PERMISSION_STATE.IDLE);
      setGaze(null);
      setFaceDetected(false);
    }
    // Cleanup ad ogni cambio di `enabled` e allo smontaggio del componente: questa è la parte
    // che, se omessa, lascia la webcam "accesa" (spia LED attiva) dopo che l'utente ha
    // lasciato la pagina dell'esercizio.
    return () => stopCamera();
  }, [enabled, startCamera, stopCamera]);

  return {
    videoRef,
    permissionState,
    errorMessage,
    workerReady,
    modelStage,
    modelProgress,
    modelError,
    faceDetected,
    calibratingBaseline,
    gaze,
    fps,
    retry: startCamera,
    retryModel,
  };
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function tickFps(counterRef, setFps) {
  const c = counterRef.current;
  c.count += 1;
  const elapsed = performance.now() - c.windowStart;
  if (elapsed >= 1000) {
    setFps(Math.round((c.count * 1000) / elapsed));
    c.count = 0;
    c.windowStart = performance.now();
  }
}

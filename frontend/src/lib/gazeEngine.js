// gazeEngine.js
//
// Motore di rilevamento volto/sguardo — gira sul MAIN THREAD (non più in un Web Worker).
//
// Perché: @mediapipe/tasks-vision, dentro un Worker di tipo "module" (necessario con Vite
// per poter usare `import`), fallisce l'inizializzazione del runtime WASM con l'errore
// "ModuleFactory not set". È un problema noto di compatibilità tra questa libreria e i
// module worker sotto bundler come Vite/webpack, non qualcosa che possiamo correggere in modo
// affidabile lato applicazione. Girare sul thread principale è la soluzione pragmatica che
// garantisce che il rilevamento funzioni davvero, a fronte di un costo CPU accettabile grazie
// a throttling + downscaling che restano comunque applicati (vedi useEyeTracking.js).
//
// Resta un singleton per tutta la sessione della tab (stessa ragione di prima: evitare di
// ricaricare/ricompilare il modello ad ogni apertura di un esercizio).

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const MODEL_CACHE_NAME = "eyecontact-mediapipe-v1";

const STALL_TIMEOUT_MS = 15000;
const TOTAL_INIT_TIMEOUT_MS = 45000;

// Indici landmark chiave (MediaPipe Face Mesh, refineLandmarks=true -> include l'iride)
const LEFT_IRIS = 468;
const RIGHT_IRIS = 473;
const LEFT_EYE_OUTER = 33;
const LEFT_EYE_INNER = 133;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;
// Palpebra superiore/inferiore di ciascun occhio, usate per normalizzare la componente
// verticale allo stesso modo di quella orizzontale (vedi computeGazePoint).
const LEFT_EYE_TOP = 159;
const LEFT_EYE_BOTTOM = 145;
const RIGHT_EYE_TOP = 386;
const RIGHT_EYE_BOTTOM = 374;
const SMOOTHING_ALPHA = 0.35;

let faceLandmarker = null;
let readyPromise = null;
let lastTimestamp = -1;
let smoothedX = null;
let smoothedY = null;
let framesSeen = 0;

const listeners = new Set();
const state = {
  stage: "idle", // idle | loading-wasm | loading-model | initializing | ready | error
  progress: null, // { loaded, total, cached }
  error: null,
};

function emit(data) {
  for (const cb of listeners) cb(data);
}

function reportStage(stage) {
  state.stage = stage;
  if (stage !== "error") state.error = null;
  emit({ type: "stage", stage });
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timeout (${Math.round(ms / 1000)}s) durante: ${label}`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchModelBufferCached(onProgress) {
  const cache = await caches.open(MODEL_CACHE_NAME);
  const cached = await cache.match(MODEL_URL);
  if (cached) {
    onProgress({ loaded: 1, total: 1, cached: true });
    return new Uint8Array(await cached.arrayBuffer());
  }

  let response;
  try {
    response = await fetch(MODEL_URL, { cache: "force-cache" });
  } catch (networkErr) {
    throw new Error(
      `Impossibile raggiungere ${new URL(MODEL_URL).host}. Verifica la connessione, un firewall/proxy aziendale o un blocco da parte di estensioni del browser (ad-blocker/privacy). Dettaglio: ${networkErr.message}`
    );
  }

  if (!response.ok) {
    throw new Error(`Il server ha risposto ${response.status} ${response.statusText} scaricando il modello.`);
  }

  const contentLength = Number(response.headers.get("content-length")) || 0;

  if (!response.body || typeof response.body.getReader !== "function") {
    const buf = await response.arrayBuffer();
    onProgress({ loaded: buf.byteLength, total: contentLength || buf.byteLength, cached: false });
    await cache.put(MODEL_URL, new Response(buf, { headers: response.headers }));
    return new Uint8Array(buf);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  let lastChunkAt = Date.now();

  const stallCheck = setInterval(() => {
    if (Date.now() - lastChunkAt > STALL_TIMEOUT_MS) {
      clearInterval(stallCheck);
      reader.cancel("stalled").catch(() => {});
    }
  }, 1000);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      lastChunkAt = Date.now();
      onProgress({ loaded: received, total: contentLength, cached: false });
    }
  } catch (streamErr) {
    throw new Error(
      `Download del modello interrotto dopo ${(received / 1024).toFixed(0)}KB (rete instabile o richiesta bloccata). Dettaglio: ${streamErr.message}`
    );
  } finally {
    clearInterval(stallCheck);
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    await cache.put(MODEL_URL, new Response(merged, { headers: response.headers }));
  } catch {
    // Caching best-effort: se fallisce proseguiamo comunque col buffer in memoria.
  }

  return merged;
}

function ensureLandmarker() {
  if (faceLandmarker) return Promise.resolve(faceLandmarker);
  if (!readyPromise) {
    readyPromise = withTimeout(
      (async () => {
        reportStage("loading-wasm");
        const visionPromise = FilesetResolver.forVisionTasks(WASM_BASE).catch((err) => {
          throw new Error(
            `Impossibile caricare il runtime WASM da ${WASM_BASE}. Verifica che il dominio cdn.jsdelivr.net non sia bloccato. Dettaglio: ${err.message}`
          );
        });

        reportStage("loading-model");
        const modelPromise = fetchModelBufferCached((progress) => {
          state.progress = progress;
          emit({ type: "download-progress", ...progress });
        });

        const [vision, modelAssetBuffer] = await Promise.all([visionPromise, modelPromise]);

        reportStage("initializing");
        // Delegate CPU: più lento del GPU ma affidabile ovunque. Sul thread principale,
        // con frame ridotti e throttlati, il costo resta accettabile.
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetBuffer, delegate: "CPU" },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
          runningMode: "VIDEO",
          numFaces: 1,
          refineLandmarks: true,
        });

        reportStage("ready");
        return faceLandmarker;
      })(),
      TOTAL_INIT_TIMEOUT_MS,
      "caricamento del modello di tracciamento"
    ).catch((err) => {
      readyPromise = null;
      state.stage = "error";
      state.error = err.message;
      emit({ type: "error", message: err.message });
      throw err;
    });
  }
  return readyPromise;
}

function computeGazePoint(landmarks) {
  const leftIris = landmarks[LEFT_IRIS];
  const rightIris = landmarks[RIGHT_IRIS];
  if (!leftIris || !rightIris) return null;

  const lOuter = landmarks[LEFT_EYE_OUTER];
  const lInner = landmarks[LEFT_EYE_INNER];
  const rInner = landmarks[RIGHT_EYE_INNER];
  const rOuter = landmarks[RIGHT_EYE_OUTER];

  const leftRatioX = (leftIris.x - lOuter.x) / (lInner.x - lOuter.x || 1e-6);
  const rightRatioX = (rightIris.x - rInner.x) / (rOuter.x - rInner.x || 1e-6);
  const avgRatioX = (leftRatioX + rightRatioX) / 2;

  // FIX movimento "solo in orizzontale o solo in verticale, mai in diagonale": prima questa
  // componente era una differenza GREZZA di coordinate immagine (scala dipendente dalla
  // distanza dalla camera / dimensione del volto in pixel), mentre X sopra è un RAPPORTO
  // adimensionale (0..1, scala costante). Due segnali su scale diverse e non comparabili:
  // l'asse con segnale relativamente più "grande" in un dato istante dominava visivamente,
  // facendo sembrare il movimento vincolato a un solo asse per volta. Normalizziamo anche Y
  // come rapporto rispetto all'apertura dell'occhio (palpebra superiore/inferiore), così i
  // due assi hanno la stessa scala e rispondono in proporzione l'uno all'altro.
  const lTop = landmarks[LEFT_EYE_TOP];
  const lBottom = landmarks[LEFT_EYE_BOTTOM];
  const rTop = landmarks[RIGHT_EYE_TOP];
  const rBottom = landmarks[RIGHT_EYE_BOTTOM];

  const leftEyeHeight = Math.max(1e-6, lBottom.y - lTop.y);
  const rightEyeHeight = Math.max(1e-6, rBottom.y - rTop.y);
  const leftEyeCenterY = (lTop.y + lBottom.y) / 2;
  const rightEyeCenterY = (rTop.y + rBottom.y) / 2;

  const leftRatioY = (leftEyeCenterY - leftIris.y) / leftEyeHeight;
  const rightRatioY = (rightEyeCenterY - rightIris.y) / rightEyeHeight;
  const avgRatioY = (leftRatioY + rightRatioY) / 2;

  return {
    // Valori grezzi ma normalizzati, comparabili in scala tra loro (poi rimappati sullo
    // schermo tramite guadagno + calibrazione utente in useEyeTracking.js / Calibration.jsx)
    rawX: avgRatioX,
    rawY: avgRatioY, // positivo = sguardo verso l'alto
  };
}

/** Avvia il caricamento del modello in background, il prima possibile (es. al login). */
export function warmupGazeEngine() {
  return ensureLandmarker();
}

export function getGazeEngineState() {
  return { ...state };
}

export function subscribeGazeEngine(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function retryGazeEngine() {
  faceLandmarker?.close?.();
  faceLandmarker = null;
  readyPromise = null;
  state.stage = "idle";
  state.error = null;
  state.progress = null;
  return warmupGazeEngine();
}

export function resetGazeSmoothing() {
  smoothedX = null;
  smoothedY = null;
  lastTimestamp = -1;
  framesSeen = 0;
}

export function disposeGazeEngine() {
  faceLandmarker?.close?.();
  faceLandmarker = null;
  readyPromise = null;
  state.stage = "idle";
  state.error = null;
  state.progress = null;
  listeners.clear();
}

/**
 * Analizza il frame corrente del <video>. Sincrono (detectForVideo non è una Promise una
 * volta che il modello è caricato): chiamalo già throttlato dal chiamante.
 * Ritorna:
 *  - null se il modello non è ancora pronto
 *  - undefined se il frame va scartato (timestamp non valido/fuori ordine)
 *  - { faceDetected: false } se non è stato trovato alcun volto
 *  - { faceDetected: true, rawX, rawY } con le coordinate grezze (0..1) altrimenti
 */
export function detectFrame(videoEl, timestamp) {
  if (!faceLandmarker) return null;
  if (timestamp <= lastTimestamp) return undefined;
  lastTimestamp = timestamp;

  let result;
  try {
    result = faceLandmarker.detectForVideo(videoEl, timestamp);
  } catch (err) {
    console.error("[gazeEngine] detectForVideo failed:", err);
    state.stage = "error";
    state.error = String(err?.message || err);
    emit({ type: "error", message: state.error });
    return undefined;
  }

  framesSeen += 1;
  if (framesSeen <= 5 || framesSeen % 150 === 0) {
    console.debug(
      `[gazeEngine] frame #${framesSeen} — ${videoEl.videoWidth}x${videoEl.videoHeight}, faces: ${result?.faceLandmarks?.length ?? 0}`
    );
  }

  const landmarks = result?.faceLandmarks?.[0];
  if (!landmarks) return { faceDetected: false };

  const gaze = computeGazePoint(landmarks);
  if (!gaze) return { faceDetected: false };

  smoothedX = smoothedX == null ? gaze.rawX : smoothedX + SMOOTHING_ALPHA * (gaze.rawX - smoothedX);
  smoothedY = smoothedY == null ? gaze.rawY : smoothedY + SMOOTHING_ALPHA * (gaze.rawY - smoothedY);

  return { faceDetected: true, rawX: smoothedX, rawY: smoothedY };
}

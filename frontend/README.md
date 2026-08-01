# EyeContact — Frontend

React + Vite. Si collega al backend FastAPI già presente nel repository (`backend/`).

## Avvio

```bash
cd frontend
npm install
npm run dev
```

Il dev server gira su `http://localhost:5173` e proxya automaticamente `/api/*` verso
`http://localhost:8000` (il backend). Se il backend gira su un host/porta diversi, imposta
`VITE_BACKEND_ORIGIN` prima di `npm run dev`, oppure copia `.env.example` in `.env` e imposta
`VITE_API_URL` per puntare direttamente al backend in produzione.

## Struttura

- `src/lib/api.js`, `src/lib/endpoints.js` — client Axios + wrapper tipizzati per ogni router del backend (`auth`, `exercises`, `sessions`, `metrics`, `calibration`, `achievements`).
- `src/context/AuthContext.jsx` — sessione utente basata su JWT (`localStorage`), con redirect automatico al 401.
- `src/lib/gazeEngine.js` + `src/hooks/useEyeTracking.js` — modulo di eye-tracking (vedi sotto).
- `src/components/CameraPreview.jsx`, `src/components/GazeCircle.jsx` — anteprima webcam e indicatore visivo di volto/sguardo rilevato.
- `src/pages/Calibration.jsx` — calibrazione a 9 punti, calcola una trasformazione affine (minimi quadrati) e la salva su `/calibration/`.
- `src/pages/ExerciseSession.jsx` — esecuzione dell'esercizio (fissazione / saccadi / inseguimento), webcam in piccolo in un angolo, invio della sessione a `/sessions/`.

## Modulo di eye-tracking: note tecniche

Usa `@mediapipe/tasks-vision` (`FaceLandmarker`, landmark dell'iride con `refineLandmarks: true`).

**Il rilevamento gira sul thread principale, non in un Web Worker.** Prima girava in un Worker
dedicato per liberare il main thread, ma `@mediapipe/tasks-vision` non inizializza correttamente
il proprio runtime WASM dentro un Worker di tipo `"module"` sotto Vite (errore
`ModuleFactory not set`) — è un problema noto di compatibilità libreria/bundler, non qualcosa
di risolvibile in modo affidabile lato applicazione. Il costo CPU resta comunque sotto
controllo grazie a: throttling a ~24 FPS basato sul tempo trascorso, delegate `CPU` (più
affidabile del `GPU` in questo contesto), e `detectForVideo` chiamato direttamente
sull'elemento `<video>` (nessun downscale/bitmap intermedio: la libreria gestisce
internamente il ridimensionamento, evitando anche la distorsione da aspect-ratio che si
otterrebbe forzando un box fisso).

**Bug fix applicati nel tempo:**
- Gestione esplicita dei permessi webcam (`NotAllowedError`, `NotFoundError`, `NotReadableError`, contesto non sicuro) invece di un fallimento silenzioso.
- Attesa di `video.readyState >= 2` prima di analizzare un frame.
- Cleanup completo allo smontaggio: stop di tutte le track dello stream, cancellazione del loop (`requestAnimationFrame` / `requestVideoFrameCallback`).
- Webcam sempre visibile (mai `display:none`): su diversi browser un video nascosto non emette `requestVideoFrameCallback`, bloccando l'intero loop di rilevamento.
- Timestamp del loop basato sull'orologio globale della pagina (non su `metadata.mediaTime`, relativo al singolo stream e che si resetta ad ogni riavvio della webcam) — altrimenti il guard "scarta frame fuori ordine" finiva per scartare ogni frame dopo il primo riavvio della camera.
- Modello `.task` (~4MB) cachato esplicitamente via Cache Storage API, con barra di progresso reale del download, watchdog di stallo e timeout complessivo, invece di uno spinner che poteva restare bloccato all'infinito senza errore visibile.
- Smoothing esponenziale (EMA) sulle coordinate dello sguardo per ridurre il jitter.

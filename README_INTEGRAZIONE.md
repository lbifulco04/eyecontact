# EyeContact — Frontend React + Eye Tracking Service Python

Questo pacchetto aggiunge al backend FastAPI già esistente:

1. **`frontend/`** — SPA React + Vite (Tailwind, Framer Motion, Recharts) che copre
   tutte le funzionalità esposte dal backend: autenticazione, dashboard metriche,
   catalogo/raccomandazione esercizi, calibrazione a 9 punti, sessioni di allenamento
   con **tracciamento oculare live**, telemetria e traguardi/badge.
2. **`eye_tracking_service/`** — microservizio Python (FastAPI + MediaPipe + OpenCV)
   che riceve i frame webcam via WebSocket dal browser e restituisce le feature
   dello sguardo (posizione iride, blink, distanza dallo schermo) in tempo reale.
   Questo è il modo corretto per "usare le librerie Python di eye-tracking nel
   frontend": un browser non può eseguire MediaPipe/OpenCV nativamente, quindi il
   calcolo avviene in questo servizio dedicato, mentre React fa da orchestratore UI.
3. **Aggiunte al backend esistente** (`backend/`):
   - `models.py`: nuova tabella `TelemetriaSguardo` (lo schema `app/schemas/telemetry.py`
     esisteva già ma non era collegato a nessuna rotta/tabella).
   - `app/api/routes/telemetry.py`: nuove rotte `POST/GET /api/v1/sessions/{id}/telemetry`.
   - `app/main.py`: registra il nuovo router.
   - `docker-compose.yaml`: aggiunti i servizi `frontend` ed `eye_tracking_service`.

## Come integrare nel repository esistente

**Il pacchetto ora contiene un `backend/` completo** (non solo i file modificati),
quindi il modo più sicuro è **sostituire per intero** le cartelle `backend/`,
`frontend/`, `eye_tracking_service/` e il file `docker-compose.yaml` nel tuo
repository con quelli di questo zip:

```bash
# dalla root del tuo repository esistente — estrai lo zip in una cartella temporanea
unzip eyecontact-frontend-eyetracking.zip -d eyecontact-package

# sostituisci per intero (nessuna copia selettiva di singoli file)
rm -rf backend frontend eye_tracking_service
cp -r eyecontact-package/backend ./
cp -r eyecontact-package/frontend ./
cp -r eyecontact-package/eye_tracking_service ./
cp eyecontact-package/docker-compose.yaml ./docker-compose.yaml
```

Poi aggiorna il tuo `.env` confrontandolo con il nuovo `.env.example` incluso
qui (aggiunge `EYE_TRACKING_PORT`, `FRONTEND_PORT`, `VITE_API_BASE_URL`,
`VITE_EYE_TRACKING_WS_URL`, `VITE_EYE_TRACKING_HTTP_URL` — mantieni i valori
di `POSTGRES_*`, `SECRET_KEY`, ecc. che avevi già).

Se hai fatto modifiche personali dentro `backend/` che non sono nei file
elencati sopra (rotte extra, modelli custom), copiale a mano dal tuo vecchio
`backend/` in quello nuovo prima di lanciare `docker compose up --build`.

## Avvio

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs
- Eye tracking service: http://localhost:8100 (WebSocket su `/ws/track`)
- pgAdmin: http://localhost:5050

In sviluppo locale senza Docker, dentro `frontend/`:

```bash
npm install
cp .env.example .env
npm run dev
```

E dentro `eye_tracking_service/`:

```bash
pip install -r requirements.txt --break-system-packages
uvicorn main:app --reload --port 8100
```

## Come funziona il tracciamento oculare

1. **Calibrazione** (`/calibrazione`): l'utente fissa 9 punti sullo schermo. Per
   ogni punto il frontend invia ~20 frame webcam al microservizio via WebSocket,
   che con MediaPipe Face Mesh (iris landmarks) restituisce la posizione relativa
   dell'iride nell'occhio. Il frontend chiama poi `POST /calibrate/fit` sul
   microservizio, che calcola una regressione lineare (numpy, least squares) che
   mappa quelle feature grezze alle coordinate normalizzate dello schermo. La
   matrice risultante viene salvata sul backend esistente tramite
   `POST /api/v1/calibration/` nel campo `parametri_matrice`, riusando lo schema
   già presente.
2. **Esercizio live** (`/esercizi/:id/sessione`): il frontend riapre la
   connessione WebSocket, applica la matrice di calibrazione salvata ad ogni
   feature ricevuta per ottenere la posizione di sguardo stimata, la confronta
   con la posizione del bersaglio (fisso per la Fissazione, a scatti per le
   Saccadi, in movimento fluido per l'Inseguimento) e accumula precisione di
   fissazione, blink al minuto, distanza media dallo schermo e avvisi di postura.
3. Al termine, la sessione viene salvata con `POST /api/v1/sessions/` (stessa
   struttura dati del backend, inclusi `dettagli_esercizi`) e la telemetria
   aggregata con la nuova rotta `POST /api/v1/sessions/{id}/telemetry`.

## Note

- Tutte le chiamate API rispettano esattamente i nomi dei campi e degli
  endpoint già presenti nel backend (italiano incluso).
- Il design system (colori, tipografia, il "reticolo dello sguardo" come
  elemento distintivo dell'interfaccia) è documentato nei commenti dei
  componenti `GazeReticle.jsx` e `index.css`.
- Il modello di eye-tracking è iris-relative + calibrazione lineare per
  utente: è leggero e funziona bene per esercizi di fissazione/saccadi/
  inseguimento su schermo, ma non è un gaze-tracker di livello clinico.
  Per maggiore accuratezza si potrebbe sostituire il microservizio con un
  modello di gaze estimation più sofisticato (es. L2CS-Net) mantenendo
  identico il protocollo WebSocket verso il frontend.

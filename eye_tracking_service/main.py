"""
EyeContact - Eye Tracking Service
----------------------------------
Microservizio Python dedicato al tracciamento oculare in tempo reale.
Usa MediaPipe Face Mesh (con iris landmarks) per stimare, ad ogni frame
inviato dal browser via WebSocket:
  - la posizione relativa dell'iride nell'occhio (feature grezza di sguardo)
  - l'Eye Aspect Ratio (EAR) per il rilevamento del blink
  - una stima della distanza dallo schermo (basata sulla distanza interoculare in px)

Il frontend applica una calibrazione lineare (9 punti) alle feature grezze
per ottenere le coordinate di sguardo normalizzate sullo schermo (gaze_x, gaze_y).
La regressione della calibrazione viene calcolata qui (endpoint /calibrate/fit)
con numpy (least squares) e restituita come matrice serializzabile in JSON,
compatibile con il campo `parametri_matrice` di /api/v1/calibration del backend.
"""
import asyncio
import base64
import json
import time
from typing import List, Optional

import cv2
import numpy as np
# pyrefly: ignore [missing-import]
import mediapipe as mp
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

if not hasattr(mp, "solutions"):
    raise RuntimeError(
        "La libreria 'mediapipe' installata non espone più l'API legacy 'solutions' "
        "(rimossa a partire dalla versione 1.0.0, sostituita dalla nuova Tasks API). "
        "Verifica che requirements.txt fissi una versione compatibile, es. mediapipe==0.10.18, "
        f"e ricostruisci l'immagine con `docker compose build --no-cache eye_tracking_service`. "
        f"Versione mediapipe rilevata: {getattr(mp, '__version__', 'sconosciuta')}."
    )

app = FastAPI(title="EyeContact Eye Tracking Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mp_face_mesh = mp.solutions.face_mesh

# Landmark indices (MediaPipe Face Mesh, refine_landmarks=True per iris)
LEFT_EYE_CORNERS = (33, 133)
RIGHT_EYE_CORNERS = (362, 263)
LEFT_EYE_TOP_BOTTOM = (159, 145)
RIGHT_EYE_TOP_BOTTOM = (386, 374)
LEFT_IRIS = [468, 469, 470, 471]
RIGHT_IRIS = [473, 474, 475, 476]


def _eye_aspect_ratio(landmarks, top_idx, bottom_idx, left_idx, right_idx, w, h):
    top = np.array([landmarks[top_idx].x * w, landmarks[top_idx].y * h])
    bottom = np.array([landmarks[bottom_idx].x * w, landmarks[bottom_idx].y * h])
    left = np.array([landmarks[left_idx].x * w, landmarks[left_idx].y * h])
    right = np.array([landmarks[right_idx].x * w, landmarks[right_idx].y * h])
    vertical = np.linalg.norm(top - bottom)
    horizontal = np.linalg.norm(left - right)
    if horizontal == 0:
        return 0.0
    return float(vertical / horizontal)


class OneEuroFilter2D:
    """
    Filtro 1€ Bi-Assiale (Casiez et al., CHI 2012) — Standard industriale per Eye-Tracking.
    Elimina completamente il jitter ad alte frequenze (fissazione) e azzera la latenza durante le saccadi.
    """
    def __init__(self, min_cutoff_x=0.35, min_cutoff_y=0.18, beta_x=0.08, beta_y=0.06, d_cutoff=1.0):
        self.min_cutoff = np.array([min_cutoff_x, min_cutoff_y])
        self.beta = np.array([beta_x, beta_y])
        self.d_cutoff = d_cutoff
        self.x_prev = None
        self.dx_prev = np.zeros(2)
        self.t_prev = None

    def _alpha(self, rate, cutoff):
        tau = 1.0 / (2.0 * np.pi * cutoff)
        te = 1.0 / rate
        return 1.0 / (1.0 + tau / te)

    def filter(self, x, timestamp):
        if self.t_prev is None:
            self.x_prev = np.array(x, dtype=float)
            self.t_prev = timestamp
            return np.array(x, dtype=float)

        dt = timestamp - self.t_prev
        if dt <= 0.0:
            dt = 1e-4
        rate = 1.0 / dt

        x = np.array(x, dtype=float)
        dx = (x - self.x_prev) * rate
        alpha_d = self._alpha(rate, self.d_cutoff)
        dx_hat = alpha_d * dx + (1.0 - alpha_d) * self.dx_prev

        cutoff_x = self.min_cutoff[0] + self.beta[0] * abs(dx_hat[0])
        cutoff_y = self.min_cutoff[1] + self.beta[1] * abs(dx_hat[1])

        alpha_x = self._alpha(rate, cutoff_x)
        alpha_y = self._alpha(rate, cutoff_y)

        x_hat = np.array([
            alpha_x * x[0] + (1.0 - alpha_x) * self.x_prev[0],
            alpha_y * x[1] + (1.0 - alpha_y) * self.x_prev[1]
        ])

        self.x_prev = x_hat
        self.dx_prev = dx_hat
        self.t_prev = timestamp
        return x_hat

    def reset(self):
        self.x_prev = None
        self.dx_prev = np.zeros(2)
        self.t_prev = None


def extract_features(frame_bgr: np.ndarray, face_mesh, tracker_filter: Optional[OneEuroFilter2D] = None, timestamp: Optional[float] = None) -> Optional[dict]:
    h, w = frame_bgr.shape[:2]
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(frame_rgb)

    if not results.multi_face_landmarks:
        return None

    lm = results.multi_face_landmarks[0].landmark

    # 1. Posizione orizzontale dell'iride rispetto ai canthi [0..1]
    eye_w_l = max(1e-4, lm[LEFT_EYE_CORNERS[1]].x - lm[LEFT_EYE_CORNERS[0]].x)
    eye_w_r = max(1e-4, lm[RIGHT_EYE_CORNERS[1]].x - lm[RIGHT_EYE_CORNERS[0]].x)
    rx_l = (lm[LEFT_IRIS[0]].x - lm[LEFT_EYE_CORNERS[0]].x) / eye_w_l
    rx_r = (lm[RIGHT_IRIS[0]].x - lm[RIGHT_EYE_CORNERS[0]].x) / eye_w_r
    ratio_x = (rx_l + rx_r) / 2.0

    # Posizione verticale dell'iride all'interno dell'apertura palpebrale reale [0..1]
    eye_h_l = max(1e-4, lm[LEFT_EYE_TOP_BOTTOM[1]].y - lm[LEFT_EYE_TOP_BOTTOM[0]].y)
    eye_h_r = max(1e-4, lm[RIGHT_EYE_TOP_BOTTOM[1]].y - lm[RIGHT_EYE_TOP_BOTTOM[0]].y)
    ry_l = (lm[LEFT_IRIS[0]].y - lm[LEFT_EYE_TOP_BOTTOM[0]].y) / eye_h_l
    ry_r = (lm[RIGHT_IRIS[0]].y - lm[RIGHT_EYE_TOP_BOTTOM[0]].y) / eye_h_r
    ratio_y = (ry_l + ry_r) / 2.0

    # 2. EAR e rilevamento ammiccamento (Blink)
    ear_left = _eye_aspect_ratio(lm, LEFT_EYE_TOP_BOTTOM[0], LEFT_EYE_TOP_BOTTOM[1], *LEFT_EYE_CORNERS, w, h)
    ear_right = _eye_aspect_ratio(lm, RIGHT_EYE_TOP_BOTTOM[0], RIGHT_EYE_TOP_BOTTOM[1], *RIGHT_EYE_CORNERS, w, h)
    ear = (ear_left + ear_right) / 2.0
    blink = ear < 0.16

    # 3. Orientamento e posa del capo (Head Yaw & Head Pitch) da landmark 3D
    cheek_l = np.array([lm[234].x, lm[234].y])
    cheek_r = np.array([lm[454].x, lm[454].y])
    face_center_x = (cheek_l[0] + cheek_r[0]) / 2.0
    face_center_y = (cheek_l[1] + cheek_r[1]) / 2.0
    face_w = float(np.linalg.norm(cheek_r - cheek_l))

    chin = np.array([lm[152].x, lm[152].y])
    forehead = np.array([lm[10].x, lm[10].y])
    face_h = float(np.linalg.norm(chin - forehead))

    head_yaw = float((lm[1].x - face_center_x) / max(1e-4, face_w * 0.35))
    head_pitch = float((lm[1].y - face_center_y) / max(1e-4, face_h * 0.25))

    # 4. Proiezione sguardo con centro neutro calibrato (0.50 orizzontale, 0.44 verticale)
    # L'escursione orizzontale (0.13) e verticale (0.17) garantiscono massima reattività verso tutti i bordi
    norm_x = (ratio_x - 0.50) / 0.13
    norm_y = (ratio_y - 0.44) / 0.17

    gaze_x_comp = np.clip(norm_x * 0.44, -0.46, 0.46) + head_yaw * 0.20
    gaze_y_comp = np.clip(norm_y * 0.44, -0.46, 0.46) + head_pitch * 0.20

    raw_screen_x = float(np.clip(0.50 - gaze_x_comp, 0.04, 0.96))
    raw_screen_y = float(np.clip(0.50 + gaze_y_comp, 0.04, 0.96))

    # 5. Filtraggio temporale 1-Euro Filter bi-assiale (se fornito)
    feature_x, feature_y = raw_screen_x, raw_screen_y
    if tracker_filter is not None and timestamp is not None:
        if not blink:
            filtered = tracker_filter.filter([raw_screen_x, raw_screen_y], timestamp)
            feature_x, feature_y = float(filtered[0]), float(filtered[1])
        else:
            # Durante il blink mantiene la posizione precedente
            if tracker_filter.x_prev is not None:
                feature_x, feature_y = float(tracker_filter.x_prev[0]), float(tracker_filter.x_prev[1])

    # 6. Stima distanza accurata con modello pin-hole e IPD reale 6.3 cm
    pupil_l = np.array([lm[LEFT_IRIS[0]].x * w, lm[LEFT_IRIS[0]].y * h])
    pupil_r = np.array([lm[RIGHT_IRIS[0]].x * w, lm[RIGHT_IRIS[0]].y * h])
    ipd_px = float(np.linalg.norm(pupil_r - pupil_l))
    distanza_cm = None
    if ipd_px > 10:
        dist_calc = (5.17 * w) / ipd_px
        distanza_cm = float(np.clip(round(dist_calc, 1), 20.0, 120.0))

    return {
        "face_detected": True,
        "feature_x": feature_x,
        "feature_y": feature_y,
        "ear": ear,
        "blink": bool(blink),
        "distanza_cm": distanza_cm,
    }


@app.get("/")
def root():
    return {"status": "ok", "service": "eye_tracking_service"}


def _decode_and_extract(img_bytes: bytes, face_mesh, tracker_filter: Optional[OneEuroFilter2D], ts: float) -> Optional[dict]:
    try:
        np_arr = np.frombuffer(img_bytes, dtype=np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            return None
        return extract_features(frame, face_mesh, tracker_filter, ts)
    except Exception:
        return None


@app.websocket("/ws/track")
async def ws_track(websocket: WebSocket):
    """
    Protocollo WebSocket a bassa latenza con filtro 1€ bi-assiale per sessione:
      client -> Messaggio binario con JPEG bytes OPPURE JSON {"frame": "<jpeg base64>"}
      server -> JSON {"face_detected": bool, "feature_x": float, "feature_y": float,
                      "ear": float, "blink": bool, "distanza_cm": float|null, "ts": float}
    """
    await websocket.accept()
    tracker_filter = OneEuroFilter2D(min_cutoff_x=0.35, min_cutoff_y=0.18, beta_x=0.08, beta_y=0.06)
    with mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as face_mesh:
        try:
            while True:
                message = await websocket.receive()
                
                if message.get("type") == "websocket.disconnect":
                    break

                img_bytes: Optional[bytes] = None
                if "bytes" in message and message["bytes"]:
                    img_bytes = message["bytes"]
                elif "text" in message and message["text"]:
                    try:
                        payload = json.loads(message["text"])
                        frame_b64 = payload.get("frame")
                        if frame_b64:
                            img_bytes = base64.b64decode(frame_b64)
                    except Exception:
                        img_bytes = None

                if not img_bytes:
                    continue

                now_ts = time.time()
                features = await asyncio.to_thread(_decode_and_extract, img_bytes, face_mesh, tracker_filter, now_ts)

                if features is None:
                    await websocket.send_json({"face_detected": False, "ts": now_ts})
                else:
                    features["ts"] = now_ts
                    await websocket.send_json(features)
        except WebSocketDisconnect:
            return


# ---------------------------------------------------------------------------
# Calibrazione: fit di regressione lineare feature grezze -> coordinate schermo
# ---------------------------------------------------------------------------

class CalibrationSample(BaseModel):
    feature_x: float
    feature_y: float
    target_x_norm: float  # 0..1 posizione orizzontale del punto sullo schermo
    target_y_norm: float  # 0..1 posizione verticale del punto sullo schermo


class CalibrationFitRequest(BaseModel):
    samples: List[CalibrationSample]


@app.post("/calibrate/fit")
def calibrate_fit(req: CalibrationFitRequest):
    """
    Calcola una regressione lineare (least squares) che mappa (feature_x, feature_y)
    grezze dell'iride verso le coordinate normalizzate dello schermo (0..1),
    usando un modello affine con termini incrociati per compensare la geometria
    non lineare dello sguardo: target = a + b*fx + c*fy + d*fx*fy
    """
    if len(req.samples) < 6:
        return {"error": "Servono almeno 6 campioni di calibrazione"}

    A = []
    tx = []
    ty = []
    for s in req.samples:
        A.append([1.0, s.feature_x, s.feature_y, s.feature_x * s.feature_y])
        tx.append(s.target_x_norm)
        ty.append(s.target_y_norm)

    A = np.array(A)
    tx = np.array(tx)
    ty = np.array(ty)

    ridge = 1e-4 * np.eye(A.shape[1])
    ridge[0, 0] = 0.0  # non regolarizzare il bias
    coef_x = np.linalg.solve(A.T @ A + ridge, A.T @ tx)
    coef_y = np.linalg.solve(A.T @ A + ridge, A.T @ ty)

    pred_x = A @ coef_x
    pred_y = A @ coef_y
    rmse = float(np.sqrt(np.mean((pred_x - tx) ** 2 + (pred_y - ty) ** 2)))
    qualita_pct = float(max(0.0, min(100.0, 100.0 * (1.0 - rmse / 0.5))))

    return {
        "coef_x": coef_x.tolist(),
        "coef_y": coef_y.tolist(),
        "model": "affine_cross: target = c0 + c1*fx + c2*fy + c3*fx*fy",
        "qualita_calibrazione_pct": round(qualita_pct, 1),
    }

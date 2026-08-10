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
import base64
import time
from typing import List, Optional

import cv2
import numpy as np
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


def _iris_relative_position(landmarks, iris_idxs, corner_l_idx, corner_r_idx, w, h):
    iris_pts = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in iris_idxs])
    iris_center = iris_pts.mean(axis=0)
    corner_l = np.array([landmarks[corner_l_idx].x * w, landmarks[corner_l_idx].y * h])
    corner_r = np.array([landmarks[corner_r_idx].x * w, landmarks[corner_r_idx].y * h])
    eye_width = np.linalg.norm(corner_r - corner_l)
    if eye_width == 0:
        return 0.5, 0.5
    # proiezione dell'iride sull'asse orizzontale occhio (0 = angolo sx, 1 = angolo dx)
    axis = (corner_r - corner_l) / eye_width
    rel_x = float(np.dot(iris_center - corner_l, axis) / eye_width)
    # componente verticale approssimata rispetto al centro dell'occhio
    eye_center_y = (corner_l[1] + corner_r[1]) / 2.0
    rel_y = float((iris_center[1] - eye_center_y) / eye_width + 0.5)
    return rel_x, rel_y


def extract_features(frame_bgr: np.ndarray, face_mesh) -> Optional[dict]:
    h, w = frame_bgr.shape[:2]
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(frame_rgb)

    if not results.multi_face_landmarks:
        return None

    lm = results.multi_face_landmarks[0].landmark

    left_rel = _iris_relative_position(lm, LEFT_IRIS, *LEFT_EYE_CORNERS, w, h)
    right_rel = _iris_relative_position(lm, RIGHT_IRIS, *RIGHT_EYE_CORNERS, w, h)
    feature_x = (left_rel[0] + right_rel[0]) / 2.0
    feature_y = (left_rel[1] + right_rel[1]) / 2.0

    ear_left = _eye_aspect_ratio(lm, LEFT_EYE_TOP_BOTTOM[0], LEFT_EYE_TOP_BOTTOM[1], *LEFT_EYE_CORNERS, w, h)
    ear_right = _eye_aspect_ratio(lm, RIGHT_EYE_TOP_BOTTOM[0], RIGHT_EYE_TOP_BOTTOM[1], *RIGHT_EYE_CORNERS, w, h)
    ear = (ear_left + ear_right) / 2.0
    blink = ear < 0.18

    # Stima distanza: distanza interoculare in pixel è inversamente proporzionale
    # alla distanza reale dallo schermo. Costante calibrata empiricamente per una
    # webcam standard (~63mm interoculare medio adulto).
    left_eye_c = np.array([lm[LEFT_EYE_CORNERS[0]].x * w, lm[LEFT_EYE_CORNERS[0]].y * h])
    right_eye_c = np.array([lm[RIGHT_EYE_CORNERS[0]].x * w, lm[RIGHT_EYE_CORNERS[0]].y * h])
    interocular_px = float(np.linalg.norm(right_eye_c - left_eye_c))
    distanza_cm = None
    if interocular_px > 0:
        distanza_cm = float((63.0 * w) / (interocular_px * 1.2))

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


@app.websocket("/ws/track")
async def ws_track(websocket: WebSocket):
    """
    Protocollo:
      client -> {"frame": "<jpeg base64 senza prefisso data:>"}
      server -> {"face_detected": bool, "feature_x": float, "feature_y": float,
                  "ear": float, "blink": bool, "distanza_cm": float|null, "ts": float}
    """
    await websocket.accept()
    with mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as face_mesh:
        try:
            while True:
                payload = await websocket.receive_json()
                frame_b64 = payload.get("frame")
                if not frame_b64:
                    continue
                try:
                    img_bytes = base64.b64decode(frame_b64)
                    np_arr = np.frombuffer(img_bytes, dtype=np.uint8)
                    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                    if frame is None:
                        await websocket.send_json({"face_detected": False, "ts": time.time()})
                        continue
                    features = extract_features(frame, face_mesh)
                except Exception:
                    features = None

                if features is None:
                    await websocket.send_json({"face_detected": False, "ts": time.time()})
                else:
                    features["ts"] = time.time()
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

    coef_x, res_x, _, _ = np.linalg.lstsq(A, tx, rcond=None)
    coef_y, res_y, _, _ = np.linalg.lstsq(A, ty, rcond=None)

    pred_x = A @ coef_x
    pred_y = A @ coef_y
    rmse = float(np.sqrt(np.mean((pred_x - tx) ** 2 + (pred_y - ty) ** 2)))
    qualita_pct = float(max(0.0, min(100.0, 100.0 * (1.0 - rmse / 0.5))))

    return {
        "coef_x": coef_x.tolist(),
        "coef_y": coef_y.tolist(),
        "model": "affine_cross:  target = c0 + c1*fx + c2*fy + c3*fx*fy",
        "qualita_calibrazione_pct": round(qualita_pct, 1),
    }

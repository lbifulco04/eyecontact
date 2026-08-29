import asyncio
import base64
import json
import time
from typing import Optional, List

import cv2
import numpy as np
import mediapipe as mp
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

if not hasattr(mp, "solutions"):
    raise RuntimeError("MediaPipe legacy non disponibile. Installa mediapipe==0.10.18")

app = FastAPI(title="EyeContact Eye Tracking Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mp_face_mesh = mp.solutions.face_mesh

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
    def __init__(self,min_cutoff_x=0.5, min_cutoff_y=0.4, beta_x=0.01, beta_y=0.005, d_cutoff=1.0):
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

def extract_features(frame_bgr, face_mesh, tracker_filter=None, timestamp=None):
    h, w = frame_bgr.shape[:2]
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(frame_rgb)

    if not results.multi_face_landmarks:
        print("[FEATURES] Volto non rilevato", flush=True)
        return None
    print("[FEATURES] Volto rilevato", flush=True)

    lm = results.multi_face_landmarks[0].landmark

    # 1. EAR e blink
    ear_left = _eye_aspect_ratio(lm, LEFT_EYE_TOP_BOTTOM[0], LEFT_EYE_TOP_BOTTOM[1], *LEFT_EYE_CORNERS, w, h)
    ear_right = _eye_aspect_ratio(lm, RIGHT_EYE_TOP_BOTTOM[0], RIGHT_EYE_TOP_BOTTOM[1], *RIGHT_EYE_CORNERS, w, h)
    ear = (ear_left + ear_right) / 2.0
    blink = ear < 0.16

    # 2. Head pose (yaw, pitch)
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

    # 3. Calcolo ratio_x e ratio_y (posizione iride nei canthi)
    eye_w_l = max(1e-4, lm[LEFT_EYE_CORNERS[1]].x - lm[LEFT_EYE_CORNERS[0]].x)
    eye_w_r = max(1e-4, lm[RIGHT_EYE_CORNERS[1]].x - lm[RIGHT_EYE_CORNERS[0]].x)
    rx_l = (lm[LEFT_IRIS[0]].x - lm[LEFT_EYE_CORNERS[0]].x) / eye_w_l
    rx_r = (lm[RIGHT_IRIS[0]].x - lm[RIGHT_EYE_CORNERS[0]].x) / eye_w_r
    ratio_x = (rx_l + rx_r) / 2.0

    eye_h_l = max(1e-4, lm[LEFT_EYE_TOP_BOTTOM[1]].y - lm[LEFT_EYE_TOP_BOTTOM[0]].y)
    eye_h_r = max(1e-4, lm[RIGHT_EYE_TOP_BOTTOM[1]].y - lm[RIGHT_EYE_TOP_BOTTOM[0]].y)
    ry_l = (lm[LEFT_IRIS[0]].y - lm[LEFT_EYE_TOP_BOTTOM[0]].y) / eye_h_l
    ry_r = (lm[RIGHT_IRIS[0]].y - lm[RIGHT_EYE_TOP_BOTTOM[0]].y) / eye_h_r
    ratio_y = (ry_l + ry_r) / 2.0

    # 4. Compensazione della posa (leggera, coefficienti empirici)
    feature_x = float(np.clip(ratio_x - 0.35 * head_yaw, 0.0, 1.0))
    feature_y = float(np.clip(ratio_y - 0.35 * head_pitch, 0.0, 1.0))

    # 5. Filtro 1€ con congelamento durante blink/chiusura
    if tracker_filter is not None and timestamp is not None:
        if blink or ear < 0.18:
            if tracker_filter.x_prev is not None:
                feature_x, feature_y = float(tracker_filter.x_prev[0]), float(tracker_filter.x_prev[1])
        else:
            filtered = tracker_filter.filter([feature_x, feature_y], timestamp)
            feature_x, feature_y = float(filtered[0]), float(filtered[1])

    # 6. Distanza approssimata
    pupil_l = np.array([lm[LEFT_IRIS[0]].x * w, lm[LEFT_IRIS[0]].y * h])
    pupil_r = np.array([lm[RIGHT_IRIS[0]].x * w, lm[RIGHT_IRIS[0]].y * h])
    ipd_px = float(np.linalg.norm(pupil_r - pupil_l))
    distanza_cm = None
    if ipd_px > 10:
        dist_calc = (6.3 * w) / (2 * ipd_px * np.tan(np.radians(30)))
        distanza_cm = float(np.clip(round(dist_calc, 1), 20.0, 120.0))

    return {
        "face_detected": True,
        "feature_x": feature_x,
        "feature_y": feature_y,
        "head_yaw": head_yaw,
        "head_pitch": head_pitch,
        "ear": ear,
        "blink": bool(blink),
        "distanza_cm": distanza_cm,
    }

@app.get("/")
def root():
    return {"status": "ok", "service": "eye_tracking_service"}

def _decode_and_extract(img_bytes, face_mesh, tracker_filter, ts):
    try:
        np_arr = np.frombuffer(img_bytes, dtype=np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            print("[DECODE] Frame non decodificato", flush=True)
            return None
        return extract_features(frame, face_mesh, tracker_filter, ts)
    except Exception as e:
        print(f"[DECODE] Errore: {e}", flush=True)
        return None

@app.websocket("/ws/track")
async def ws_track(websocket: WebSocket):
    await websocket.accept()
    print("[WS] Connessione accettata", flush=True)
    query_params = dict(websocket.query_params)
    use_filter = query_params.get("smooth", "true").lower() != "false"
    tracker_filter = None
    if use_filter:
        tracker_filter = OneEuroFilter2D()
        print("[WS] Filtro attivo", flush=True)
    else:
        print("[WS] Filtro disattivato (smooth=false)", flush=True)

    with mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as face_mesh:
        try:
            while True:
                message = await websocket.receive()
                print(f"[WS] Ricevuto messaggio tipo: {message.get('type')}", flush=True)
                if message.get("type") == "websocket.disconnect":
                    print("[WS] Disconnessione", flush=True)
                    break
                img_bytes = None
                if "bytes" in message and message["bytes"]:
                    img_bytes = message["bytes"]
                    print(f"[WS] Ricevuti {len(img_bytes)} bytes binari", flush=True)
                elif "text" in message and message["text"]:
                    print("[WS] Ricevuto testo", flush=True)
                    try:
                        payload = json.loads(message["text"])
                        frame_b64 = payload.get("frame")
                        if frame_b64:
                            img_bytes = base64.b64decode(frame_b64)
                            print(f"[WS] Decodificati {len(img_bytes)} bytes da base64", flush=True)
                    except Exception as e:
                        print(f"[WS] Errore parsing JSON: {e}", flush=True)
                        img_bytes = None
                if not img_bytes:
                    print("[WS] Nessun frame valido, skip", flush=True)
                    continue
                now_ts = time.time()
                features = await asyncio.to_thread(_decode_and_extract, img_bytes, face_mesh, tracker_filter, now_ts)
                if features is None:
                    print("[WS] Nessuna feature estratta (volto non rilevato?)", flush=True)
                    await websocket.send_json({"face_detected": False, "ts": now_ts})
                else:
                    features["ts"] = now_ts
                    await websocket.send_json(features)
        except WebSocketDisconnect:
            print("[WS] WebSocketDisconnect", flush=True)
            return

# Calibrazione con regressione polinomiale di grado 2
class CalibrationSample(BaseModel):
    feature_x: float
    feature_y: float
    target_x_norm: float
    target_y_norm: float
    head_yaw: Optional[float] = None
    head_pitch: Optional[float] = None

class CalibrationFitRequest(BaseModel):
    samples: List[CalibrationSample]

@app.post("/calibrate/fit")
def calibrate_fit(req: CalibrationFitRequest):
    if len(req.samples) < 6:
        return {"error": "Servono almeno 6 campioni di calibrazione"}

    has_head_pose = all(s.head_yaw is not None and s.head_pitch is not None for s in req.samples)

    A = []
    tx = []
    ty = []
    for s in req.samples:
        fx, fy = s.feature_x, s.feature_y
        row = [1.0, fx, fy, fx*fy, fx*fx, fy*fy]
        if has_head_pose:
            row.extend([s.head_yaw, s.head_pitch, fx*s.head_yaw, fy*s.head_pitch])
        A.append(row)
        tx.append(s.target_x_norm)
        ty.append(s.target_y_norm)

    A = np.array(A)
    tx = np.array(tx)
    ty = np.array(ty)

    ridge = 1e-4 * np.eye(A.shape[1])
    ridge[0,0] = 0.0
    coef_x = np.linalg.solve(A.T @ A + ridge, A.T @ tx)
    coef_y = np.linalg.solve(A.T @ A + ridge, A.T @ ty)

    pred_x = A @ coef_x
    pred_y = A @ coef_y
    rmse = float(np.sqrt(np.mean((pred_x - tx) ** 2 + (pred_y - ty) ** 2)))
    qualita_pct = float(max(0.0, min(100.0, 100.0 * (1.0 - rmse / 0.5))))

    return {
        "coef_x": coef_x.tolist(),
        "coef_y": coef_y.tolist(),
        "model": "polynomial_degree2" + (" + head_pose" if has_head_pose else ""),
        "qualita_calibrazione_pct": round(qualita_pct, 1),
        "predictors": ["1", "fx", "fy", "fx*fy", "fx^2", "fy^2"] + (["head_yaw", "head_pitch", "fx*head_yaw", "fy*head_pitch"] if has_head_pose else [])
    }
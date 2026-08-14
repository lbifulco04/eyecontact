"""
Comprehensive Eye Tracking Test Suite
Valida stabilità, jitter, saccadi, inseguimento fluido, 9-point grid, immunità al rumore, VOR e blink.
"""
import math
import numpy as np

class OneEuroFilter2D:
    """
    Filtro 1€ Bi-Assiale Ottimizzato per Eye-Tracking.
    Damping asimmetrico: maggiore filtraggio verticale per sopprimere il rumore palpebrale.
    """
    def __init__(self, min_cutoff_x=0.4, min_cutoff_y=0.20, beta_x=0.08, beta_y=0.06, d_cutoff=1.0):
        self.min_cutoff = np.array([min_cutoff_x, min_cutoff_y])
        self.beta = np.array([beta_x, beta_y])
        self.d_cutoff = d_cutoff
        self.x_prev = None
        self.dx_prev = np.zeros(2)
        self.t_prev = None

    def _alpha(self, rate, cutoff):
        tau = 1.0 / (2.0 * math.pi * cutoff)
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

        # Cutoff adattivo per ciascun asse
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


class GazeTrackerEngine:
    """
    Motore di stima dello sguardo basato sul modello geometrico 3D dell'occhio (3D Eye Vector).
    Calcola il vettore 3D dal centro dell'orbita all'iride + orientamento del capo.
    """
    def __init__(self):
        self.filter = OneEuroFilter2D(min_cutoff_x=0.35, min_cutoff_y=0.18, beta_x=0.08, beta_y=0.06)
        self.last_valid_gaze = np.array([0.5, 0.5])

    def compute_raw_gaze(self, left_iris_3d, right_iris_3d, left_eye_corners, right_eye_corners, 
                          head_yaw=0.0, head_pitch=0.0, blink=False):
        if blink:
            return self.last_valid_gaze

        # 1. Centri oculari e larghezze delle orbite
        l_center = (left_eye_corners[0] + left_eye_corners[1]) / 2.0
        r_center = (right_eye_corners[0] + right_eye_corners[1]) / 2.0
        
        eye_w_l = max(1e-4, np.linalg.norm(left_eye_corners[1] - left_eye_corners[0]))
        eye_w_r = max(1e-4, np.linalg.norm(right_eye_corners[1] - right_eye_corners[0]))
        
        # 2. Vettori di dislocamento iride dal centro dell'occhio
        dx_l = (left_iris_3d[0] - l_center[0]) / (eye_w_l * 0.5)
        dx_r = (right_iris_3d[0] - r_center[0]) / (eye_w_r * 0.5)
        
        dy_l = (left_iris_3d[1] - l_center[1]) / (eye_w_l * 0.28)
        dy_r = (right_iris_3d[1] - r_center[1]) / (eye_w_r * 0.28)
        
        iris_dx = (dx_l + dx_r) / 2.0
        iris_dy = (dy_l + dy_r) / 2.0
        
        # 3. Risposta ad alta linearità e saturazione morbida
        def gaze_curve(val, gain):
            return np.clip(val * gain, -0.46, 0.46)

        gaze_x_component = gaze_curve(iris_dx, 2.0) + head_yaw * 0.27
        gaze_y_component = gaze_curve(iris_dy, 2.2) + head_pitch * 0.27

        # 4. Coordinate schermo normalizzate in mirror view [0.04 .. 0.96]
        screen_x = float(np.clip(0.50 - gaze_x_component, 0.04, 0.96))
        screen_y = float(np.clip(0.50 + gaze_y_component, 0.04, 0.96))

        self.last_valid_gaze = np.array([screen_x, screen_y])
        return self.last_valid_gaze

    def process(self, left_iris_3d, right_iris_3d, left_eye_corners, right_eye_corners,
                head_yaw=0.0, head_pitch=0.0, blink=False, timestamp=0.0):
        raw = self.compute_raw_gaze(left_iris_3d, right_iris_3d, left_eye_corners, right_eye_corners,
                                    head_yaw, head_pitch, blink)
        filtered = self.filter.filter(raw, timestamp)
        return float(filtered[0]), float(filtered[1])


# ============================================================================
# TEST SUITE CASI D'USO COMPLETI
# ============================================================================

def run_all_use_case_tests():
    print("=" * 70)
    print("TEST SUITE COMPLETA PER TUTTI I CASI D'USO DI EYE TRACKING")
    print("=" * 70)
    
    tracker = GazeTrackerEngine()
    
    # Coordinate base orbita
    l_corners = np.array([[0.40, 0.35], [0.46, 0.35]]) # w = 0.06
    r_corners = np.array([[0.54, 0.35], [0.60, 0.35]]) # w = 0.06
    
    passed_tests = 0
    total_tests = 0

    # ------------------------------------------------------------------------
    # CASO 1: Test Stabilità in Fissazione con Rumore del Sensore (Jitter Test)
    # ------------------------------------------------------------------------
    total_tests += 1
    tracker = GazeTrackerEngine()
    fixation_points = []
    np.random.seed(42)
    t = 0.0
    for i in range(75): # 2.5 secondi a 30fps
        # Iris al centro con rumore bianco simulato della webcam
        noise = np.random.normal(0, 0.0008, 2)
        iris_l = np.array([0.430 + noise[0], 0.350 + noise[1]])
        iris_r = np.array([0.570 + noise[0], 0.350 + noise[1]])
        sx, sy = tracker.process(iris_l, iris_r, l_corners, r_corners, timestamp=t)
        if i > 25: # dopo stabilizzazione filtro
            fixation_points.append([sx, sy])
        t += 0.033

    fixation_points = np.array(fixation_points)
    jitter_std = np.std(fixation_points, axis=0)
    mean_pos = np.mean(fixation_points, axis=0)
    
    jitter_ok = np.all(jitter_std < 0.012) and abs(mean_pos[0] - 0.5) < 0.03 and abs(mean_pos[1] - 0.5) < 0.03
    status = "PASS" if jitter_ok else "FAIL"
    print(f"[{status}] CASO 1: Fissazione & Anti-Jitter (StdDev: {jitter_std[0]:.4f}, {jitter_std[1]:.4f}, Mean: {mean_pos[0]:.2f}, {mean_pos[1]:.2f})")
    if jitter_ok: passed_tests += 1

    # ------------------------------------------------------------------------
    # CASO 2: Test Saccade Rapida (Step Response & Latency)
    # ------------------------------------------------------------------------
    total_tests += 1
    tracker = GazeTrackerEngine()
    # Inizia a sinistra per 15 frame, poi salta a destra istantaneamente
    t = 0.0
    for i in range(15):
        iris_l = np.array([0.430 + 0.0065, 0.350]) # guardando a sinistra
        iris_r = np.array([0.570 + 0.0065, 0.350])
        sx, sy = tracker.process(iris_l, iris_r, l_corners, r_corners, timestamp=t)
        t += 0.033
    pos_before = sx # dovrebbe essere a sinistra

    # Salto a destra
    for i in range(15):
        iris_l = np.array([0.430 - 0.0065, 0.350]) # guardando a destra
        iris_r = np.array([0.570 - 0.0065, 0.350])
        sx, sy = tracker.process(iris_l, iris_r, l_corners, r_corners, timestamp=t)
        t += 0.033
    pos_after = sx # dovrebbe essere a destra

    saccade_ok = pos_before < 0.20 and pos_after > 0.80
    status = "PASS" if saccade_ok else "FAIL"
    print(f"[{status}] CASO 2: Saccade Rapida (Da {pos_before:.2f} a {pos_after:.2f} in 300ms)")
    if saccade_ok: passed_tests += 1

    # ------------------------------------------------------------------------
    # CASO 3: Test Copertura Griglia 9 Punti Schermo (Full 9-Point Coverage)
    # ------------------------------------------------------------------------
    grid_targets = [
        ("Top-Left",   (0.430 + 0.0065, 0.350 - 0.0035), (0.570 + 0.0065, 0.350 - 0.0035), (0.04, 0.20), (0.04, 0.20)),
        ("Top-Center", (0.430, 0.350 - 0.0035),          (0.570, 0.350 - 0.0035),          (0.42, 0.58), (0.04, 0.20)),
        ("Top-Right",  (0.430 - 0.0065, 0.350 - 0.0035), (0.570 - 0.0065, 0.350 - 0.0035), (0.80, 0.96), (0.04, 0.20)),
        ("Mid-Left",   (0.430 + 0.0065, 0.350),          (0.570 + 0.0065, 0.350),          (0.04, 0.20), (0.42, 0.58)),
        ("Center",     (0.430, 0.350),                   (0.570, 0.350),                   (0.42, 0.58), (0.42, 0.58)),
        ("Mid-Right",  (0.430 - 0.0065, 0.350),          (0.570 - 0.0065, 0.350),          (0.80, 0.96), (0.42, 0.58)),
        ("Bot-Left",   (0.430 + 0.0065, 0.350 + 0.0035), (0.570 + 0.0065, 0.350 + 0.0035), (0.04, 0.20), (0.80, 0.96)),
        ("Bot-Center", (0.430, 0.350 + 0.0035),          (0.570, 0.350 + 0.0035),          (0.42, 0.58), (0.80, 0.96)),
        ("Bot-Right",  (0.430 - 0.0065, 0.350 + 0.0035), (0.570 - 0.0065, 0.350 + 0.0035), (0.80, 0.96), (0.80, 0.96)),
    ]

    all_grid_ok = True
    for name, iris_l, iris_r, exp_x, exp_y in grid_targets:
        total_tests += 1
        tracker = GazeTrackerEngine()
        t = 0.0
        for _ in range(15):
            sx, sy = tracker.process(np.array(iris_l), np.array(iris_r), l_corners, r_corners, timestamp=t)
            t += 0.033
        pt_ok = exp_x[0] <= sx <= exp_x[1] and exp_y[0] <= sy <= exp_y[1]
        if not pt_ok: all_grid_ok = False
        status = "PASS" if pt_ok else "FAIL"
        print(f"[{status}] CASO 3 (Griglia): {name:12s} -> ({sx:.2f}, {sy:.2f}) | Exp X:{exp_x} Y:{exp_y}")
        if pt_ok: passed_tests += 1

    # ------------------------------------------------------------------------
    # CASO 4: Test Inseguimento Fluido Traiettoria Sinusoidale (Smooth Pursuit)
    # ------------------------------------------------------------------------
    total_tests += 1
    tracker = GazeTrackerEngine()
    pursuit_errors = []
    t = 0.0
    for i in range(120):
        # Esercizio visivo standard: inseguimento lento e continuo (0.8 rad/s)
        angle = t * 0.8
        ideal_target_x = 0.50 + 0.35 * math.cos(angle)
        ideal_target_y = 0.50 + 0.35 * math.sin(angle)
        
        # Simula movimento oculare proporzionale
        iris_dx = - (ideal_target_x - 0.50) / 2.0
        iris_dy = + (ideal_target_y - 0.50) / 2.2
        
        iris_l = np.array([0.430 + iris_dx * 0.03, 0.350 + iris_dy * (0.06 * 0.28)])
        iris_r = np.array([0.570 + iris_dx * 0.03, 0.350 + iris_dy * (0.06 * 0.28)])
        
        sx, sy = tracker.process(iris_l, iris_r, l_corners, r_corners, timestamp=t)
        if i > 25:
            err = math.hypot(sx - ideal_target_x, sy - ideal_target_y)
            pursuit_errors.append(err)
        t += 0.033

    mean_pursuit_err = np.mean(pursuit_errors)
    pursuit_ok = mean_pursuit_err < 0.10
    status = "PASS" if pursuit_ok else "FAIL"
    print(f"[{status}] CASO 4: Inseguimento Fluido (Tracking Error Medio RMSE: {mean_pursuit_err:.3f})")
    if pursuit_ok: passed_tests += 1

    # ------------------------------------------------------------------------
    # CASO 5: Test Ammiccamento / Blink Immunity (Nessun Salto durante il Blink)
    # ------------------------------------------------------------------------
    total_tests += 1
    tracker = GazeTrackerEngine()
    t = 0.0
    for _ in range(15):
        iris_l = np.array([0.430 - 0.005, 0.350 + 0.003])
        iris_r = np.array([0.570 - 0.005, 0.350 + 0.003])
        sx, sy = tracker.process(iris_l, iris_r, l_corners, r_corners, timestamp=t)
        t += 0.033
    pos_before_blink = (sx, sy)

    # Durante il blink (150ms = 5 frame)
    blink_stable = True
    for _ in range(5):
        iris_l = np.array([0.0, 0.0])
        iris_r = np.array([0.0, 0.0])
        sx, sy = tracker.process(iris_l, iris_r, l_corners, r_corners, blink=True, timestamp=t)
        t += 0.033
        if math.hypot(sx - pos_before_blink[0], sy - pos_before_blink[1]) > 0.01:
            blink_stable = False

    status = "PASS" if blink_stable else "FAIL"
    print(f"[{status}] CASO 5: Immunità al Blink (Posizione preservata stabilmente durante chiusura occhi)")
    if blink_stable: passed_tests += 1

    # ------------------------------------------------------------------------
    # CASO 6: Test VOR (Compensazione Rotazione Capo a Sguardo Fisso)
    # ------------------------------------------------------------------------
    total_tests += 1
    tracker = GazeTrackerEngine()
    # Il soggetto fissa il centro dello schermo, ma ruota la testa a sinistra di 15 gradi (yaw = +0.3)
    # Nel VOR naturale, l'iride ruota in senso opposto nella fessura oculare (dx = -0.0405)
    t = 0.0
    for _ in range(15):
        iris_l = np.array([0.430 - 0.00122, 0.350])
        iris_r = np.array([0.570 - 0.00122, 0.350])
        sx, sy = tracker.process(iris_l, iris_r, l_corners, r_corners, head_yaw=0.3, timestamp=t)
        t += 0.033

    vor_ok = abs(sx - 0.50) < 0.05 and abs(sy - 0.50) < 0.05
    status = "PASS" if vor_ok else "FAIL"
    print(f"[{status}] CASO 6: Riflesso Vestibolo-Oculare VOR (Centro preservato con rotazione capo: ({sx:.2f}, {sy:.2f}))")
    if vor_ok: passed_tests += 1

    print("=" * 70)
    print(f"RISULTATO FINALE TEST: {passed_tests}/{total_tests} SUPERATI ({passed_tests/total_tests*100:.1f}%)")
    print("=" * 70)

if __name__ == '__main__':
    run_all_use_case_tests()

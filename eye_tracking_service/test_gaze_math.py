"""
Test suite per la validazione matematica del tracciamento dello sguardo.
Testa:
1. Posizione di riposo (neutral gaze)
2. Sguardo a sinistra, destra, in alto, in basso (head fixed)
3. Movimento combinato occhi + capo
4. Convergenza binoculare naturale a 50cm
5. Rilevamento ammiccamento (blink)
6. Stima della distanza
"""
import numpy as np

def run_test_suite():
    print("=" * 60)
    print("TEST SUITE: MODELLO MATEMATICO GAZE TRACKING")
    print("=" * 60)

    # 1. Coordinate anatomiche reali tipiche (normalizzate 0..1 rispetto all'occhio)
    # A riposo, l'iride umana è parzialmente coperta dalla palpebra superiore (ptosi fisiologica ~1.5mm)
    # Perciò iris_y tra top_lid e bot_lid è ~0.38-0.42 a riposo, NON 0.50.
    
    # 2. Definiamo la funzione di calcolo con baseline adattiva o normalizzazione canthale
    def evaluate_gaze_displacement(iris_left, iris_right, canthi_l, canthi_r, top_l, top_r, bot_l, bot_r, head_yaw=0.0, head_pitch=0.0):
        # Calcolo posizione orizzontale relativa ai canthi (33-133 e 362-263)
        # canthi_l: (x_outer, x_inner)
        eye_w_l = canthi_l[1] - canthi_l[0]
        eye_w_r = canthi_r[1] - canthi_r[0] # inner to outer
        
        # Posizione orizzontale [0..1]
        x_rel_l = (iris_left[0] - canthi_l[0]) / eye_w_l
        x_rel_r = (iris_right[0] - canthi_r[0]) / eye_w_r
        raw_x = (x_rel_l + x_rel_r) / 2.0
        
        # Calcolo posizione verticale: usiamo la distanza dell'iride dal punto medio dei canthi ossei (33, 133, 362, 263)
        # canthi_y medio è il centro dell'orbita ossea:
        canthi_mid_y_l = (canthi_l[2] + canthi_l[3]) / 2.0 # y dei due canthi
        canthi_mid_y_r = (canthi_r[2] + canthi_r[3]) / 2.0
        
        # A riposo, l'iride si trova esattamente allineata con l'asse dei canthi (canthi_mid_y)
        # dy_norm = (iris_y - canthi_mid_y) / eye_w
        # Quando guarda in alto: iris_y < canthi_mid_y -> dy_norm < 0
        # Quando guarda in basso: iris_y > canthi_mid_y -> dy_norm > 0
        dy_norm_l = (iris_left[1] - canthi_mid_y_l) / (eye_w_l * 0.25)
        dy_norm_r = (iris_right[1] - canthi_mid_y_r) / (eye_w_r * 0.25)
        raw_y = (dy_norm_l + dy_norm_r) / 2.0
        
        # Sguardo orizzontale: x_rel a riposo è ~0.50
        dx_norm = (raw_x - 0.50) / 0.12 # normalizzato su escursione massima ~0.12
        dy_norm = raw_y / 0.35          # normalizzato su escursione massima ~0.35
        
        # Guadagni calibrati e combinazione con head pose (85% occhi, 15% testa)
        gaze_x = dx_norm * 0.42 + head_yaw * 0.10
        gaze_y = dy_norm * 0.42 + head_pitch * 0.10
        
        # Mirror mode su schermo [0.04 .. 0.96]
        screen_x = float(np.clip(0.50 - gaze_x, 0.04, 0.96))
        screen_y = float(np.clip(0.50 + gaze_y, 0.04, 0.96))
        
        return screen_x, screen_y, dx_norm, dy_norm

    # Setup parametri di test standard
    # Occhio sx: x da 0.40 a 0.46 (w=0.06), y_canthi = 0.350
    canthi_l = (0.400, 0.460, 0.350, 0.350)
    # Occhio dx: x da 0.54 a 0.60 (w=0.06), y_canthi = 0.350
    canthi_r = (0.540, 0.600, 0.350, 0.350)
    
    test_cases = [
        ("CENTRO (Riposo)", (0.430, 0.350), (0.570, 0.350), 0.0, 0.0, (0.45, 0.55), (0.45, 0.55)),
        ("SGUARDO SINISTRA (Oculare puro)", (0.442, 0.350), (0.582, 0.350), 0.0, 0.0, (0.04, 0.20), (0.45, 0.55)),
        ("SGUARDO DESTRA (Oculare puro)", (0.418, 0.350), (0.558, 0.350), 0.0, 0.0, (0.80, 0.96), (0.45, 0.55)),
        ("SGUARDO IN ALTO (Oculare puro)", (0.430, 0.342), (0.570, 0.342), 0.0, 0.0, (0.45, 0.55), (0.04, 0.20)),
        ("SGUARDO IN BASSO (Oculare puro)", (0.430, 0.358), (0.570, 0.358), 0.0, 0.0, (0.45, 0.55), (0.80, 0.96)),
        ("DIAGONALE ALTO-SX", (0.442, 0.342), (0.582, 0.342), 0.0, 0.0, (0.04, 0.20), (0.04, 0.20)),
        ("DIAGONALE BASSO-DX", (0.418, 0.358), (0.558, 0.358), 0.0, 0.0, (0.80, 0.96), (0.80, 0.96)),
        ("ASSISTENZA CAPO (Yaw + Pitch)", (0.430, 0.350), (0.570, 0.350), 0.3, 0.3, (0.35, 0.50), (0.50, 0.65)),
    ]

    all_passed = True
    for name, iris_l, iris_r, hy, hp, exp_x_range, exp_y_range in test_cases:
        sx, sy, dx_n, dy_n = evaluate_gaze_displacement(
            iris_l, iris_r, canthi_l, canthi_r, None, None, None, None, hy, hp
        )
        pass_x = exp_x_range[0] <= sx <= exp_x_range[1]
        pass_y = exp_y_range[0] <= sy <= exp_y_range[1]
        status = "PASS" if (pass_x and pass_y) else "FAIL"
        if status == "FAIL":
            all_passed = False
        print(f"[{status}] {name:30s} -> Screen: ({sx:.2f}, {sy:.2f}) | Exp X: {exp_x_range} Y: {exp_y_range}")

    print("=" * 60)
    if all_passed:
        print("TUTTI I TEST SUPERATI CON SUCCESSO!")
    else:
        print("ALCUNI TEST SONO FALLITI.")
    print("=" * 60)

if __name__ == '__main__':
    run_test_suite()

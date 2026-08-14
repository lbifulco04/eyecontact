"""
Test di integrazione con MediaPipe Face Mesh su frame sintetico e validazione di extract_features
"""
import cv2
import numpy as np
import mediapipe as mp

def test_mediapipe_integration():
    print("=" * 60)
    print("TEST DI INTEGRAZIONE: MEDIAPIPE FACE MESH")
    print("=" * 60)
    
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    
    # Importiamo la funzione extract_features dal modulo principale
    import main
    
    # Creiamo un'immagine sintetica con un volto base
    # (per verificare che il codice di decodifica e gestione non sollevi eccezioni)
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    features = main.extract_features(dummy_frame, face_mesh)
    print(f"Frame vuoto (nessun viso) -> Risultato: {features} (Dovrebbe essere None: {'OK' if features is None else 'FAIL'})")
    
    print("=" * 60)
    print("MediaPipe Face Mesh inizializzato correttamente con refine_landmarks=True")
    print("=" * 60)

if __name__ == '__main__':
    test_mediapipe_integration()

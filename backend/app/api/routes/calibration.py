from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user
from models import Utente
from app.schemas.calibration import CalibrationCreate, CalibrationResponse

router = APIRouter(prefix="/calibration", tags=["Calibrazione WebCam"])

# In-memory store per i profili di calibrazione hardware/schermo per utente
_calibration_store = {}


@router.post("/", response_model=CalibrationResponse, status_code=status.HTTP_201_CREATED)
def salva_calibrazione(
    calib_in: CalibrationCreate,
    utente_attuale: Utente = Depends(get_current_user)
):
    """
    Salva il profilo di calibrazione dello sguardo per il dispositivo corrente.
    Permette al frontend di riutilizzare la matrice di calibrazione evitando di ripetere i 9 punti ad ogni avvio.
    """
    profile = CalibrationResponse(
        id_calibrazione=utente_attuale.id_utente or 1,
        id_utente=utente_attuale.id_utente,
        data_calibrazione=datetime.now(timezone.utc),
        **calib_in.model_dump()
    )
    _calibration_store[utente_attuale.id_utente] = profile
    return profile


@router.get("/me", response_model=Optional[CalibrationResponse])
def ottieni_ultima_calibrazione(
    utente_attuale: Utente = Depends(get_current_user)
):
    """
    Recupera l'ultimo profilo di calibrazione attivo per l'utente loggato.
    """
    return _calibration_store.get(utente_attuale.id_utente)

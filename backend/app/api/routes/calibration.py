from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlmodel import Session as DBSession, select

from app.api.deps import get_current_user
from app.core.database import get_session
from models import Utente, CalibrazioneUtente
from app.schemas.calibration import CalibrationCreate, CalibrationResponse

router = APIRouter(prefix="/calibration", tags=["Calibrazione WebCam"])


@router.post("/", response_model=CalibrationResponse, status_code=status.HTTP_201_CREATED)
def salva_calibrazione(
    calib_in: CalibrationCreate,
    db: DBSession = Depends(get_session),
    utente_attuale: Utente = Depends(get_current_user)
):
    """
    Salva il profilo di calibrazione dello sguardo per il dispositivo corrente nel database.
    Permette al frontend di riutilizzare la matrice di calibrazione evitando di ripetere i 9 punti ad ogni avvio.
    """
    db_calib = CalibrazioneUtente(
        id_utente=utente_attuale.id_utente,
        data_calibrazione=datetime.now(timezone.utc),
        **calib_in.model_dump()
    )
    db.add(db_calib)
    db.commit()
    db.refresh(db_calib)
    return db_calib


@router.get("/me", response_model=Optional[CalibrationResponse])
def ottieni_ultima_calibrazione(
    db: DBSession = Depends(get_session),
    utente_attuale: Utente = Depends(get_current_user)
):
    """
    Recupera l'ultimo profilo di calibrazione attivo per l'utente loggato dal database.
    """
    stmt = (
        select(CalibrazioneUtente)
        .where(CalibrazioneUtente.id_utente == utente_attuale.id_utente)
        .order_by(CalibrazioneUtente.data_calibrazione.desc())
    )
    return db.exec(stmt).first()

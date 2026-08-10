from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session as DBSession, select

from app.api.deps import get_current_user
from app.core.database import get_session
from models import Utente, Sessione, TelemetriaSguardo
from app.schemas.telemetry import TelemetriaSguardoCreate, TelemetriaSguardoResponse

router = APIRouter(prefix="/sessions", tags=["Telemetria Sguardo"])


def _get_owned_sessione(db: DBSession, id_sessione: int, utente_attuale: Utente) -> Sessione:
    db_sessione = db.get(Sessione, id_sessione)
    if not db_sessione:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sessione non trovata")
    if db_sessione.id_utente != utente_attuale.id_utente:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Non hai i permessi per questa sessione")
    return db_sessione


@router.post(
    "/{id_sessione}/telemetry",
    response_model=TelemetriaSguardoResponse,
    status_code=status.HTTP_201_CREATED,
)
def registra_telemetria_sessione(
    id_sessione: int,
    telemetria_in: TelemetriaSguardoCreate,
    db: DBSession = Depends(get_session),
    utente_attuale: Utente = Depends(get_current_user),
):
    """
    Registra i dati aggregati di telemetria (precisione fissazione, blink rate,
    distanza dallo schermo, saccadi perse, avvisi postura) calcolati dal
    microservizio di eye-tracking al termine di una sessione o di un esercizio.
    """
    _get_owned_sessione(db, id_sessione, utente_attuale)

    db_telemetria = TelemetriaSguardo(
        id_sessione=id_sessione,
        **telemetria_in.model_dump(),
    )
    db.add(db_telemetria)
    db.commit()
    db.refresh(db_telemetria)
    return db_telemetria


@router.get(
    "/{id_sessione}/telemetry",
    response_model=List[TelemetriaSguardoResponse],
)
def leggi_telemetria_sessione(
    id_sessione: int,
    db: DBSession = Depends(get_session),
    utente_attuale: Utente = Depends(get_current_user),
):
    """Restituisce tutti i campioni di telemetria registrati per una sessione."""
    _get_owned_sessione(db, id_sessione, utente_attuale)

    stmt = select(TelemetriaSguardo).where(TelemetriaSguardo.id_sessione == id_sessione)
    return db.exec(stmt).all()

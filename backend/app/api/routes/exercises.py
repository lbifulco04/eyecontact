from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session as DBSession, select

from app.api.deps import  get_current_user
from app.core.database import get_session
from models import Utente, Esercizio
from app.schemas.exercises import (
    EsercizioCreate,
    EsercizioResponse,
    EsercizioUpdate
)

router = APIRouter(prefix="/exercises", tags=["Catalogo Esercizi"])


@router.post("/", response_model=EsercizioResponse, status_code=status.HTTP_201_CREATED)
def crea_esercizio(
    esercizio_in: EsercizioCreate,
    db: DBSession = Depends(get_session),
    utente_attuale: Utente = Depends(get_current_user)  
):
    """
    Aggiunge un nuovo esercizio al catalogo.
    """
    db_esercizio = Esercizio.model_validate(esercizio_in)
    
    db.add(db_esercizio)
    db.commit()
    db.refresh(db_esercizio)
    return db_esercizio


@router.get("/", response_model=List[EsercizioResponse])
def lista_esercizi(
    db: DBSession = Depends(get_session)
):
    """
    Restituisce l'elenco di tutti gli esercizi disponibili nel catalogo.
    """
    statement = select(Esercizio)
    esercizi = db.exec(statement).all()
    return esercizi


@router.get("/{id_esercizio}", response_model=EsercizioResponse)
def dettaglio_esercizio(
    id_esercizio: int,
    db: DBSession = Depends(get_session)
):
    """
    Recupera i dettagli di un singolo esercizio tramite il suo ID.
    """
    db_esercizio = db.get(Esercizio, id_esercizio)
    if not db_esercizio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Esercizio con ID {id_esercizio} non trovato"
        )
    return db_esercizio
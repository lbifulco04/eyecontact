import re
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session as DBSession, select

from app.api.deps import get_current_user
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
    codice = esercizio_in.codice
    if not codice:
        codice = re.sub(r'[^a-z0-9_]', '_', esercizio_in.nome.lower().strip())
    
    # Verifica unicità codice
    stmt = select(Esercizio).where(Esercizio.codice == codice)
    if db.exec(stmt).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Esercizio con codice '{codice}' già esistente."
        )

    db_esercizio = Esercizio(
        nome=esercizio_in.nome,
        descrizione=esercizio_in.descrizione,
        durata_consigliata_sec=esercizio_in.durata_consigliata_sec,
        categoria=esercizio_in.categoria,
        codice=codice
    )
    
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


@router.get("/recommended", response_model=List[EsercizioResponse])
def esercizi_raccomandati(
    affaticamento_pre: int = 5,
    db: DBSession = Depends(get_session)
):
    """
    Restituisce la lista di esercizi raccomandati in base al livello di affaticamento visivo dichiarato (1-10):
    - Alto affaticamento (>=7): esercizi di fissazione e movimento lento/riposo visivo.
    - Basso/Medio affaticamento (<7): esercizi di inseguimento dinamico e saccadi.
    """
    all_esercizi = db.exec(select(Esercizio)).all()
    if not all_esercizi:
        return []

    if affaticamento_pre >= 7:
        # Prediligi fissazione e inseguimento lento
        raccomandati = [e for e in all_esercizi if e.categoria in ["Fissazione", "Inseguimento"]]
    elif affaticamento_pre <= 3:
        # Prediligi saccadi ed esercitazioni dinamiche
        raccomandati = [e for e in all_esercizi if e.categoria in ["Saccadi", "Inseguimento"]]
    else:
        raccomandati = all_esercizi

    return raccomandati if raccomandati else all_esercizi



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

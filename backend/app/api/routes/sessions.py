from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session as DBSession, select

from app.api.deps import get_current_user
from app.core.database import get_session
from models import Utente, Sessione, EsercizioInSessione, Esercizio
from app.schemas.sessions import (
    SessioneCreate,
    SessioneResponse,
    EsercizioInSessioneCreate,
    EsercizioInSessioneResponse
)

router = APIRouter(prefix="/sessions", tags=["Sessioni e Allenamenti"])


@router.post("/", response_model=SessioneResponse, status_code=status.HTTP_201_CREATED)
def crea_sessione(
    sessione_in: SessioneCreate,
    db: DBSession = Depends(get_session),
    utente_attuale: Utente = Depends(get_current_user)
):
    """
    Crea una nuova sessione di allenamento con relativi esercizi svolti.
    Calcola in automatico delta_affaticamento e tasso_completamento_pct.
    """
    # 1. Instanziamo la sessione associandola all'utente loggato
    db_sessione = Sessione(
        id_utente=utente_attuale.id_utente,
        durata_totale_sec=sessione_in.durata_totale_sec,
        affaticamento_pre=sessione_in.affaticamento_pre,
        affaticamento_post=sessione_in.affaticamento_post,
        note=sessione_in.note
    )

    # 2. Calcolo Delta Affaticamento se entrambi i valori sono presenti
    if db_sessione.affaticamento_pre is not None and db_sessione.affaticamento_post is not None:
        db_sessione.delta_affaticamento = db_sessione.affaticamento_post - db_sessione.affaticamento_pre

    # 3. Gestione ed eventuale aggiunta degli esercizi legati alla sessione
    completati_count = 0
    totali_count = len(sessione_in.dettagli_esercizi) if sessione_in.dettagli_esercizi else 0

    esercizi_db = []
    if sessione_in.dettagli_esercizi:
        for ex in sessione_in.dettagli_esercizi:
            # Verifica che l'esercizio esista nel catalogo
            ex_db = db.get(Esercizio, ex.id_esercizio)
            if not ex_db:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, 
                    detail=f"Esercizio con ID {ex.id_esercizio} non trovato"
                )
            
            if ex.completato:
                completati_count += 1
            
            # Prepariamo la riga per la tabella di join/dettaglio
            dettaglio = EsercizioInSessione(
                id_esercizio=ex.id_esercizio,
                tempo_target_sec=ex.tempo_target_sec,
                tempo_effettivo_sec=ex.tempo_effettivo_sec,
                completato=ex.completato
            )
            esercizi_db.append(dettaglio)

    # 4. Calcolo Tasso Completamento %
    if totali_count > 0:
        db_sessione.tasso_completamento_pct = round((completati_count / totali_count) * 100, 2)
    else:
        db_sessione.tasso_completamento_pct = 0.0

    # Salviamo la sessione per ottenere il suo ID
    db.add(db_sessione)
    db.commit()
    db.refresh(db_sessione)

    # Colleghiamo i dettagli salvando l'id_sessione appena generato
    for dett in esercizi_db:
        dett.id_sessione = db_sessione.id_sessione
        db.add(dett)

    if esercizi_db:
        db.commit()
        db.refresh(db_sessione)

    return db_sessione


@router.post("/{id_sessione}/esercizi", response_model=EsercizioInSessioneResponse, status_code=status.HTTP_201_CREATED)
def aggiungi_esercizio_a_sessione(
    id_sessione: int,
    esercizio_in: EsercizioInSessioneCreate,
    db: DBSession = Depends(get_session),
    utente_attuale: Utente = Depends(get_current_user)
):
    """Aggiunge un singolo esercizio a una sessione già esistente."""
    db_sessione = db.get(Sessione, id_sessione)
    if not db_sessione:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    
    if db_sessione.id_utente != utente_attuale.id_utente:
        raise HTTPException(status_code=403, detail="Non hai i permessi per questa sessione")

    ex_db = db.get(Esercizio, esercizio_in.id_esercizio)
    if not ex_db:
        raise HTTPException(status_code=404, detail=f"Esercizio con ID {esercizio_in.id_esercizio} non trovato")

    db_dettaglio = EsercizioInSessione(
        id_sessione=id_sessione,
        id_esercizio=esercizio_in.id_esercizio,
        tempo_target_sec=esercizio_in.tempo_target_sec,
        tempo_effettivo_sec=esercizio_in.tempo_effettivo_sec,
        completato=esercizio_in.completato
    )

    db.add(db_dettaglio)
    db.commit()
    db.refresh(db_dettaglio)
    return db_dettaglio


@router.get("/me", response_model=List[SessioneResponse])
def leggi_mie_sessioni(
    db: DBSession = Depends(get_session),
    utente_attuale: Utente = Depends(get_current_user)
):
    """Restituisce la lista di tutte le sessioni svolte dall'utente autenticato."""
    statement = (
        select(Sessione)
        .where(Sessione.id_utente == utente_attuale.id_utente)
        .order_by(Sessione.data_ora_inizio.desc())
    )
    return db.exec(statement).all()
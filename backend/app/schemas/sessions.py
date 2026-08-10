from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

# --- SCHEMA PER GLI ESERCIZI IN SESSIONE ---
class EsercizioInSessioneBase(BaseModel):
    id_esercizio: int
    tempo_target_sec: int
    tempo_effettivo_sec: int
    completato: bool = False

class EsercizioInSessioneCreate(EsercizioInSessioneBase):
    pass

class EsercizioInSessioneResponse(EsercizioInSessioneBase):
    id_dettaglio: int
    id_sessione: int

    model_config = {"from_attributes": True}


# --- SCHEMA PER LA SESSIONE ---
class SessioneBase(BaseModel):
    durata_totale_sec: int
    affaticamento_pre: Optional[int] = Field(None, ge=1, le=10)
    affaticamento_post: Optional[int] = Field(None, ge=1, le=10)
    note: Optional[str] = None

class SessioneCreate(SessioneBase):
    dettagli_esercizi: Optional[List[EsercizioInSessioneCreate]] = []

class SessioneResponse(SessioneBase):
    id_sessione: int
    id_utente: int
    data_ora_inizio: datetime
    delta_affaticamento: Optional[int] = None
    tasso_completamento_pct: Optional[float] = None
    dettagli_esercizi: List[EsercizioInSessioneResponse] = []

    model_config = {"from_attributes": True}

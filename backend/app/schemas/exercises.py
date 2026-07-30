from typing import Optional
from pydantic import BaseModel, Field

# --- SCHEMA BASE ---
class EsercizioBase(BaseModel):
    nome: str = Field(..., min_length=2, max_length=100, example="Inseguimento Visivo")
    descrizione: Optional[str] = Field(None, example="Traccia il pallino rosso con gli occhi")
    durata_consigliata_sec: int = Field(..., gt=0, example=60)
    categoria: Optional[str] = Field(None, example="Saccadi")

# --- SCHEMA INSERIMENTO ---
class EsercizioCreate(EsercizioBase):
    pass

# --- SCHEMA AGGIORNAMENTO (Opzionale) ---
class EsercizioUpdate(BaseModel):
    nome: Optional[str] = None
    descrizione: Optional[str] = None
    durata_consigliata_sec: Optional[int] = Field(None, gt=0)
    categoria: Optional[str] = None

# --- SCHEMA RISPOSTA ---
class EsercizioResponse(EsercizioBase):
    id_esercizio: int

    model_config = {"from_attributes": True}
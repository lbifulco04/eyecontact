from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class Badge(BaseModel):
    id_badge: str = Field(..., example="streak_7_giorni")
    titolo: str = Field(..., example="Occhio d'Aquila")
    descrizione: str = Field(..., example="Completato un allenamento al giorno per 7 giorni consecutivi")
    icona_emoji: str = Field(..., example="🦅")
    sbloccato: bool = Field(..., example=True)
    data_sblocco: Optional[datetime] = None
    progresso_pct: float = Field(..., ge=0.0, le=100.0, example=100.0)


class AchievementsResponse(BaseModel):
    totale_badge_sbloccati: int
    totale_badge: int
    badge: List[Badge]

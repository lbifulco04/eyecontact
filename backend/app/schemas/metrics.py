from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class GraficoSettimanaleItem(BaseModel):
    data: str = Field(..., example="2026-07-30")
    giorno_settimana: str = Field(..., example="Gio")
    minuti: float = Field(..., example=15.5)


class DashboardResponse(BaseModel):
    streak_giorni: int = Field(..., example=5)
    tempo_totale_minuti: float = Field(..., example=120.5)
    sessioni_completate_totali: int = Field(..., example=10)
    ultimo_allenamento: Optional[datetime] = None
    attivita_settimanale: List[GraficoSettimanaleItem]

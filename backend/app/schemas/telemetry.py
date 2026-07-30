from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class TelemetriaSguardoCreate(BaseModel):
    precisione_fissazione_pct: float = Field(..., ge=0.0, le=100.0, example=88.5, description="Percentuale di tempo in cui lo sguardo è rimasto dentro il target")
    frequenza_lampeggio_pm: Optional[float] = Field(None, ge=0.0, example=14.0, description="Frequenza di ammiccamento al minuto")
    distanza_schermo_cm_media: Optional[float] = Field(None, example=45.0, description="Distanza media dal monitor registrata dalla camera")
    saccadi_perse_count: int = Field(0, ge=0, example=2, description="Numero di volte in cui il tracciamento ha perso il bersaglio")
    avvisi_postura_count: int = Field(0, ge=0, example=1, description="Numero di avvisi per distanza troppo ravvicinata allo schermo")


class TelemetriaSguardoResponse(TelemetriaSguardoCreate):
    id_telemetria: int
    id_sessione: int
    data_registrazione: datetime

    model_config = {"from_attributes": True}

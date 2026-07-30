from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class CalibrationCreate(BaseModel):
    device_info: str = Field(..., example="Chrome / macOS / 1920x1080")
    larghezza_schermo_px: int = Field(..., gt=0, example=1920)
    altezza_schermo_px: int = Field(..., gt=0, example=1080)
    distanza_media_cm: Optional[float] = Field(None, example=50.0)
    punti_calibrazione_count: int = Field(9, example=9)
    qualita_calibrazione_pct: float = Field(..., ge=0.0, le=100.0, example=92.5)
    parametri_matrice: Optional[Dict[str, Any]] = None


class CalibrationResponse(CalibrationCreate):
    id_calibrazione: int
    id_utente: int
    data_calibrazione: datetime

    model_config = {"from_attributes": True}

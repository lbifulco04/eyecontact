from typing import Optional
from pydantic import BaseModel, Field


class UserPreferencesBase(BaseModel):
    obiettivo_giornaliero_minuti: int = Field(10, ge=1, le=60, example=10)
    abilita_regola_20_20_20: bool = Field(True, example=True, description="Attiva promemoria pausa ogni 20 minuti di schermo")
    feedback_audio_tracciamento: bool = Field(True, example=True, description="Segnale acustico se lo sguardo esce dal bersaglio")
    sensibilita_tracciamento: str = Field("media", example="media", description="bassa, media, alta")
    tema_interfaccia: str = Field("dark", example="dark", description="dark, light, high_contrast")


class UserPreferencesUpdate(BaseModel):
    obiettivo_giornaliero_minuti: Optional[int] = Field(None, ge=1, le=60)
    abilita_regola_20_20_20: Optional[bool] = None
    feedback_audio_tracciamento: Optional[bool] = None
    sensibilita_tracciamento: Optional[str] = None
    tema_interfaccia: Optional[str] = None


class UserPreferencesResponse(UserPreferencesBase):
    id_utente: int

    model_config = {"from_attributes": True}

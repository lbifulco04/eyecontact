from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship


class EsercizioInSessione(SQLModel, table=True):
    __tablename__ = "esercizio_in_sessione"

    id_dettaglio: Optional[int] = Field(default=None, primary_key=True)
    id_sessione: int = Field(foreign_key="sessione.id_sessione", ondelete="CASCADE")
    id_esercizio: int = Field(foreign_key="esercizio.id_esercizio", ondelete="RESTRICT")

    tempo_target_sec: int
    tempo_effettivo_sec: int
    completato: bool = Field(default=False)

    sessione: Optional["Sessione"] = Relationship(back_populates="dettagli_esercizi")
    esercizio: Optional["Esercizio"] = Relationship(back_populates="dettagli_sessioni")


# 2. ENTITÀ UTENTE
class Utente(SQLModel, table=True):
    __tablename__ = "utente"

    id_utente: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True, nullable=False)
    password_hash: str = Field(nullable=False)
    nome_display: Optional[str] = None
    data_registrazione: datetime = Field(default_factory=datetime.utcnow)
    ultimo_accesso: Optional[datetime] = None

    metriche: Optional["MetricheUtente"] = Relationship(
        back_populates="utente",
        sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"}
    )
    sessioni: List["Sessione"] = Relationship(back_populates="utente")


# 3. ENTITÀ METRICHE UTENTE
class MetricheUtente(SQLModel, table=True):
    __tablename__ = "metriche_utente"

    id_metrica: Optional[int] = Field(default=None, primary_key=True)
    id_utente: int = Field(foreign_key="utente.id_utente", unique=True, ondelete="CASCADE")

    giorni_consecutivi_streak: int = Field(default=0)
    tempo_totale_allenamento_sec: int = Field(default=0)
    sessioni_completate_totali: int = Field(default=0)
    ultimo_calcolo_timestamp: datetime = Field(default_factory=datetime.utcnow)

    utente: Optional[Utente] = Relationship(back_populates="metriche")


# 4. ENTITÀ ESERCIZIO (Catalogo)
class Esercizio(SQLModel, table=True):
    __tablename__ = "esercizio"

    id_esercizio: Optional[int] = Field(default=None, primary_key=True)
    nome: str = Field(nullable=False)
    descrizione: Optional[str] = None
    durata_consigliata_sec: int
    categoria: Optional[str] = None
    codice: str = Field(unique=True, index=True)
    dettagli_sessioni: List[EsercizioInSessione] = Relationship(back_populates="esercizio")


# 5. ENTITÀ SESSIONE
class Sessione(SQLModel, table=True):
    __tablename__ = "sessione"

    id_sessione: Optional[int] = Field(default=None, primary_key=True)
    id_utente: int = Field(foreign_key="utente.id_utente", ondelete="CASCADE")

    data_ora_inizio: datetime = Field(default_factory=datetime.utcnow)
    durata_totale_sec: int
    affaticamento_pre: Optional[int] = None
    affaticamento_post: Optional[int] = None
    delta_affaticamento: Optional[int] = None
    tasso_completamento_pct: Optional[float] = None
    note: Optional[str] = None

    utente: Optional[Utente] = Relationship(back_populates="sessioni")
    dettagli_esercizi: List[EsercizioInSessione] = Relationship(back_populates="sessione")
    telemetria: List["TelemetriaSguardo"] = Relationship(back_populates="sessione")


# 6. ENTITÀ TELEMETRIA SGUARDO (nuova - collega lo schema telemetry.py già presente,
#    finora privo di una rotta/tabella dedicata)
class TelemetriaSguardo(SQLModel, table=True):
    __tablename__ = "telemetria_sguardo"

    id_telemetria: Optional[int] = Field(default=None, primary_key=True)
    id_sessione: int = Field(foreign_key="sessione.id_sessione", ondelete="CASCADE")

    precisione_fissazione_pct: float
    frequenza_lampeggio_pm: Optional[float] = None
    distanza_schermo_cm_media: Optional[float] = None
    saccadi_perse_count: int = Field(default=0)
    avvisi_postura_count: int = Field(default=0)
    data_registrazione: datetime = Field(default_factory=datetime.utcnow)

    sessione: Optional[Sessione] = Relationship(back_populates="telemetria")

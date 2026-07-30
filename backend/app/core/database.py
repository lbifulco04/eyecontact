import time
from typing import Generator
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.exc import OperationalError
from app.core.config import settings
import models


connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

engine = create_engine(
    settings.DATABASE_URL, 
    echo=True,  
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args=connect_args
)

def init_db() -> None:
    """Crea le tabelle al primo avvio se non esistono, gestendo l'attesa dell'avvio di PostgreSQL in Docker."""
    max_retries = 10
    retry_interval = 2
    for attempt in range(1, max_retries + 1):
        try:
            print(f"Tentativo di connessione a PostgreSQL ({attempt}/{max_retries})...")
            SQLModel.metadata.create_all(engine)
            print("Connessione a PostgreSQL stabilita e tabelle create con successo.")
            break
        except OperationalError as e:
            if attempt == max_retries:
                print(f"Impossibile connettersi a PostgreSQL dopo {max_retries} tentativi: {e}")
                raise e
            print(f"PostgreSQL non ancora pronto. Nuovo tentativo tra {retry_interval} secondi...")
            time.sleep(retry_interval)

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
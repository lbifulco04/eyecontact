from typing import Generator
from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings
import models


engine = create_engine(
    settings.DATABASE_URL, 
    echo=True,  
    pool_pre_ping=True
)

def init_db() -> None:
    """Crea le tabelle al primo avvio se non esistono."""
    SQLModel.metadata.create_all(engine)

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
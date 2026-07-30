from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app.core.config import settings
from app.core.database import init_db, engine
from app.core.db_seed import seed_exercises
from app.api.routes import auth, sessions, exercises  # Importiamo il router delle rotte di autenticazione

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Inizializzazione Database...")
    init_db()
    with Session(engine) as session:
        seed_exercises(session)
    yield
    print("Shutdown completato.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Configurazione CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrazione dei Router API
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(sessions.router, prefix=settings.API_V1_STR)
app.include_router(exercises.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"status": "ok", "message": f"Welcome to {settings.PROJECT_NAME}"}
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_password_hash, verify_password, create_access_token
from models import Utente, MetricheUtente
from app.schemas.auth import Token, UserRegister
from app.api.deps import get_current_user


router = APIRouter(prefix="/auth", tags=["Autenticazione"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(
    user_in: UserRegister, 
    session: Session = Depends(get_session)
):

    statement = select(Utente).where(Utente.email == user_in.email)
    existing_user = session.exec(statement).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email già registrata nel sistema"
        )

    db_user = Utente(
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        nome_display=user_in.nome_display,
        data_registrazione=datetime.now(timezone.utc)
    )
    session.add(db_user)
    session.commit()
    session.refresh(db_user)

    
    metriche_iniziali = MetricheUtente(id_utente=db_user.id_utente)
    session.add(metriche_iniziali)
    session.commit()

    
    access_token = create_access_token(subject=db_user.id_utente)
    return Token(access_token=access_token, token_type="bearer")


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    
    statement = select(Utente).where(Utente.email == form_data.username)
    user = session.exec(statement).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email o password non corrette"
        )

    user.ultimo_accesso = datetime.now(timezone.utc)
    session.add(user)
    session.commit()

    access_token = create_access_token(subject=user.id_utente)
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me")
def read_current_user(
    current_user: Utente = Depends(get_current_user)
):
    return current_user
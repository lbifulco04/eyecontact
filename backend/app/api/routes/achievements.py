from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlmodel import Session as DBSession, select

from app.api.deps import get_current_user
from app.core.database import get_session
from models import Utente, MetricheUtente, Sessione
from app.schemas.achievements import AchievementsResponse, Badge

router = APIRouter(prefix="/achievements", tags=["Gamification e Badge"])


@router.get("/me", response_model=AchievementsResponse)
def ottieni_badge_utente(
    db: DBSession = Depends(get_session),
    utente_attuale: Utente = Depends(get_current_user)
):
    """
    Calcola e restituisce i badge/traguardi sbloccati dall'utente.
    """
    stmt = select(MetricheUtente).where(MetricheUtente.id_utente == utente_attuale.id_utente)
    metriche = db.exec(stmt).first()

    streak = metriche.giorni_consecutivi_streak if metriche else 0
    tempo_tot_min = (metriche.tempo_totale_allenamento_sec / 60.0) if metriche else 0.0
    sessioni_tot = metriche.sessioni_completate_totali if metriche else 0

    badges_list = [
        Badge(
            id_badge="primo_passo",
            titolo="Primo Sguardo",
            descrizione="Completa la tua prima sessione di allenamento oculare",
            icona_emoji="👁️",
            sbloccato=sessioni_tot >= 1,
            progresso_pct=min(100.0, (sessioni_tot / 1) * 100),
            data_sblocco=datetime.now(timezone.utc) if sessioni_tot >= 1 else None
        ),
        Badge(
            id_badge="streak_7_giorni",
            titolo="Occhio d'Aquila",
            descrizione="Mantieni uno streak di 7 giorni consecutivi di allenamento",
            icona_emoji="🦅",
            sbloccato=streak >= 7,
            progresso_pct=min(100.0, (streak / 7) * 100),
            data_sblocco=datetime.now(timezone.utc) if streak >= 7 else None
        ),
        Badge(
            id_badge="maratoneta_visivo",
            titolo="Maratoneta Visivo",
            descrizione="Accumula almeno 60 minuti totali di esercizi oculari",
            icona_emoji="⏱️",
            sbloccato=tempo_tot_min >= 60.0,
            progresso_pct=min(100.0, (tempo_tot_min / 60.0) * 100),
            data_sblocco=datetime.now(timezone.utc) if tempo_tot_min >= 60.0 else None
        ),
        Badge(
            id_badge="veterano_10_sessioni",
            titolo="Focus di Ferro",
            descrizione="Completa un totale di 10 sessioni di allenamento",
            icona_emoji="🎯",
            sbloccato=sessioni_tot >= 10,
            progresso_pct=min(100.0, (sessioni_tot / 10) * 100),
            data_sblocco=datetime.now(timezone.utc) if sessioni_tot >= 10 else None
        )
    ]

    sbloccati_count = sum(1 for b in badges_list if b.sbloccato)

    return AchievementsResponse(
        totale_badge_sbloccati=sbloccati_count,
        totale_badge=len(badges_list),
        badge=badges_list
    )

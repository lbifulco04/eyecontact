from datetime import date, timedelta, datetime, time
from typing import List
from fastapi import APIRouter, Depends
from sqlmodel import Session as DBSession, select

from app.api.deps import get_current_user
from app.core.database import get_session
from models import Utente, MetricheUtente, Sessione
from app.schemas.metrics import DashboardResponse, GraficoSettimanaleItem

router = APIRouter(prefix="/metrics", tags=["Metriche Utente"])

GIORNI_MAP = {
    0: "Lun",
    1: "Mar",
    2: "Mer",
    3: "Gio",
    4: "Ven",
    5: "Sab",
    6: "Dom"
}


@router.get("/dashboard", response_model=DashboardResponse)
def ottieni_metriche_dashboard(
    db: DBSession = Depends(get_session),
    utente_attuale: Utente = Depends(get_current_user)
):
    """
    Restituisce le metriche dell'utente loggato per la Dashboard Frontend:
    - Streak giorni consecutivi
    - Tempo totale allenamento (minuti)
    - Totale sessioni completate
    - Data/ora dell'ultimo allenamento
    - Attività degli ultimi 7 giorni (per il grafico)
    """
    # 1. Recupero riga MetricheUtente
    stmt = select(MetricheUtente).where(MetricheUtente.id_utente == utente_attuale.id_utente)
    metriche = db.exec(stmt).first()

    if not metriche:
        giorni_streak = 0
        tempo_totale_sec = 0
        sessioni_totali = 0
    else:
        giorni_streak = metriche.giorni_consecutivi_streak
        tempo_totale_sec = metriche.tempo_totale_allenamento_sec
        sessioni_totali = metriche.sessioni_completate_totali

    # 2. Recupero dell'ultimo allenamento
    stmt_ultima = (
        select(Sessione)
        .where(Sessione.id_utente == utente_attuale.id_utente)
        .order_by(Sessione.data_ora_inizio.desc())
    )
    ultima_sessione = db.exec(stmt_ultima).first()
    ultimo_allenamento = ultima_sessione.data_ora_inizio if ultima_sessione else None

    # 3. Calcolo attività degli ultimi 7 giorni per il grafico frontend
    oggi = date.today()
    sette_giorni_fa = oggi - timedelta(days=6)
    inizio_periodo = datetime.combine(sette_giorni_fa, time.min)

    stmt_sessioni = (
        select(Sessione)
        .where(
            Sessione.id_utente == utente_attuale.id_utente,
            Sessione.data_ora_inizio >= inizio_periodo
        )
    )
    sessioni_recenti = db.exec(stmt_sessioni).all()

    # Mappa dei 7 giorni con minuti accumulati
    minuti_per_giorno = {
        (sette_giorni_fa + timedelta(days=i)).isoformat(): 0.0
        for i in range(7)
    }

    for s in sessioni_recenti:
        data_str = s.data_ora_inizio.date().isoformat()
        if data_str in minuti_per_giorno:
            minuti_per_giorno[data_str] += round(s.durata_totale_sec / 60.0, 1)

    attivita_settimanale: List[GraficoSettimanaleItem] = []
    for i in range(7):
        d = sette_giorni_fa + timedelta(days=i)
        data_iso = d.isoformat()
        giorno_lbl = GIORNI_MAP[d.weekday()]
        minuti = minuti_per_giorno.get(data_iso, 0.0)
        attivita_settimanale.append(
            GraficoSettimanaleItem(
                data=data_iso,
                giorno_settimana=giorno_lbl,
                minuti=round(minuti, 1)
            )
        )

    return DashboardResponse(
        streak_giorni=giorni_streak,
        tempo_totale_minuti=round(tempo_totale_sec / 60.0, 1),
        sessioni_completate_totali=sessioni_totali,
        ultimo_allenamento=ultimo_allenamento,
        attivita_settimanale=attivita_settimanale
    )

from datetime import datetime, date, timezone
from sqlmodel import Session as DBSession, select
from models import MetricheUtente, Sessione


def calcola_e_aggiorna_metriche_utente(
    db: DBSession, 
    id_utente: int, 
    durata_nuova_sessione_sec: int
) -> MetricheUtente:
    # 1. Recupera o crea la riga delle metriche
    statement = select(MetricheUtente).where(MetricheUtente.id_utente == id_utente)
    metriche = db.exec(statement).first()

    if not metriche:
        metriche = MetricheUtente(id_utente=id_utente)
        db.add(metriche)
        db.flush()

    # 2. Recupera le sessioni dell'utente ordinate per data decrescente
    stmt_sessioni = (
        select(Sessione)
        .where(Sessione.id_utente == id_utente)
        .order_by(Sessione.data_ora_inizio.desc())
    )
    sessioni = db.exec(stmt_sessioni).all()

    if not sessioni or len(sessioni) <= 1:
        # Prima sessione per l'utente
        metriche.giorni_consecutivi_streak = max(metriche.giorni_consecutivi_streak, 1)
    else:
        # Se la nuova sessione è già stata salvata, sessioni[0] è la nuova sessione e sessioni[1] è la penultima
        data_attuale = sessioni[0].data_ora_inizio.date()
        data_precedente = sessioni[1].data_ora_inizio.date()
        differenza_giorni = (data_attuale - data_precedente).days

        if differenza_giorni == 1:
            metriche.giorni_consecutivi_streak += 1
        elif differenza_giorni > 1:
            metriche.giorni_consecutivi_streak = 1
        elif differenza_giorni == 0:
            if metriche.giorni_consecutivi_streak == 0:
                metriche.giorni_consecutivi_streak = 1

    # 3. Aggiorna i totali
    metriche.sessioni_completate_totali += 1
    metriche.tempo_totale_allenamento_sec += durata_nuova_sessione_sec
    metriche.ultimo_calcolo_timestamp = datetime.now(timezone.utc)

    db.add(metriche)
    db.commit()
    db.refresh(metriche)

    return metriche
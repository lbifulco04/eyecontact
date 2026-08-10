from sqlmodel import Session, select
from models import Esercizio

PREDEFINED_EXERCISES = [
    {
        "codice": "fissazione_punto_fisso",
        "nome": "Fissazione Punto Fisso",
        "descrizione": "Mantieni lo sguardo fisso al centro dello schermo.",
        "durata_consigliata_sec": 60,
        "categoria": "Fissazione"
    },
    {
        "codice": "inseguimento_saccadico",
        "nome": "Inseguimento Saccadico",
        "descrizione": "Segui il punto rosso che si sposta a scatti.",
        "durata_consigliata_sec": 120,
        "categoria": "Saccadi"
    },
    {
        "codice": "inseguimento_lento",
        "nome": "Inseguimento Lento (Smooth Pursuit)",
        "descrizione": "Segui il bersaglio in movimento fluido e continuo.",
        "durata_consigliata_sec": 90,
        "categoria": "Inseguimento"
    },
    {
        "codice":"inseguimento_medio",
        "nome":"Inseguimento Medio (Medium Pursuit)",
        "descrizione": "Segui il bersaglio in movimento medio",
        "durata_consigliata_sec":45,
        "categoria": "Inseguimento"
    }

]

def seed_exercises(db: Session):
    print("Sincronizzazione catalogo esercizi...")
    
    for ex_data in PREDEFINED_EXERCISES:
        statement = select(Esercizio).where(Esercizio.codice == ex_data["codice"])
        esercizio_esistente = db.exec(statement).first()
        
        if esercizio_esistente:
            for key, value in ex_data.items():
                setattr(esercizio_esistente, key, value)
        else:
    
            nuovo_esercizio = Esercizio(**ex_data)
            db.add(nuovo_esercizio)
            
    db.commit()
    print("Catalogo esercizi aggiornato con successo!")

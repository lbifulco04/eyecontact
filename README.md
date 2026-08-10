# EyeContact 👁️✨

**EyeContact** è una piattaforma web per il tracciamento oculare (*eye-tracking*) e la riabilitazione visiva basata su Computer Vision. Il sistema consente di eseguire esercizi oculari interattivi direttamente dal browser tramite webcam, analizzando i movimenti oculari in tempo reale e salvando i dati delle sessioni per monitorare i progressi terapeutici.

---

## 🏗️ Architettura del Sistema

L'applicazione segue un'architettura **Full-Stack Containerizzata**, progettata per garantire alte prestazioni nell'elaborazione del flusso video e persistenza sicura dei dati clinici:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         DOCKER COMPOSE NETWORK                          │
│                                                                         │
│  ┌────────────────────┐   ┌───────────────────┐   ┌──────────────────┐  │
│  │   Frontend Web     │   │   Backend API     │   │   Database       │  │
│  │  (React + Vite)    │──>│    (FastAPI)      │──>│  (PostgreSQL)    │  │
│  │  MediaPipe / Vision│   │   SQLModel / JWT  │   │  Volume Persist. │  │
│  │   [Porta 3000]     │   │    [Porta 8000]   │   │   [Porta 5432]   │  │
│  └────────────────────┘   └───────────────────┘   └──────────────────┘  │
│                                                             ▲           │
│                           ┌──────────────────┐              │           │
│                           │  Gestione DB     │              │           │
│                           │   (pgAdmin 4)    │──────────────┘           │
│                           │   [Porta 5050]   │                          │
│                           └──────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────┘
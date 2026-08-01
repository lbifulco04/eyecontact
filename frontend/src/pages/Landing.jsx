import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import GazeTarget from "../components/GazeTarget.jsx";

const steps = [
  {
    n: "01",
    title: "Calibra",
    text: "Nove punti, trenta secondi: il sistema impara la geometria del tuo sguardo rispetto allo schermo.",
  },
  {
    n: "02",
    title: "Allenati",
    text: "Fissazione, saccadi, inseguimento lento: esercizi guidati con feedback in tempo reale via webcam.",
  },
  {
    n: "03",
    title: "Monitora",
    text: "Streak, minuti totali, tasso di completamento: la dashboard racconta i tuoi progressi settimana per settimana.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-lilac-500 shadow-glow" />
          <span className="font-display text-lg font-semibold">EyeContact</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost !px-5 !py-2.5 text-sm">
            Accedi
          </Link>
          <Link to="/registrati" className="btn-primary !px-5 !py-2.5 text-sm">
            Inizia ora
          </Link>
        </div>
      </header>

      {/* HERO: il punto di fissazione è il vero protagonista, non un'illustrazione a corredo */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="eyebrow">Riabilitazione visiva via webcam</span>
          <h1 className="font-display text-5xl md:text-6xl font-semibold leading-[1.05] mt-4">
            Allena i tuoi occhi<br />
            <span className="text-lilac-600">a seguire, non a scattare.</span>
          </h1>
          <p className="text-ink-500 text-lg mt-6 max-w-md">
            EyeContact traccia lo sguardo in tempo reale dalla tua webcam e ti guida
            attraverso esercizi clinici di fissazione, saccadi e inseguimento —
            senza hardware dedicato.
          </p>
          <div className="flex items-center gap-4 mt-8">
            <Link to="/registrati" className="btn-primary">
              Crea il tuo profilo
            </Link>
            <Link to="/login" className="btn-ghost">
              Ho già un account
            </Link>
          </div>
        </div>

        <div className="relative h-80 md:h-96 glass-panel overflow-hidden">
          <motion.div
            className="absolute"
            animate={{
              left: ["18%", "72%", "40%", "60%", "18%"],
              top: ["24%", "60%", "70%", "20%", "24%"],
            }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          >
            <GazeTarget size={72} />
          </motion.div>
          <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between font-mono text-xs text-ink-300">
            <span>fissazione_target.live</span>
            <span className="text-sea-500">● tracciamento attivo</span>
          </div>
        </div>
      </section>

      {/* Struttura numerata: qui è legittima, è il reale flusso a 3 step dell'app */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-lilac-200">
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.n}>
              <span className="font-mono text-sm text-lilac-500">{s.n}</span>
              <h3 className="font-display text-2xl font-semibold mt-3">{s.title}</h3>
              <p className="text-ink-500 mt-2">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-10 border-t border-lilac-200 text-sm text-ink-300">
        EyeContact — piattaforma di allenamento visivo con eye-tracking via webcam.
      </footer>
    </div>
  );
}

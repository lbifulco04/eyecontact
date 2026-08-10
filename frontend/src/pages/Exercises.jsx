import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AppShell from '../components/layout/AppShell.jsx'
import { listaEsercizi, eserciziRaccomandati } from '../lib/api/exercises.js'

const CATEGORIA_COLOR = {
  Fissazione: 'text-iris border-iris/30 bg-iris/10',
  Saccadi: 'text-amber border-amber/30 bg-amber/10',
  Inseguimento: 'text-okgreen border-okgreen/30 bg-okgreen/10'
}

export default function Exercises() {
  const navigate = useNavigate()
  const [affaticamento, setAffaticamento] = useState(5)
  const [esercizi, setEsercizi] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    eserciziRaccomandati(affaticamento)
      .then(setEsercizi)
      .catch(() => listaEsercizi().then(setEsercizi))
      .finally(() => setLoading(false))
  }, [affaticamento])

  return (
    <AppShell>
      <h1 className="font-display text-2xl md:text-3xl font-semibold mb-2">Catalogo esercizi</h1>
      <p className="text-mist-muted mb-6">
        Dichiara il tuo affaticamento visivo attuale per ricevere esercizi mirati.
      </p>

      <div className="rounded-2xl border border-ink-border bg-ink-panel/70 shadow-card p-5 mb-8 max-w-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-mist-muted">Affaticamento visivo</span>
          <span className="data-num text-iris font-semibold">{affaticamento}/10</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={affaticamento}
          onChange={(e) => setAffaticamento(Number(e.target.value))}
          className="w-full accent-iris"
        />
        <div className="flex justify-between text-xs text-mist-muted mt-1">
          <span>Riposato</span>
          <span>Molto affaticato</span>
        </div>
      </div>

      {loading ? (
        <div className="text-mist-muted">Caricamento esercizi…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {esercizi.map((ex, i) => (
            <motion.div
              key={ex.id_esercizio}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-ink-border bg-ink-panel/70 shadow-card p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold">{ex.nome}</h3>
                {ex.categoria && (
                  <span
                    className={`text-xs px-2 py-1 rounded-full border ${
                      CATEGORIA_COLOR[ex.categoria] || 'text-mist-muted border-ink-border'
                    }`}
                  >
                    {ex.categoria}
                  </span>
                )}
              </div>
              <p className="text-sm text-mist-muted flex-1">{ex.descrizione}</p>
              <div className="flex items-center justify-between">
                <span className="data-num text-sm text-mist-muted">
                  {ex.durata_consigliata_sec}s consigliati
                </span>
                <button
                  onClick={() => navigate(`/esercizi/${ex.id_esercizio}/sessione`)}
                  className="text-sm font-semibold bg-iris/15 text-iris rounded-lg px-3 py-1.5 hover:bg-iris/25 transition"
                >
                  Avvia
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </AppShell>
  )
}

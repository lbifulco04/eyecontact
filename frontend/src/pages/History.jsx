import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import AppShell from '../components/layout/AppShell.jsx'
import { mieSessioni } from '../lib/api/sessions.js'

export default function History() {
  const [sessioni, setSessioni] = useState(null)

  useEffect(() => {
    mieSessioni().then(setSessioni)
  }, [])

  return (
    <AppShell>
      <h1 className="font-display text-2xl md:text-3xl font-semibold mb-6">Storico sessioni</h1>

      {!sessioni ? (
        <div className="text-mist-muted">Caricamento…</div>
      ) : sessioni.length === 0 ? (
        <div className="text-mist-muted">Non hai ancora completato nessuna sessione.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessioni.map((s, i) => (
            <motion.div
              key={s.id_sessione}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-2xl border border-ink-border bg-ink-panel/70 shadow-card p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">
                  {new Date(s.data_ora_inizio).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                <p className="text-sm text-mist-muted mt-1">{s.note || 'Sessione di allenamento'}</p>
              </div>
              <div className="flex items-center gap-6 text-right">
                <div>
                  <p className="data-num text-lg">{Math.round(s.durata_totale_sec / 60)} min</p>
                  <p className="text-xs text-mist-muted">durata</p>
                </div>
                {s.tasso_completamento_pct !== null && (
                  <div>
                    <p className="data-num text-lg text-iris">{s.tasso_completamento_pct}%</p>
                    <p className="text-xs text-mist-muted">completato</p>
                  </div>
                )}
                {s.delta_affaticamento !== null && s.delta_affaticamento !== undefined && (
                  <div>
                    <p
                      className={`data-num text-lg ${
                        s.delta_affaticamento < 0 ? 'text-okgreen' : 'text-amber'
                      }`}
                    >
                      {s.delta_affaticamento > 0 ? '+' : ''}
                      {s.delta_affaticamento}
                    </p>
                    <p className="text-xs text-mist-muted">affaticamento</p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </AppShell>
  )
}

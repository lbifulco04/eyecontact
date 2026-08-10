import React from 'react'
import { motion } from 'framer-motion'

export default function BadgeCard({ badge }) {
  const { titolo, descrizione, icona_emoji, sbloccato, progresso_pct } = badge
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 flex flex-col gap-3 shadow-card ${
        sbloccato ? 'border-iris/40 bg-iris/5' : 'border-ink-border bg-ink-panel/70'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-3xl ${sbloccato ? '' : 'grayscale opacity-40'}`}>{icona_emoji}</span>
        {sbloccato && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-okgreen/15 text-okgreen">
            Sbloccato
          </span>
        )}
      </div>
      <div>
        <h3 className="font-display font-semibold text-base">{titolo}</h3>
        <p className="text-sm text-mist-muted mt-1">{descrizione}</p>
      </div>
      <div className="h-1.5 rounded-full bg-ink-border overflow-hidden">
        <div
          className={`h-full rounded-full ${sbloccato ? 'bg-okgreen' : 'bg-iris'}`}
          style={{ width: `${progresso_pct}%` }}
        />
      </div>
      <span className="text-xs text-mist-muted data-num">{progresso_pct.toFixed(0)}%</span>
    </motion.div>
  )
}

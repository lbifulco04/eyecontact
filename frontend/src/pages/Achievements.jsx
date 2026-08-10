import React, { useEffect, useState } from 'react'
import AppShell from '../components/layout/AppShell.jsx'
import BadgeCard from '../components/BadgeCard.jsx'
import { achievementsUtente } from '../lib/api/achievements.js'

export default function Achievements() {
  const [data, setData] = useState(null)

  useEffect(() => {
    achievementsUtente().then(setData)
  }, [])

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Traguardi</h1>
          <p className="text-mist-muted mt-1">Ogni sessione costante ti avvicina al prossimo badge</p>
        </div>
        {data && (
          <span className="data-num text-lg text-iris">
            {data.totale_badge_sbloccati}/{data.totale_badge}
          </span>
        )}
      </div>

      {!data ? (
        <div className="text-mist-muted">Caricamento traguardi…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.badge.map((b) => (
            <BadgeCard key={b.id_badge} badge={b} />
          ))}
        </div>
      )}
    </AppShell>
  )
}

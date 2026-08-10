import React, { useEffect, useState } from 'react'
import { Flame, Clock, Trophy, CalendarClock } from 'lucide-react'
import AppShell from '../components/layout/AppShell.jsx'
import StatCard from '../components/StatCard.jsx'
import WeeklyChart from '../components/WeeklyChart.jsx'
import GazeReticle from '../components/GazeReticle.jsx'
import { dashboardMetriche } from '../lib/api/metrics.js'
import { useAuth } from '../context/AuthContext.jsx'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const { user } = useAuth()
  const [metriche, setMetriche] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardMetriche()
      .then(setMetriche)
      .finally(() => setLoading(false))
  }, [])

  const ultimoAllenamento = metriche?.ultimo_allenamento
    ? new Date(metriche.ultimo_allenamento).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Nessuno ancora'

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">
            Bentornato, {user?.nome_display || 'atleta visivo'}
          </h1>
          <p className="text-mist-muted mt-1">Ecco il tuo stato di allenamento oculare</p>
        </div>
        <div className="hidden md:block">
          <GazeReticle mode="idle" size={56} />
        </div>
      </div>

      {loading ? (
        <div className="text-mist-muted">Caricamento metriche…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={Flame} label="Streak" value={metriche.streak_giorni} suffix="giorni" accent="amber" />
            <StatCard
              icon={Clock}
              label="Tempo totale"
              value={metriche.tempo_totale_minuti}
              suffix="min"
            />
            <StatCard
              icon={Trophy}
              label="Sessioni completate"
              value={metriche.sessioni_completate_totali}
              accent="green"
            />
            <StatCard icon={CalendarClock} label="Ultimo allenamento" value={ultimoAllenamento} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <WeeklyChart data={metriche.attivita_settimanale} />
            </div>
            <div className="rounded-2xl border border-ink-border bg-gradient-to-br from-iris/10 to-transparent shadow-card p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-display font-semibold text-lg">Pronto per un esercizio?</h3>
                <p className="text-mist-muted text-sm mt-2">
                  Il tracciamento oculare live misura fissazione, saccadi e postura in tempo reale.
                </p>
              </div>
              <Link
                to="/esercizi"
                className="mt-6 inline-flex items-center justify-center bg-iris text-ink font-semibold rounded-xl py-2.5 hover:brightness-110 transition"
              >
                Inizia allenamento
              </Link>
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}

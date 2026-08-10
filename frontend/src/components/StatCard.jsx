import React from 'react'

export default function StatCard({ icon: Icon, label, value, suffix, accent = 'iris' }) {
  const accentColor = accent === 'amber' ? 'text-amber' : accent === 'green' ? 'text-okgreen' : 'text-iris'
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-panel/70 shadow-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-mist-muted">{label}</span>
        {Icon && <Icon size={18} className={accentColor} />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="data-num text-3xl font-semibold">{value}</span>
        {suffix && <span className="text-sm text-mist-muted">{suffix}</span>}
      </div>
    </div>
  )
}

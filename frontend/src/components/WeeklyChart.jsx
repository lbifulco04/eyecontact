import React from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function WeeklyChart({ data }) {
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-panel/70 shadow-card p-5">
      <h3 className="font-display font-semibold mb-4">Attività ultimi 7 giorni</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gazeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4CC9F0" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#4CC9F0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#262F47" vertical={false} />
          <XAxis dataKey="giorno_settimana" stroke="#8B93AC" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#8B93AC" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: '#121826', border: '1px solid #262F47', borderRadius: 12 }}
            labelStyle={{ color: '#EDEFF7' }}
            formatter={(value) => [`${value} min`, 'Allenamento']}
          />
          <Area type="monotone" dataKey="minuti" stroke="#4CC9F0" strokeWidth={2} fill="url(#gazeGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

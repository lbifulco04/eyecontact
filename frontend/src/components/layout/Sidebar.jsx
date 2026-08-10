import React from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Eye, Target, Award, History, LogOut, ScanEye } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/esercizi', label: 'Esercizi', icon: Eye },
  { to: '/calibrazione', label: 'Calibrazione', icon: Target },
  { to: '/achievements', label: 'Traguardi', icon: Award },
  { to: '/storico', label: 'Storico', icon: History }
]

export default function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="w-[76px] md:w-64 shrink-0 h-screen sticky top-0 border-r border-ink-border bg-ink-panel/60 backdrop-blur flex flex-col">
      <div className="flex items-center gap-3 px-4 md:px-5 h-20 border-b border-ink-border">
        <ScanEye className="text-iris shrink-0" size={28} />
        <span className="hidden md:block font-display font-semibold text-lg tracking-tight">
          Eye<span className="text-iris">Contact</span>
        </span>
      </div>

      <nav className="flex-1 py-6 flex flex-col gap-1 px-2 md:px-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                isActive
                  ? 'bg-iris/10 text-iris shadow-glow'
                  : 'text-mist-muted hover:text-mist hover:bg-white/5'
              }`
            }
          >
            <Icon size={20} className="shrink-0" />
            <span className="hidden md:block text-sm font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-ink-border">
        <div className="hidden md:flex flex-col px-2 py-2 mb-1">
          <span className="text-sm font-medium truncate">{user?.nome_display || user?.email}</span>
          <span className="text-xs text-mist-muted truncate">{user?.email}</span>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-mist-muted hover:text-alert hover:bg-alert/10 transition-colors"
        >
          <LogOut size={20} />
          <span className="hidden md:block text-sm font-medium">Esci</span>
        </button>
      </div>
    </aside>
  )
}

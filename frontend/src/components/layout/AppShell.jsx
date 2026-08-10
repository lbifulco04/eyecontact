import React from 'react'
import Sidebar from './Sidebar.jsx'

export default function AppShell({ children }) {
  return (
    <div className="flex min-h-screen bg-ink text-mist font-body">
      <Sidebar />
      <main className="flex-1 min-w-0 px-5 md:px-10 py-8">{children}</main>
    </div>
  )
}

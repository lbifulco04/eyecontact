import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/esercizi", label: "Esercizi" },
  { to: "/traguardi", label: "Traguardi" },
  { to: "/calibrazione", label: "Calibrazione" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-lilac-200 bg-paper-50/85 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-lilac-500 shadow-glow" />
          <span className="font-display text-lg font-semibold tracking-tight">EyeContact</span>
        </div>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `px-4 py-2 rounded-full text-sm font-medium transition ${
                  isActive
                    ? "bg-lilac-500/10 text-lilac-600"
                    : "text-ink-500 hover:text-ink-900"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-ink-500 font-mono">
            {user.nome_display || user.email}
          </span>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="btn-ghost !px-4 !py-2 text-sm"
          >
            Esci
          </button>
        </div>
      </div>
      <nav className="md:hidden flex overflow-x-auto gap-1 px-4 pb-3">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
                isActive ? "bg-lilac-500/10 text-lilac-600" : "text-ink-500"
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

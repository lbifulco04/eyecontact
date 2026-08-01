import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
      <span className="font-mono text-sea-500">404</span>
      <h1 className="font-display text-2xl font-semibold">Pagina non trovata</h1>
      <Link to="/" className="btn-primary">
        Torna alla home
      </Link>
    </div>
  );
}

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-sea-500 animate-ping" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

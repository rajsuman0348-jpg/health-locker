import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import Layout from "./Layout";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-inkmuted">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  return <Layout>{children}</Layout>;
}

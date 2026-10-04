import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setToken, hasToken } from "../lib/api";
import { AuthUser, Role } from "../lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    fullName: string;
    role: Role;
    specialization?: string;
    hospital?: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    if (!hasToken()) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<any>("/auth/me");
      setUser({ id: me.id, email: me.email, fullName: me.fullName, role: me.role });
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ token: string; user: AuthUser }>("/auth/login", { email, password });
    setToken(res.token);
    setUser(res.user);
  }

  async function register(data: {
    email: string;
    password: string;
    fullName: string;
    role: Role;
    specialization?: string;
    hospital?: string;
  }) {
    const res = await api.post<{ token: string; user: AuthUser }>("/auth/register", data);
    setToken(res.token);
    setUser(res.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

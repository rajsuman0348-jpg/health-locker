import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderLock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { ErrorBanner } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2 justify-center">
          <FolderLock size={26} className="text-locker-500" strokeWidth={2.25} />
          <span className="font-serif text-xl font-semibold text-ink">Health Locker</span>
        </div>
        <div className="card">
          <h1 className="font-serif text-lg font-semibold text-ink mb-1">Welcome back</h1>
          <p className="text-sm text-inkmuted mb-5">Sign in to your health record.</p>
          <ErrorBanner message={error} />
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="btn-primary w-full" disabled={busy} type="submit">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
        <p className="mt-5 text-center text-sm text-inkmuted">
          New here?{" "}
          <Link to="/register" className="text-locker-600 font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

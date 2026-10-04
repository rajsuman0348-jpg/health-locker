import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderLock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { ErrorBanner } from "../components/ui";
import { Role } from "../lib/types";

const roles: { value: Role; label: string; hint: string }[] = [
  { value: "patient", label: "Patient", hint: "Manage your own health record" },
  { value: "doctor", label: "Doctor", hint: "Treat and prescribe for your patients" },
  { value: "guardian", label: "Guardian", hint: "Support a family member's care" },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("patient");
  const [specialization, setSpecialization] = useState("");
  const [hospital, setHospital] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register({ email, password, fullName, role, specialization, hospital });
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2 justify-center">
          <FolderLock size={26} className="text-locker-500" strokeWidth={2.25} />
          <span className="font-serif text-xl font-semibold text-ink">Health Locker</span>
        </div>
        <div className="card">
          <h1 className="font-serif text-lg font-semibold text-ink mb-1">Create your account</h1>
          <p className="text-sm text-inkmuted mb-5">Your health record, organized and shared on your terms.</p>
          <ErrorBanner message={error} />
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">I am a…</label>
              <div className="grid grid-cols-3 gap-2">
                {roles.map((r) => (
                  <button
                    type="button"
                    key={r.value}
                    onClick={() => setRole(r.value)}
                    className={`rounded-md border px-2 py-2 text-sm font-medium transition-colors ${
                      role === r.value
                        ? "border-locker-500 bg-locker-50 text-locker-700"
                        : "border-line bg-white text-inkmuted hover:bg-panel"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-inkmuted">{roles.find((r) => r.value === role)?.hint}</p>
            </div>
            <div>
              <label className="label">Full name</label>
              <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {role === "doctor" && (
              <>
                <div>
                  <label className="label">Specialization</label>
                  <input className="input" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
                </div>
                <div>
                  <label className="label">Hospital / clinic</label>
                  <input className="input" value={hospital} onChange={(e) => setHospital(e.target.value)} />
                </div>
              </>
            )}
            <button className="btn-primary w-full" disabled={busy} type="submit">
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>
        <p className="mt-5 text-center text-sm text-inkmuted">
          Already have an account?{" "}
          <Link to="/login" className="text-locker-600 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

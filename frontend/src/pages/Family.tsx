import { FormEvent, useEffect, useState } from "react";
import { UserMinus, Stethoscope } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHeader, EmptyState, Pill, ErrorBanner } from "../components/ui";
import { ConsentResource, GuardianLink } from "../lib/types";

const RESOURCES: { key: ConsentResource; label: string }[] = [
  { key: "medicines", label: "Medicines" },
  { key: "appointments", label: "Appointments" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "reports", label: "Reports" },
  { key: "notes", label: "Private notes" },
];

interface ConsentOverview {
  guardians: (GuardianLink & { type: "guardian" })[];
  doctors: {
    type: "doctor";
    doctor: { id: string; full_name: string; email: string };
    profile: { specialization: string | null; hospital: string | null };
    permissions: Record<ConsentResource, boolean>;
  }[];
}

export default function Family() {
  const { user } = useAuth();
  const [guardians, setGuardians] = useState<GuardianLink[]>([]);
  const [consent, setConsent] = useState<ConsentOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!user) return;
    const [g, c] = await Promise.all([
      api.get<GuardianLink[]>(`/patients/${user.id}/guardians`),
      api.get<ConsentOverview>(`/patients/${user.id}/consent`),
    ]);
    setGuardians(g);
    setConsent(c);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function updatePermission(guardianId: string, resource: ConsentResource, value: boolean, current: GuardianLink) {
    const permissions = { ...current.permissions, [resource]: value };
    await api.put(`/patients/${user!.id}/guardians/${guardianId}/permissions`, { permissions });
    refresh();
  }

  async function revoke(guardianId: string) {
    await api.del(`/patients/${user!.id}/guardians/${guardianId}`);
    refresh();
  }

  return (
    <div>
      <PageHeader title="Family & Access" subtitle="Invite guardians and control exactly what they can see." />
      <ErrorBanner message={error} />

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-ink mb-3">Guardians</h2>
        <div className="grid md:grid-cols-[1fr_300px] gap-6">
          <div className="space-y-3">
            {guardians.filter((g) => g.status !== "revoked").length === 0 ? (
              <EmptyState title="No guardians connected yet" hint="Invite a family member from the form on the right." />
            ) : (
              guardians
                .filter((g) => g.status !== "revoked")
                .map((g) => (
                  <div key={g.id} className="card">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-medium text-ink">{g.guardian?.full_name}</span>
                          <Pill tone={g.status === "active" ? "good" : "warn"}>{g.status}</Pill>
                        </div>
                        <div className="text-sm text-inkmuted">
                          {g.relationship} · {g.guardian?.email}
                        </div>
                      </div>
                      <button onClick={() => revoke(g.id)} className="btn-ghost px-2 py-1 shrink-0 text-brick-600">
                        <UserMinus size={16} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {RESOURCES.map((r) => (
                        <label key={r.key} className="flex items-center gap-1.5 text-sm text-ink">
                          <input
                            type="checkbox"
                            checked={g.permissions[r.key]}
                            onChange={(e) => updatePermission(g.id, r.key, e.target.checked, g)}
                          />
                          {r.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </div>
          <InviteGuardianForm patientId={user!.id} onAdded={refresh} setError={setError} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink mb-3">Who has access to my information</h2>
        {consent && consent.doctors.length > 0 && (
          <div className="card !p-0 overflow-hidden mb-3">
            <div className="divide-y divide-line">
              {consent.doctors.map((d) => (
                <div key={d.doctor.id} className="flex items-start gap-3 px-5 py-4">
                  <Stethoscope size={16} className="mt-0.5 text-locker-500 shrink-0" />
                  <div>
                    <div className="text-[15px] font-medium text-ink">{d.doctor.full_name}</div>
                    <div className="text-sm text-inkmuted">
                      {[d.profile.specialization, d.profile.hospital].filter(Boolean).join(" · ")} — clinical access
                      via appointments, private notes restricted
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {consent && consent.guardians.length === 0 && consent.doctors.length === 0 && (
          <EmptyState title="No one else currently has access to your record" />
        )}
      </section>
    </div>
  );
}

function InviteGuardianForm({
  patientId,
  onAdded,
  setError,
}: {
  patientId: string;
  onAdded: () => void;
  setError: (m: string | null) => void;
}) {
  const [guardianEmail, setGuardianEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [busy, setBusy] = useState(false);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/patients/${patientId}/guardians`, { guardianEmail, relationship });
      setGuardianEmail("");
      setRelationship("");
      onAdded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={invite} className="card space-y-3 h-fit">
      <h3 className="text-sm font-semibold text-ink">Invite a guardian</h3>
      <p className="text-sm text-inkmuted">They need their own guardian account on Health Locker first.</p>
      <div>
        <label className="label">Guardian's email</label>
        <input
          type="email"
          className="input"
          required
          value={guardianEmail}
          onChange={(e) => setGuardianEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Relationship</label>
        <input className="input" placeholder="e.g. Son" value={relationship} onChange={(e) => setRelationship(e.target.value)} />
      </div>
      <button className="btn-primary w-full" disabled={busy} type="submit">
        Send invite
      </button>
    </form>
  );
}

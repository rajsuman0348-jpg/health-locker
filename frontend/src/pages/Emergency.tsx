import { FormEvent, useEffect, useState } from "react";
import { Siren, Trash2, Phone } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHeader, EmptyState, Pill, ErrorBanner } from "../components/ui";
import { EmergencyContact, EmergencyProfile } from "../lib/types";

export default function Emergency() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [profile, setProfile] = useState<EmergencyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sosSent, setSosSent] = useState<string | null>(null);

  async function refresh() {
    if (!user) return;
    const [c, p] = await Promise.all([
      api.get<EmergencyContact[]>(`/patients/${user.id}/emergency-contacts`),
      api.get<EmergencyProfile>(`/patients/${user.id}/emergency-profile`),
    ]);
    setContacts(c);
    setProfile(p);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function remove(id: string) {
    await api.del(`/patients/${user!.id}/emergency-contacts/${id}`);
    refresh();
  }

  async function triggerSos() {
    setError(null);
    try {
      const res = await api.post<{ notifying: EmergencyContact[] }>(`/patients/${user!.id}/sos`);
      setSosSent(`Alert sent to ${res.notifying.length} contact${res.notifying.length === 1 ? "" : "s"}.`);
      setTimeout(() => setSosSent(null), 6000);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <PageHeader title="Emergency" subtitle="Contacts, your emergency profile, and SOS." />
      <ErrorBanner message={error} />

      <div className="mb-8 card border-brick-300 bg-brick-50">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-brick-600 font-semibold">
              <Siren size={18} /> SOS
            </div>
            <p className="text-sm text-inkmuted mt-1">Alerts your emergency contacts immediately.</p>
          </div>
          <button onClick={triggerSos} className="btn-danger">
            Trigger SOS
          </button>
        </div>
        {sosSent && <p className="mt-3 text-sm font-medium text-brick-600">{sosSent}</p>}
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-ink mb-3">Emergency contacts</h2>
        <div className="grid md:grid-cols-[1fr_300px] gap-6">
          <div className="card !p-0 overflow-hidden">
            {contacts.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No emergency contacts added" />
              </div>
            ) : (
              <div className="divide-y divide-line">
                {contacts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-locker-50 text-locker-600 text-xs font-semibold">
                        {c.priority}
                      </div>
                      <div>
                        <div className="text-[15px] font-medium text-ink">{c.name}</div>
                        <div className="text-sm text-inkmuted flex items-center gap-1">
                          <Phone size={12} /> {c.phone} {c.relationship && `· ${c.relationship}`}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => remove(c.id)} className="btn-ghost px-2 py-1 shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <AddContactForm patientId={user!.id} onAdded={refresh} setError={setError} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink mb-3">Emergency profile preview</h2>
        <p className="text-sm text-inkmuted mb-3">
          What a doctor or guardian sees in an emergency — not your full record.
        </p>
        {profile && (
          <div className="card space-y-3">
            <div className="flex flex-wrap gap-2">
              <Pill tone="neutral">{profile.profile?.blood_group || "Blood group not set"}</Pill>
              {profile.allergies.map((a, i) => (
                <Pill key={i} tone="bad">
                  {a.name} allergy
                </Pill>
              ))}
            </div>
            <div className="text-sm text-ink">
              <span className="font-medium">Conditions: </span>
              {profile.conditions.length ? profile.conditions.map((c) => c.name).join(", ") : "None on file"}
            </div>
            <div className="text-sm text-ink">
              <span className="font-medium">Current medications: </span>
              {profile.medications.length ? profile.medications.map((m) => m.name).join(", ") : "None on file"}
            </div>
            {profile.primaryDoctor && (
              <div className="text-sm text-ink">
                <span className="font-medium">Primary doctor: </span>
                {profile.primaryDoctor.name}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function AddContactForm({
  patientId,
  onAdded,
  setError,
}: {
  patientId: string;
  onAdded: () => void;
  setError: (m: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");
  const [priority, setPriority] = useState(1);
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/patients/${patientId}/emergency-contacts`, { name, relationship, phone, priority });
      setName("");
      setRelationship("");
      setPhone("");
      onAdded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="card space-y-3 h-fit">
      <h3 className="text-sm font-semibold text-ink">Add a contact</h3>
      <div>
        <label className="label">Name</label>
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label">Relationship</label>
        <input className="input" value={relationship} onChange={(e) => setRelationship(e.target.value)} />
      </div>
      <div>
        <label className="label">Phone</label>
        <input className="input" required value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label className="label">Priority</label>
        <input
          type="number"
          min={1}
          className="input"
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
        />
      </div>
      <button className="btn-primary w-full" disabled={busy} type="submit">
        Add contact
      </button>
    </form>
  );
}

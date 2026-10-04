import { FormEvent, useEffect, useState } from "react";
import { Check, X, Pause, Play } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHeader, EmptyState, Pill, ErrorBanner } from "../components/ui";
import { DoseToday, Medication, Prescription } from "../lib/types";

export default function Medications() {
  const { user } = useAuth();
  const [doses, setDoses] = useState<DoseToday[]>([]);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!user) return;
    const [d, m, p] = await Promise.all([
      api.get<DoseToday[]>(`/patients/${user.id}/medications/today`),
      api.get<Medication[]>(`/patients/${user.id}/medications`),
      api.get<Prescription[]>(`/patients/${user.id}/prescriptions`),
    ]);
    setDoses(d);
    setMeds(m);
    setPrescriptions(p);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function logDose(dose: DoseToday, status: "taken" | "skipped") {
    if (!user) return;
    await api.post(`/patients/${user.id}/medications/${dose.medicationId}/log`, {
      scheduledDate: dose.scheduledDate,
      scheduledTime: dose.scheduledTime,
      status,
    });
    refresh();
  }

  async function toggleActive(med: Medication) {
    if (!user) return;
    await api.put(`/patients/${user.id}/medications/${med.id}`, { active: med.active === 1 ? false : true });
    refresh();
  }

  return (
    <div>
      <PageHeader title="Medications" subtitle="Today's doses, your schedule, and prescription history." />
      <ErrorBanner message={error} />

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-ink mb-3">Today's doses</h2>
        {doses.length === 0 ? (
          <EmptyState title="No doses scheduled today" />
        ) : (
          <div className="card !p-0 overflow-hidden">
            <div className="divide-y divide-line">
              {doses.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div>
                    <div className="text-[15px] font-medium text-ink">
                      {d.scheduledTime} · {d.name}
                      {d.dosage && <span className="text-inkmuted font-normal"> ({d.dosage})</span>}
                    </div>
                  </div>
                  {d.status === "pending" ? (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => logDose(d, "taken")} className="btn-primary py-1.5 px-3 text-sm">
                        <Check size={14} /> Taken
                      </button>
                      <button onClick={() => logDose(d, "skipped")} className="btn-secondary py-1.5 px-3 text-sm">
                        <X size={14} /> Skip
                      </button>
                    </div>
                  ) : (
                    <Pill tone={d.status === "taken" ? "good" : "bad"}>{d.status}</Pill>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-ink mb-3">Your medications</h2>
        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          <div className="card !p-0 overflow-hidden">
            {meds.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No medications added yet" />
              </div>
            ) : (
              <div className="divide-y divide-line">
                {meds.map((m) => (
                  <div key={m.id} className="flex items-start justify-between gap-4 px-5 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium text-ink">{m.name}</span>
                        {m.dosage && <span className="text-sm text-inkmuted">{m.dosage}</span>}
                        <Pill tone={m.active === 1 ? "good" : "neutral"}>{m.active === 1 ? "active" : "paused"}</Pill>
                      </div>
                      <div className="mt-0.5 text-sm text-inkmuted">
                        {m.scheduleTimes.join(", ")} · from {m.start_date} for {m.duration_days} days
                      </div>
                    </div>
                    <button onClick={() => toggleActive(m)} className="btn-ghost px-2 py-1 shrink-0">
                      {m.active === 1 ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <AddMedicationForm patientId={user!.id} onAdded={refresh} setError={setError} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink mb-3">Prescription history</h2>
        {prescriptions.length === 0 ? (
          <EmptyState title="No prescriptions on file" />
        ) : (
          <div className="card !p-0 overflow-hidden">
            <div className="divide-y divide-line">
              {prescriptions.map((p) => (
                <div key={p.id} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[15px] font-medium text-ink">{p.date}</span>
                    {p.doctor_name && <span className="text-sm text-inkmuted">— {p.doctor_name}</span>}
                  </div>
                  {p.diagnosis && <div className="text-sm text-inkmuted mb-2">{p.diagnosis}</div>}
                  <ul className="text-sm text-ink space-y-0.5">
                    {p.items.map((it) => (
                      <li key={it.id}>
                        {it.medicine_name} {it.dosage && `— ${it.dosage}`} {it.frequency && `· ${it.frequency}`}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function AddMedicationForm({
  patientId,
  onAdded,
  setError,
}: {
  patientId: string;
  onAdded: () => void;
  setError: (m: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [times, setTimes] = useState("08:00, 20:00");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [durationDays, setDurationDays] = useState(7);
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const scheduleTimes = times.split(",").map((t) => t.trim()).filter(Boolean);
      await api.post(`/patients/${patientId}/medications`, { name, dosage, scheduleTimes, startDate, durationDays });
      setName("");
      setDosage("");
      onAdded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="card space-y-3 h-fit">
      <h3 className="text-sm font-semibold text-ink">Add a medication</h3>
      <div>
        <label className="label">Name</label>
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label">Dosage</label>
        <input className="input" placeholder="e.g. 500mg" value={dosage} onChange={(e) => setDosage(e.target.value)} />
      </div>
      <div>
        <label className="label">Times (24h, comma separated)</label>
        <input className="input" required value={times} onChange={(e) => setTimes(e.target.value)} />
      </div>
      <div>
        <label className="label">Start date</label>
        <input type="date" className="input" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div>
        <label className="label">Duration (days)</label>
        <input
          type="number"
          min={1}
          className="input"
          required
          value={durationDays}
          onChange={(e) => setDurationDays(Number(e.target.value))}
        />
      </div>
      <button className="btn-primary w-full" disabled={busy} type="submit">
        Add medication
      </button>
    </form>
  );
}

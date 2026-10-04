import { FormEvent, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader, Pill, EmptyState, ErrorBanner } from "../components/ui";
import { Allergy, Appointment, Condition, Medication, Prescription } from "../lib/types";

export default function DoctorPatientView() {
  const { patientId } = useParams<{ patientId: string }>();
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showRx, setShowRx] = useState(false);

  async function refresh() {
    if (!patientId) return;
    const [c, a, rx, med, appt] = await Promise.all([
      api.get<Condition[]>(`/patients/${patientId}/conditions`),
      api.get<Allergy[]>(`/patients/${patientId}/allergies`),
      api.get<Prescription[]>(`/patients/${patientId}/prescriptions`),
      api.get<Medication[]>(`/patients/${patientId}/medications`),
      api.get<Appointment[]>(`/patients/${patientId}/appointments`),
    ]);
    setConditions(c);
    setAllergies(a);
    setPrescriptions(rx);
    setMedications(med);
    setAppointments(appt);
    const appt0 = appt.find((x) => x.doctor_user_id);
    setName(appt0 ? "" : "");
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function completeAppointment(id: string) {
    await api.put(`/patients/${patientId}/appointments/${id}`, { status: "completed" });
    refresh();
  }

  if (!patientId) return null;

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-inkmuted hover:text-ink mb-4">
        <ArrowLeft size={15} /> Back to patients
      </Link>
      <PageHeader title={name || "Patient record"} subtitle="Clinical view — limited to what this patient has authorized." />
      <ErrorBanner message={error} />

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="text-sm font-semibold text-ink mb-3">Conditions</h3>
          {conditions.length === 0 ? (
            <p className="text-sm text-inkmuted">None on file</p>
          ) : (
            <ul className="space-y-2">
              {conditions.map((c) => (
                <li key={c.id} className="text-sm text-ink flex items-center gap-2">
                  {c.name} <Pill tone="neutral">{c.status}</Pill>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-ink mb-3">Allergies</h3>
          {allergies.length === 0 ? (
            <p className="text-sm text-inkmuted">None on file</p>
          ) : (
            <ul className="space-y-2">
              {allergies.map((a) => (
                <li key={a.id} className="text-sm text-ink flex items-center gap-2">
                  {a.name} {a.severity && <Pill tone="bad">{a.severity}</Pill>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-ink mb-3">Current medications</h2>
        {medications.filter((m) => m.active === 1).length === 0 ? (
          <EmptyState title="No active medications" />
        ) : (
          <div className="card !p-0 overflow-hidden">
            <div className="divide-y divide-line">
              {medications
                .filter((m) => m.active === 1)
                .map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-5 py-3">
                    <span className="text-[15px] text-ink">
                      {m.name} {m.dosage && `— ${m.dosage}`}
                    </span>
                    <span className="text-sm text-inkmuted">{m.scheduleTimes.join(", ")}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink">Prescriptions</h2>
          <button onClick={() => setShowRx(!showRx)} className="btn-secondary py-1.5 px-3 text-sm">
            <Plus size={14} /> New prescription
          </button>
        </div>
        {showRx && (
          <NewPrescriptionForm
            patientId={patientId}
            onDone={() => {
              setShowRx(false);
              refresh();
            }}
            setError={setError}
          />
        )}
        {prescriptions.length === 0 ? (
          <EmptyState title="No prescriptions yet" />
        ) : (
          <div className="card !p-0 overflow-hidden mt-3">
            <div className="divide-y divide-line">
              {prescriptions.map((p) => (
                <div key={p.id} className="px-5 py-4">
                  <div className="text-[15px] font-medium text-ink mb-1">{p.date}</div>
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

      <section>
        <h2 className="text-sm font-semibold text-ink mb-3">Appointments</h2>
        {appointments.length === 0 ? (
          <EmptyState title="No appointments" />
        ) : (
          <div className="card !p-0 overflow-hidden">
            <div className="divide-y divide-line">
              {appointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div>
                    <span className="text-[15px] font-medium text-ink">{new Date(a.date_time).toLocaleString()}</span>
                    <Pill tone="neutral">{a.status}</Pill>
                    {a.reason && <span className="ml-2 text-sm text-inkmuted">{a.reason}</span>}
                  </div>
                  {(a.status === "scheduled" || a.status === "confirmed") && (
                    <button onClick={() => completeAppointment(a.id)} className="btn-secondary py-1 px-2.5 text-sm shrink-0">
                      Mark completed
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function NewPrescriptionForm({
  patientId,
  onDone,
  setError,
}: {
  patientId: string;
  onDone: () => void;
  setError: (m: string | null) => void;
}) {
  const [diagnosis, setDiagnosis] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/patients/${patientId}/prescriptions`, {
        date: new Date().toISOString().slice(0, 10),
        diagnosis,
        items: [{ medicineName, dosage, frequency }],
      });
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 mb-3">
      <div>
        <label className="label">Diagnosis</label>
        <input className="input" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Medicine</label>
          <input className="input" required value={medicineName} onChange={(e) => setMedicineName(e.target.value)} />
        </div>
        <div>
          <label className="label">Dosage</label>
          <input className="input" value={dosage} onChange={(e) => setDosage(e.target.value)} />
        </div>
        <div>
          <label className="label">Frequency</label>
          <input className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)} />
        </div>
      </div>
      <button className="btn-primary" disabled={busy} type="submit">
        Save prescription
      </button>
    </form>
  );
}

import { FormEvent, useEffect, useState } from "react";
import { Trash2, Star, CalendarClock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHeader, EmptyState, Pill, ErrorBanner } from "../components/ui";
import { Appointment, FollowUp, PatientDoctor, RegisteredDoctor } from "../lib/types";

const statusTone: Record<Appointment["status"], "good" | "neutral" | "warn" | "bad"> = {
  scheduled: "neutral",
  confirmed: "good",
  completed: "good",
  cancelled: "bad",
  rescheduled: "warn",
  missed: "bad",
};

export default function CareTeam() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<PatientDoctor[]>([]);
  const [registered, setRegistered] = useState<RegisteredDoctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!user) return;
    const [d, reg, a, f] = await Promise.all([
      api.get<PatientDoctor[]>(`/doctors/${user.id}/doctors`),
      api.get<RegisteredDoctor[]>(`/doctors/search/registered`),
      api.get<Appointment[]>(`/patients/${user.id}/appointments`),
      api.get<FollowUp[]>(`/patients/${user.id}/follow-ups`),
    ]);
    setDoctors(d);
    setRegistered(reg);
    setAppointments(a);
    setFollowUps(f);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function removeDoctor(id: string) {
    await api.del(`/doctors/${user!.id}/doctors/${id}`);
    refresh();
  }

  async function cancelAppointment(id: string) {
    await api.put(`/patients/${user!.id}/appointments/${id}`, { status: "cancelled" });
    refresh();
  }

  return (
    <div>
      <PageHeader title="Care Team & Appointments" subtitle="Your doctors, visits, and follow-up schedule." />
      <ErrorBanner message={error} />

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-ink mb-3">Your doctors</h2>
        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          <div className="card !p-0 overflow-hidden">
            {doctors.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No doctors added yet" />
              </div>
            ) : (
              <div className="divide-y divide-line">
                {doctors.map((d) => (
                  <div key={d.id} className="flex items-start justify-between gap-4 px-5 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium text-ink">{d.name}</span>
                        {d.is_primary === 1 && (
                          <Pill tone="good">
                            <Star size={11} className="inline -mt-0.5" /> Primary
                          </Pill>
                        )}
                      </div>
                      <div className="mt-0.5 text-sm text-inkmuted">
                        {[d.specialization, d.hospital, d.phone].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <button onClick={() => removeDoctor(d.id)} className="btn-ghost px-2 py-1 shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <AddDoctorForm patientId={user!.id} registered={registered} onAdded={refresh} setError={setError} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-ink mb-3">Appointments</h2>
        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          <div className="card !p-0 overflow-hidden">
            {appointments.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No appointments booked" />
              </div>
            ) : (
              <div className="divide-y divide-line">
                {appointments.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-4 px-5 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <CalendarClock size={15} className="text-inkmuted" />
                        <span className="text-[15px] font-medium text-ink">
                          {new Date(a.date_time).toLocaleString()}
                        </span>
                        <Pill tone={statusTone[a.status]}>{a.status}</Pill>
                      </div>
                      {a.reason && <div className="mt-0.5 text-sm text-inkmuted">{a.reason}</div>}
                    </div>
                    {a.status === "scheduled" || a.status === "confirmed" ? (
                      <button onClick={() => cancelAppointment(a.id)} className="btn-secondary py-1 px-2.5 text-sm shrink-0">
                        Cancel
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          <BookAppointmentForm patientId={user!.id} doctors={doctors} onAdded={refresh} setError={setError} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink mb-3">Follow-ups</h2>
        {followUps.length === 0 ? (
          <EmptyState title="No follow-ups scheduled" />
        ) : (
          <div className="card !p-0 overflow-hidden">
            <div className="divide-y divide-line">
              {followUps.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div>
                    <span className="text-[15px] font-medium text-ink">Due {f.due_date}</span>
                    {f.notes && <span className="ml-2 text-sm text-inkmuted">{f.notes}</span>}
                  </div>
                  <Pill tone={f.completed === 1 ? "good" : "warn"}>{f.completed === 1 ? "done" : "pending"}</Pill>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function AddDoctorForm({
  patientId,
  registered,
  onAdded,
  setError,
}: {
  patientId: string;
  registered: RegisteredDoctor[];
  onAdded: () => void;
  setError: (m: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [hospital, setHospital] = useState("");
  const [phone, setPhone] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [linkedId, setLinkedId] = useState("");
  const [busy, setBusy] = useState(false);

  function pickRegistered(id: string) {
    setLinkedId(id);
    const d = registered.find((r) => r.id === id);
    if (d) {
      setName(d.full_name);
      setSpecialization(d.specialization || "");
      setHospital(d.hospital || "");
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/doctors/${patientId}/doctors`, {
        name,
        specialization,
        hospital,
        phone,
        isPrimary,
        doctorUserId: linkedId || undefined,
      });
      setName("");
      setSpecialization("");
      setHospital("");
      setPhone("");
      setIsPrimary(false);
      setLinkedId("");
      onAdded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="card space-y-3 h-fit">
      <h3 className="text-sm font-semibold text-ink">Add a doctor</h3>
      {registered.length > 0 && (
        <div>
          <label className="label">Link a registered doctor (optional)</label>
          <select className="input" value={linkedId} onChange={(e) => pickRegistered(e.target.value)}>
            <option value="">— Not on Health Locker —</option>
            {registered.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name} {r.specialization ? `(${r.specialization})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label">Name</label>
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label">Specialization</label>
        <input className="input" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
      </div>
      <div>
        <label className="label">Hospital</label>
        <input className="input" value={hospital} onChange={(e) => setHospital(e.target.value)} />
      </div>
      <div>
        <label className="label">Phone</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
        Primary doctor
      </label>
      <button className="btn-primary w-full" disabled={busy} type="submit">
        Add doctor
      </button>
    </form>
  );
}

function BookAppointmentForm({
  patientId,
  doctors,
  onAdded,
  setError,
}: {
  patientId: string;
  doctors: PatientDoctor[];
  onAdded: () => void;
  setError: (m: string | null) => void;
}) {
  const [patientDoctorId, setPatientDoctorId] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const doc = doctors.find((d) => d.id === patientDoctorId);
      await api.post(`/patients/${patientId}/appointments`, {
        patientDoctorId: patientDoctorId || undefined,
        doctorUserId: doc?.doctor_user_id || undefined,
        dateTime: new Date(dateTime).toISOString(),
        reason,
      });
      setReason("");
      setDateTime("");
      onAdded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="card space-y-3 h-fit">
      <h3 className="text-sm font-semibold text-ink">Book an appointment</h3>
      <div>
        <label className="label">Doctor</label>
        <select className="input" value={patientDoctorId} onChange={(e) => setPatientDoctorId(e.target.value)}>
          <option value="">Select a doctor</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Date & time</label>
        <input
          type="datetime-local"
          className="input"
          required
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Reason</label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <button className="btn-primary w-full" disabled={busy} type="submit">
        Book appointment
      </button>
    </form>
  );
}

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader, Pill, EmptyState } from "../components/ui";
import {
  Allergy,
  Appointment,
  Condition,
  DoseToday,
  EmergencyProfile,
  GuardianLink,
  Medication,
  Prescription,
} from "../lib/types";

export default function GuardianPatientView() {
  const { patientId } = useParams<{ patientId: string }>();
  const [link, setLink] = useState<GuardianLink | null>(null);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [doses, setDoses] = useState<DoseToday[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [emergency, setEmergency] = useState<EmergencyProfile | null>(null);

  useEffect(() => {
    if (!patientId) return;
    (async () => {
      const links = await api.get<GuardianLink[]>("/guardians/my-patients");
      const l = links.find((x) => x.patient_id === patientId) || null;
      setLink(l);
      if (!l) return;
      const p = l.permissions;
      const tasks: Promise<void>[] = [];
      if (p.medicines) {
        tasks.push(api.get<Medication[]>(`/patients/${patientId}/medications`).then(setMeds));
        tasks.push(api.get<DoseToday[]>(`/patients/${patientId}/medications/today`).then(setDoses));
      }
      if (p.appointments) tasks.push(api.get<Appointment[]>(`/patients/${patientId}/appointments`).then(setAppointments));
      if (p.prescriptions) tasks.push(api.get<Prescription[]>(`/patients/${patientId}/prescriptions`).then(setPrescriptions));
      if (p.reports) {
        tasks.push(api.get<Condition[]>(`/patients/${patientId}/conditions`).then(setConditions));
        tasks.push(api.get<Allergy[]>(`/patients/${patientId}/allergies`).then(setAllergies));
      }
      tasks.push(api.get<EmergencyProfile>(`/patients/${patientId}/emergency-profile`).then(setEmergency));
      await Promise.all(tasks);
    })();
  }, [patientId]);

  if (!patientId) return null;

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-inkmuted hover:text-ink mb-4">
        <ArrowLeft size={15} /> Back to connected patients
      </Link>
      <PageHeader title={link?.patient?.full_name || "Patient"} subtitle="Shown here only what they've chosen to share with you." />

      <div className="mb-6 flex flex-wrap gap-2">
        <Pill tone={link?.permissions.medicines ? "good" : "neutral"}>Medicines {link?.permissions.medicines ? "shared" : "not shared"}</Pill>
        <Pill tone={link?.permissions.appointments ? "good" : "neutral"}>Appointments {link?.permissions.appointments ? "shared" : "not shared"}</Pill>
        <Pill tone={link?.permissions.prescriptions ? "good" : "neutral"}>Prescriptions {link?.permissions.prescriptions ? "shared" : "not shared"}</Pill>
        <Pill tone={link?.permissions.reports ? "good" : "neutral"}>Reports {link?.permissions.reports ? "shared" : "not shared"}</Pill>
      </div>

      {link?.permissions.medicines ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-ink mb-3">Today's doses</h2>
          {doses.length === 0 ? (
            <EmptyState title="Nothing scheduled today" />
          ) : (
            <div className="card !p-0 overflow-hidden">
              <div className="divide-y divide-line">
                {doses.map((d, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <span className="text-[15px] text-ink">
                      {d.scheduledTime} · {d.name}
                    </span>
                    <Pill tone={d.status === "taken" ? "good" : d.status === "skipped" ? "bad" : "neutral"}>{d.status}</Pill>
                  </div>
                ))}
              </div>
            </div>
          )}
          {meds.length > 0 && (
            <p className="mt-2 text-sm text-inkmuted">{meds.filter((m) => m.active === 1).length} active medication(s)</p>
          )}
        </section>
      ) : (
        <LockedSection label="Medicines" />
      )}

      {link?.permissions.appointments && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-ink mb-3">Appointments</h2>
          {appointments.length === 0 ? (
            <EmptyState title="No appointments" />
          ) : (
            <div className="card !p-0 overflow-hidden">
              <div className="divide-y divide-line">
                {appointments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-5 py-3">
                    <span className="text-[15px] text-ink">{new Date(a.date_time).toLocaleString()}</span>
                    <Pill tone="neutral">{a.status}</Pill>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {link?.permissions.prescriptions && prescriptions.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-ink mb-3">Prescriptions</h2>
          <div className="card !p-0 overflow-hidden">
            <div className="divide-y divide-line">
              {prescriptions.map((p) => (
                <div key={p.id} className="px-5 py-3">
                  <div className="text-[15px] font-medium text-ink">{p.date}</div>
                  <div className="text-sm text-inkmuted">{p.items.map((it) => it.medicine_name).join(", ")}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {link?.permissions.reports && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-ink mb-3">Conditions & allergies</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card">
              {conditions.length === 0 ? (
                <p className="text-sm text-inkmuted">None on file</p>
              ) : (
                conditions.map((c) => (
                  <div key={c.id} className="text-sm text-ink py-1">
                    {c.name} — <span className="text-inkmuted">{c.status}</span>
                  </div>
                ))
              )}
            </div>
            <div className="card">
              {allergies.length === 0 ? (
                <p className="text-sm text-inkmuted">None on file</p>
              ) : (
                allergies.map((a) => (
                  <div key={a.id} className="text-sm text-ink py-1">
                    {a.name} {a.severity && `(${a.severity})`}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {emergency && (
        <section>
          <h2 className="text-sm font-semibold text-ink mb-3">Emergency profile</h2>
          <div className="card space-y-2">
            <div className="flex flex-wrap gap-2">
              <Pill tone="neutral">{emergency.profile?.blood_group || "Blood group not set"}</Pill>
              {emergency.allergies.map((a, i) => (
                <Pill key={i} tone="bad">
                  {a.name} allergy
                </Pill>
              ))}
            </div>
            <div className="text-sm text-ink">
              <span className="font-medium">Conditions: </span>
              {emergency.conditions.map((c) => c.name).join(", ") || "None"}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function LockedSection({ label }: { label: string }) {
  return (
    <div className="mb-8 flex items-center gap-2 rounded-lg border border-dashed border-line px-5 py-4 text-sm text-inkmuted">
      <Lock size={15} /> {label} has not been shared with you yet.
    </div>
  );
}

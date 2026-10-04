import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FolderLock,
  Pill,
  Stethoscope,
  Users,
  Siren,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHeader, Pill as StatusPill } from "../components/ui";
import { Appointment, DoseToday, PatientProfile, AdherenceAlert } from "../lib/types";

export default function PatientDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [doses, setDoses] = useState<DoseToday[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [alerts, setAlerts] = useState<AdherenceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [p, d, a, al] = await Promise.all([
        api.get<PatientProfile>("/patients/me"),
        api.get<DoseToday[]>(`/patients/${user.id}/medications/today`),
        api.get<Appointment[]>(`/patients/${user.id}/appointments`),
        api.get<AdherenceAlert[]>(`/patients/${user.id}/medications/adherence-alerts`),
      ]);
      setProfile(p);
      setDoses(d);
      setAppointments(a);
      setAlerts(al);
      setLoading(false);
    })();
  }, [user]);

  const upcoming = appointments
    .filter((a) => new Date(a.date_time) > new Date() && a.status !== "cancelled")
    .sort((a, b) => +new Date(a.date_time) - +new Date(b.date_time))[0];
  const pendingDoses = doses.filter((d) => d.status === "pending").length;

  const modules = [
    { to: "/medical-locker", label: "Medical Locker", desc: "Conditions, allergies, documents", icon: FolderLock },
    { to: "/medications", label: "Medications", desc: "Schedule, prescriptions, today's doses", icon: Pill },
    { to: "/care-team", label: "Care Team & Appointments", desc: "Doctors, visits, follow-ups", icon: Stethoscope },
    { to: "/family", label: "Family & Access", desc: "Guardians and who can see what", icon: Users },
    { to: "/emergency", label: "Emergency", desc: "Contacts, emergency profile, SOS", icon: Siren },
  ];

  return (
    <div>
      <PageHeader
        title={`Hello, ${user?.fullName?.split(" ")[0]}`}
        subtitle={profile ? `Health Locker ID ${profile.health_locker_id}` : undefined}
      />

      {!loading && alerts.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-ochre-400/40 bg-ochre-400/10 px-4 py-3">
          <AlertTriangle size={18} className="mt-0.5 text-ochre-500 shrink-0" />
          <div className="text-sm text-ink">
            <span className="font-medium">{alerts.length} medication{alerts.length > 1 ? "s" : ""}</span> with
            repeated missed confirmations.{" "}
            <Link to="/medications" className="text-locker-600 font-medium">
              Review now
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="card">
          <div className="text-xs font-medium text-inkmuted mb-1">Today's doses</div>
          <div className="font-serif text-2xl font-semibold text-ink">
            {loading ? "…" : `${pendingDoses} pending`}
          </div>
        </div>
        <div className="card">
          <div className="text-xs font-medium text-inkmuted mb-1">Next appointment</div>
          <div className="text-[15px] font-medium text-ink">
            {loading ? "…" : upcoming ? new Date(upcoming.date_time).toLocaleString() : "None scheduled"}
          </div>
        </div>
        <div className="card">
          <div className="text-xs font-medium text-inkmuted mb-1">Blood group</div>
          <div className="font-serif text-2xl font-semibold text-ink">
            {loading ? "…" : profile?.blood_group || "Not set"}
          </div>
        </div>
      </div>

      <div className="card divide-y divide-line !p-0 overflow-hidden">
        {modules.map((m) => (
          <Link key={m.to} to={m.to} className="flex items-center gap-4 px-5 py-4 hover:bg-locker-50/60 transition-colors">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-locker-50 text-locker-600">
              <m.icon size={18} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-medium text-ink">{m.label}</div>
              <div className="text-sm text-inkmuted">{m.desc}</div>
            </div>
            <ChevronRight size={18} className="text-inkmuted shrink-0" />
          </Link>
        ))}
      </div>

      {profile?.elderly_mode === 1 && (
        <div className="mt-4">
          <StatusPill tone="good">Elderly Mode is on — larger, simpler navigation</StatusPill>
        </div>
      )}
    </div>
  );
}

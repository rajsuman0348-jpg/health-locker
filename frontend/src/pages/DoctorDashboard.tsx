import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, User } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader, EmptyState } from "../components/ui";

interface DoctorPatientRow {
  id: string;
  full_name: string;
  email: string;
  health_locker_id: string | null;
  blood_group: string | null;
}

export default function DoctorDashboard() {
  const [patients, setPatients] = useState<DoctorPatientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DoctorPatientRow[]>("/doctors/my-patients").then((p) => {
      setPatients(p);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader title="Your patients" subtitle="Patients who have booked an appointment with you." />
      {!loading && patients.length === 0 ? (
        <EmptyState title="No patients yet" hint="Patients appear here once they book an appointment with you." />
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="divide-y divide-line">
            {patients.map((p) => (
              <Link
                key={p.id}
                to={`/patients/${p.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-locker-50/60 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-locker-50 text-locker-600">
                  <User size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium text-ink">{p.full_name}</div>
                  <div className="text-sm text-inkmuted">
                    {p.health_locker_id} {p.blood_group && `· ${p.blood_group}`}
                  </div>
                </div>
                <ChevronRight size={18} className="text-inkmuted shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

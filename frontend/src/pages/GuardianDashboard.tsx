import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, User, Check, X } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader, EmptyState, Pill } from "../components/ui";
import { GuardianLink } from "../lib/types";

export default function GuardianDashboard() {
  const [links, setLinks] = useState<GuardianLink[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const rows = await api.get<GuardianLink[]>("/guardians/my-patients");
    setLinks(rows);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function accept(id: string) {
    await api.put(`/guardians/${id}/accept`);
    refresh();
  }
  async function decline(id: string) {
    await api.put(`/guardians/${id}/decline`);
    refresh();
  }

  const pending = links.filter((l) => l.status === "pending");
  const active = links.filter((l) => l.status === "active");

  return (
    <div>
      <PageHeader title="Connected patients" subtitle="Family members who have invited you as a guardian." />

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-ink mb-3">Pending invitations</h2>
          <div className="card !p-0 overflow-hidden">
            <div className="divide-y divide-line">
              {pending.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <div className="text-[15px] font-medium text-ink">{l.patient?.full_name}</div>
                    <div className="text-sm text-inkmuted">{l.relationship}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => accept(l.id)} className="btn-primary py-1.5 px-3 text-sm">
                      <Check size={14} /> Accept
                    </button>
                    <button onClick={() => decline(l.id)} className="btn-secondary py-1.5 px-3 text-sm">
                      <X size={14} /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-ink mb-3">Active connections</h2>
        {!loading && active.length === 0 ? (
          <EmptyState title="No connected patients yet" hint="Invitations from family members will appear above." />
        ) : (
          <div className="card !p-0 overflow-hidden">
            <div className="divide-y divide-line">
              {active.map((l) => (
                <Link
                  key={l.id}
                  to={`/patients/${l.patient_id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-locker-50/60 transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-locker-50 text-locker-600">
                    <User size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-ink">{l.patient?.full_name}</div>
                    <div className="text-sm text-inkmuted">
                      {l.relationship} · {l.patientProfile?.health_locker_id}
                    </div>
                  </div>
                  <Pill tone="good">Active</Pill>
                  <ChevronRight size={18} className="text-inkmuted shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

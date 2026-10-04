import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHeader, EmptyState, Pill } from "../components/ui";
import { AuditEntry } from "../lib/types";

export default function AccessHistory() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    api.get<AuditEntry[]>(`/patients/${user.id}/audit-log`).then(setEntries);
  }, [user]);

  return (
    <div>
      <PageHeader title="Access History" subtitle="Who has viewed or changed your record, and when." />
      {entries.length === 0 ? (
        <EmptyState title="No activity recorded yet" />
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="divide-y divide-line">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div>
                  <span className="text-[15px] text-ink">
                    <span className="font-medium">{e.actorName}</span> {e.action} {e.resource.replace(/_/g, " ")}
                  </span>
                  <div className="text-xs text-inkmuted mt-0.5">{new Date(e.createdAt).toLocaleString()}</div>
                </div>
                <Pill tone="neutral">{e.actorRole}</Pill>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

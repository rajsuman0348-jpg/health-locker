import { FormEvent, useEffect, useState } from "react";
import { Trash2, Download, Upload } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHeader, EmptyState, Pill, ErrorBanner } from "../components/ui";
import { Allergy, Condition, DocumentMeta } from "../lib/types";

type Tab = "conditions" | "allergies" | "documents";

const statusTone: Record<Condition["status"], "good" | "neutral" | "warn"> = {
  active: "warn",
  under_observation: "warn",
  resolved: "good",
  historical: "neutral",
};

export default function MedicalLocker() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("conditions");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!user) return;
    const [c, a, d] = await Promise.all([
      api.get<Condition[]>(`/patients/${user.id}/conditions`),
      api.get<Allergy[]>(`/patients/${user.id}/allergies`),
      api.get<DocumentMeta[]>(`/patients/${user.id}/documents`),
    ]);
    setConditions(c);
    setAllergies(a);
    setDocuments(d);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div>
      <PageHeader title="Medical Locker" subtitle="Your conditions, allergies, and medical documents in one place." />
      <ErrorBanner message={error} />
      <div className="mb-5 flex gap-1 border-b border-line">
        {(["conditions", "allergies", "documents"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t ? "border-locker-500 text-locker-600" : "border-transparent text-inkmuted hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "conditions" && (
        <ConditionsTab conditions={conditions} onChange={refresh} patientId={user!.id} setError={setError} />
      )}
      {tab === "allergies" && (
        <AllergiesTab allergies={allergies} onChange={refresh} patientId={user!.id} setError={setError} />
      )}
      {tab === "documents" && (
        <DocumentsTab documents={documents} onChange={refresh} patientId={user!.id} setError={setError} />
      )}
    </div>
  );
}

function ConditionsTab({
  conditions,
  onChange,
  patientId,
  setError,
}: {
  conditions: Condition[];
  onChange: () => void;
  patientId: string;
  setError: (m: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [dateDiagnosed, setDateDiagnosed] = useState("");
  const [doctor, setDoctor] = useState("");
  const [hospital, setHospital] = useState("");
  const [status, setStatus] = useState<Condition["status"]>("active");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/patients/${patientId}/conditions`, { name, dateDiagnosed, doctor, hospital, status, notes });
      setName("");
      setDateDiagnosed("");
      setDoctor("");
      setHospital("");
      setNotes("");
      onChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.del(`/patients/${patientId}/conditions/${id}`);
    onChange();
  }

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-6">
      <div className="card !p-0 overflow-hidden">
        {conditions.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No conditions recorded yet" hint="Add one from the form to the right." />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {conditions.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium text-ink">{c.name}</span>
                    <Pill tone={statusTone[c.status]}>{c.status.replace("_", " ")}</Pill>
                  </div>
                  <div className="mt-0.5 text-sm text-inkmuted">
                    {[c.date_diagnosed, c.doctor, c.hospital].filter(Boolean).join(" · ") || "No further details"}
                  </div>
                  {c.notes && <div className="mt-1 text-sm text-inkmuted">{c.notes}</div>}
                </div>
                <button onClick={() => remove(c.id)} className="btn-ghost px-2 py-1 shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <form onSubmit={add} className="card space-y-3 h-fit">
        <h3 className="text-sm font-semibold text-ink">Add a condition</h3>
        <div>
          <label className="label">Name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Date diagnosed</label>
          <input type="date" className="input" value={dateDiagnosed} onChange={(e) => setDateDiagnosed(e.target.value)} />
        </div>
        <div>
          <label className="label">Doctor</label>
          <input className="input" value={doctor} onChange={(e) => setDoctor(e.target.value)} />
        </div>
        <div>
          <label className="label">Hospital</label>
          <input className="input" value={hospital} onChange={(e) => setHospital(e.target.value)} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Condition["status"])}>
            <option value="active">Active</option>
            <option value="under_observation">Under observation</option>
            <option value="resolved">Resolved</option>
            <option value="historical">Historical</option>
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={busy} type="submit">
          Add condition
        </button>
      </form>
    </div>
  );
}

function AllergiesTab({
  allergies,
  onChange,
  patientId,
  setError,
}: {
  allergies: Allergy[];
  onChange: () => void;
  patientId: string;
  setError: (m: string | null) => void;
}) {
  const [type, setType] = useState<Allergy["type"]>("medicine");
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/patients/${patientId}/allergies`, { type, name, severity, notes });
      setName("");
      setSeverity("");
      setNotes("");
      onChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.del(`/patients/${patientId}/allergies/${id}`);
    onChange();
  }

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-6">
      <div className="card !p-0 overflow-hidden">
        {allergies.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No allergies recorded" hint="Critical allergies show on your emergency profile." />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {allergies.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium text-ink">{a.name}</span>
                    <Pill tone="neutral">{a.type}</Pill>
                    {a.severity && <Pill tone="bad">{a.severity}</Pill>}
                  </div>
                  {a.notes && <div className="mt-1 text-sm text-inkmuted">{a.notes}</div>}
                </div>
                <button onClick={() => remove(a.id)} className="btn-ghost px-2 py-1 shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <form onSubmit={add} className="card space-y-3 h-fit">
        <h3 className="text-sm font-semibold text-ink">Add an allergy</h3>
        <div>
          <label className="label">Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as Allergy["type"])}>
            <option value="medicine">Medicine</option>
            <option value="food">Food</option>
            <option value="environmental">Environmental</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Severity</label>
          <input className="input" placeholder="e.g. severe" value={severity} onChange={(e) => setSeverity(e.target.value)} />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={busy} type="submit">
          Add allergy
        </button>
      </form>
    </div>
  );
}

function DocumentsTab({
  documents,
  onChange,
  patientId,
  setError,
}: {
  documents: DocumentMeta[];
  onChange: () => void;
  patientId: string;
  setError: (m: string | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("prescription");
  const [docDate, setDocDate] = useState("");
  const [hospital, setHospital] = useState("");
  const [doctor, setDoctor] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("docType", docType);
      fd.append("docDate", docDate);
      fd.append("hospital", hospital);
      fd.append("doctor", doctor);
      fd.append("description", description);
      await api.post(`/patients/${patientId}/documents`, fd);
      setFile(null);
      setDescription("");
      onChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.del(`/patients/${patientId}/documents/${id}`);
    onChange();
  }

  async function download(doc: DocumentMeta) {
    const token = localStorage.getItem("hl_token");
    const res = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/patients/${patientId}/documents/${doc.id}/download`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.original_filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-6">
      <div className="card !p-0 overflow-hidden">
        {documents.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No documents uploaded" hint="Upload prescriptions, reports, and scans from the right." />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {documents.map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium text-ink capitalize">{d.doc_type}</span>
                    {d.doc_date && <Pill tone="neutral">{d.doc_date}</Pill>}
                  </div>
                  <div className="mt-0.5 text-sm text-inkmuted truncate">
                    {[d.hospital, d.doctor].filter(Boolean).join(" · ") || d.original_filename}
                  </div>
                  {d.description && <div className="mt-1 text-sm text-inkmuted">{d.description}</div>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => download(d)} className="btn-ghost px-2 py-1">
                    <Download size={16} />
                  </button>
                  <button onClick={() => remove(d.id)} className="btn-ghost px-2 py-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <form onSubmit={upload} className="card space-y-3 h-fit">
        <h3 className="text-sm font-semibold text-ink">Upload a document</h3>
        <div>
          <label className="label">File</label>
          <input
            type="file"
            required
            className="input"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="prescription">Prescription</option>
            <option value="lab_report">Lab report</option>
            <option value="scan">Scan (X-ray / CT / MRI)</option>
            <option value="discharge_summary">Discharge summary</option>
            <option value="vaccination">Vaccination record</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Hospital</label>
          <input className="input" value={hospital} onChange={(e) => setHospital(e.target.value)} />
        </div>
        <div>
          <label className="label">Doctor</label>
          <input className="input" value={doctor} onChange={(e) => setDoctor(e.target.value)} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={busy || !file} type="submit">
          <Upload size={15} /> Upload
        </button>
      </form>
    </div>
  );
}

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHeader, ErrorBanner } from "../components/ui";
import { PatientProfile } from "../lib/types";

export default function Settings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [insuranceInfo, setInsuranceInfo] = useState("");
  const [elderlyMode, setElderlyMode] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "patient") return;
    api.get<PatientProfile>("/patients/me").then((p) => {
      setProfile(p);
      setDob(p.dob || "");
      setGender(p.gender || "");
      setPhone(p.phone || "");
      setAddress(p.address || "");
      setBloodGroup(p.blood_group || "");
      setInsuranceInfo(p.insurance_info || "");
      setElderlyMode(p.elderly_mode === 1);
    });
  }, [user]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.put("/patients/me", { dob, gender, phone, address, bloodGroup, insuranceInfo, elderlyMode });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (user?.role !== "patient") {
    return (
      <div>
        <PageHeader title="Settings" />
        <div className="card max-w-md">
          <div className="text-[15px] font-medium text-ink">{user?.fullName}</div>
          <div className="text-sm text-inkmuted">{user?.email}</div>
          <div className="text-sm text-inkmuted capitalize mt-1">{user?.role} account</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile details and accessibility preferences." />
      <ErrorBanner message={error} />
      <form onSubmit={save} className="card max-w-lg space-y-4">
        {profile && (
          <div className="text-sm text-inkmuted">
            Health Locker ID: <span className="font-medium text-ink">{profile.health_locker_id}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date of birth</label>
            <input type="date" className="input" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <div>
            <label className="label">Gender</label>
            <input className="input" value={gender} onChange={(e) => setGender(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Phone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">Blood group</label>
            <input className="input" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <label className="label">Insurance information</label>
          <input className="input" value={insuranceInfo} onChange={(e) => setInsuranceInfo(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={elderlyMode} onChange={(e) => setElderlyMode(e.target.checked)} />
          Elderly Mode — larger text and simpler navigation
        </label>
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={busy} type="submit">
            Save changes
          </button>
          {saved && <span className="text-sm text-locker-600 font-medium">Saved</span>}
        </div>
      </form>
    </div>
  );
}

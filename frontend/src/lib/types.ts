export type Role = "patient" | "doctor" | "guardian";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

export interface PatientProfile {
  user_id: string;
  health_locker_id: string;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  blood_group: string | null;
  insurance_info: string | null;
  elderly_mode: 0 | 1;
}

export interface DoctorProfile {
  user_id: string;
  specialization: string | null;
  hospital: string | null;
  phone: string | null;
}

export interface Condition {
  id: string;
  name: string;
  date_diagnosed: string | null;
  doctor: string | null;
  hospital: string | null;
  status: "active" | "resolved" | "under_observation" | "historical";
  notes: string | null;
}

export interface Allergy {
  id: string;
  type: "medicine" | "food" | "environmental" | "other";
  name: string;
  severity: string | null;
  notes: string | null;
}

export interface DocumentMeta {
  id: string;
  doc_type: string;
  doc_date: string | null;
  hospital: string | null;
  doctor: string | null;
  description: string | null;
  original_filename: string;
  uploaded_at: string;
}

export interface PrescriptionItem {
  id: string;
  medicine_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
}

export interface Prescription {
  id: string;
  date: string;
  diagnosis: string | null;
  doctor_name: string | null;
  notes: string | null;
  items: PrescriptionItem[];
}

export interface Medication {
  id: string;
  name: string;
  dosage: string | null;
  scheduleTimes: string[];
  start_date: string;
  duration_days: number;
  active: 0 | 1;
}

export interface DoseToday {
  medicationId: string;
  name: string;
  dosage: string | null;
  scheduledDate: string;
  scheduledTime: string;
  status: "pending" | "taken" | "skipped";
}

export interface AdherenceAlert {
  medicationId: string;
  name: string;
  missedConfirmations: number;
}

export interface PatientDoctor {
  id: string;
  name: string;
  specialization: string | null;
  hospital: string | null;
  phone: string | null;
  is_primary: 0 | 1;
  doctor_user_id: string | null;
}

export interface RegisteredDoctor {
  id: string;
  full_name: string;
  specialization: string | null;
  hospital: string | null;
}

export interface Appointment {
  id: string;
  doctor_user_id: string | null;
  date_time: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "rescheduled" | "missed";
  reason: string | null;
  notes: string | null;
}

export interface FollowUp {
  id: string;
  appointment_id: string | null;
  due_date: string;
  notes: string | null;
  completed: 0 | 1;
}

export type ConsentResource = "medicines" | "appointments" | "prescriptions" | "reports" | "notes";

export interface GuardianLink {
  id: string;
  patient_id: string;
  guardian_user_id: string;
  relationship: string | null;
  status: "pending" | "active" | "revoked";
  permissions: Record<ConsentResource, boolean>;
  guardian?: { id: string; full_name: string; email: string };
  patient?: { id: string; full_name: string; email: string };
  patientProfile?: { health_locker_id: string };
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string | null;
  phone: string;
  priority: number;
}

export interface EmergencyProfile {
  name: string;
  profile: { health_locker_id: string; blood_group: string | null; dob: string | null; gender: string | null } | null;
  allergies: { name: string; type: string; severity: string | null }[];
  conditions: { name: string; status: string }[];
  medications: { name: string; dosage: string | null }[];
  contacts: { name: string; relationship: string | null; phone: string }[];
  primaryDoctor: { name: string; specialization: string | null; hospital: string | null; phone: string | null } | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  actorName: string;
  actorRole: string;
  createdAt: string;
}

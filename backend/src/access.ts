import { db, genId, nowIso } from "./db";
import { AuthUser } from "./middleware/auth";

export type Resource = "medicines" | "appointments" | "prescriptions" | "reports" | "notes";

/**
 * Central consent / RBAC check.
 * - The patient always has full access to their own record.
 * - A doctor gets clinical access (medicines, appointments, prescriptions, reports)
 *   once at least one appointment links them to the patient. Doctors never get "notes".
 * - A guardian gets access only to resources the patient has explicitly toggled on
 *   in guardian_permissions, and only while the guardian link is 'active'.
 */
export function canAccessPatient(actor: AuthUser, patientId: string, resource: Resource): boolean {
  if (actor.id === patientId) return true;

  if (actor.role === "doctor") {
    if (resource === "notes") return false;
    const linked = db
      .prepare(`SELECT 1 FROM appointments WHERE patient_id = ? AND doctor_user_id = ? LIMIT 1`)
      .get(patientId, actor.id);
    return !!linked;
  }

  if (actor.role === "guardian") {
    const guardian = db
      .prepare(
        `SELECT id FROM guardians WHERE patient_id = ? AND guardian_user_id = ? AND status = 'active'`
      )
      .get(patientId, actor.id) as { id: string } | undefined;
    if (!guardian) return false;
    const perm = db
      .prepare(`SELECT allowed FROM guardian_permissions WHERE guardian_id = ? AND resource = ?`)
      .get(guardian.id, resource) as { allowed: number } | undefined;
    return !!perm && perm.allowed === 1;
  }

  return false;
}

export function requirePatientAccess(resource: Resource) {
  return (req: any, res: any, next: any) => {
    const patientId = req.params.patientId || req.user.id;
    if (!canAccessPatient(req.user, patientId, resource)) {
      return res.status(403).json({ error: `No consent to access ${resource} for this patient` });
    }
    req.patientId = patientId;
    next();
  };
}

export function logAudit(
  actor: AuthUser,
  patientId: string,
  action: string,
  resource: string,
  resourceId?: string
) {
  db.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, actor_role, patient_id, action, resource, resource_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(genId("log"), actor.id, actor.role, patientId, action, resource, resourceId || null, nowIso());
}

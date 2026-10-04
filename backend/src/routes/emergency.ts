import { Router } from "express";
import { z } from "zod";
import { db, genId, nowIso } from "../db";
import { requireAuth } from "../middleware/auth";
import { logAudit } from "../access";

const router = Router();
router.use(requireAuth);

function hasEmergencyAccess(actor: { id: string; role: string }, patientId: string): boolean {
  if (actor.id === patientId) return true;
  if (actor.role === "guardian") {
    const g = db
      .prepare(`SELECT 1 FROM guardians WHERE patient_id = ? AND guardian_user_id = ? AND status = 'active'`)
      .get(patientId, actor.id);
    return !!g;
  }
  if (actor.role === "doctor") {
    const linked = db
      .prepare(`SELECT 1 FROM appointments WHERE patient_id = ? AND doctor_user_id = ? LIMIT 1`)
      .get(patientId, actor.id);
    return !!linked;
  }
  return false;
}

const contactSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().optional(),
  phone: z.string().min(1),
  priority: z.number().int().positive().default(1),
});

router.get("/:patientId/emergency-contacts", (req, res) => {
  const { patientId } = req.params;
  if (!hasEmergencyAccess(req.user!, patientId)) {
    return res.status(403).json({ error: "No access to this patient's emergency contacts" });
  }
  res.json(db.prepare(`SELECT * FROM emergency_contacts WHERE patient_id = ? ORDER BY priority ASC`).all(patientId));
});

router.post("/:patientId/emergency-contacts", (req, res) => {
  const { patientId } = req.params;
  if (req.user!.id !== patientId) return res.status(403).json({ error: "Only the patient can manage emergency contacts" });
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const c = parsed.data;
  const id = genId("ec");
  db.prepare(
    `INSERT INTO emergency_contacts (id, patient_id, name, relationship, phone, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, patientId, c.name, c.relationship || null, c.phone, c.priority, nowIso());
  logAudit(req.user!, patientId, "created", "emergency_contact", id);
  res.status(201).json(db.prepare(`SELECT * FROM emergency_contacts WHERE id = ?`).get(id));
});

router.delete("/:patientId/emergency-contacts/:id", (req, res) => {
  const { patientId, id } = req.params;
  if (req.user!.id !== patientId) return res.status(403).json({ error: "Only the patient can manage emergency contacts" });
  db.prepare(`DELETE FROM emergency_contacts WHERE id = ? AND patient_id = ?`).run(id, patientId);
  logAudit(req.user!, patientId, "deleted", "emergency_contact", id);
  res.status(204).send();
});

// Condensed emergency profile: blood group, critical allergies, active conditions,
// active medications, emergency contacts, primary doctor. Deliberately excludes the
// full medical record and private notes.
router.get("/:patientId/emergency-profile", (req, res) => {
  const { patientId } = req.params;
  if (!hasEmergencyAccess(req.user!, patientId)) {
    return res.status(403).json({ error: "No access to this patient's emergency profile" });
  }
  const user = db.prepare(`SELECT id, full_name FROM users WHERE id = ?`).get(patientId) as any;
  const profile = db.prepare(`SELECT health_locker_id, blood_group, dob, gender FROM patient_profiles WHERE user_id = ?`).get(patientId);
  const allergies = db
    .prepare(`SELECT name, type, severity FROM allergies WHERE patient_id = ? AND (severity IS NOT NULL AND severity != '')`)
    .all(patientId);
  const conditions = db
    .prepare(`SELECT name, status FROM medical_conditions WHERE patient_id = ? AND status IN ('active','under_observation')`)
    .all(patientId);
  const medications = db
    .prepare(`SELECT name, dosage FROM medications WHERE patient_id = ? AND active = 1`)
    .all(patientId);
  const contacts = db.prepare(`SELECT name, relationship, phone FROM emergency_contacts WHERE patient_id = ? ORDER BY priority ASC`).all(patientId);
  const primaryDoctor = db
    .prepare(`SELECT name, specialization, hospital, phone FROM patient_doctors WHERE patient_id = ? AND is_primary = 1 LIMIT 1`)
    .get(patientId);

  logAudit(req.user!, patientId, "viewed", "emergency_profile");
  res.json({ name: user?.full_name, profile, allergies, conditions, medications, contacts, primaryDoctor });
});

// Records that an SOS was triggered; in production this would fan out real notifications
// (SMS/push) to emergency contacts. Here it logs the event and returns who would be alerted.
router.post("/:patientId/sos", (req, res) => {
  const { patientId } = req.params;
  if (req.user!.id !== patientId) return res.status(403).json({ error: "Only the patient can trigger their own SOS" });
  const contacts = db.prepare(`SELECT * FROM emergency_contacts WHERE patient_id = ? ORDER BY priority ASC`).all(patientId);
  logAudit(req.user!, patientId, "triggered", "sos");
  res.json({ triggeredAt: nowIso(), notifying: contacts });
});

export default router;

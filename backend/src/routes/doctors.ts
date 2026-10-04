import { Router } from "express";
import { z } from "zod";
import { db, genId, nowIso } from "../db";
import { requireAuth } from "../middleware/auth";
import { canAccessPatient, logAudit } from "../access";

const router = Router();
router.use(requireAuth);

const doctorSchema = z.object({
  name: z.string().min(1),
  specialization: z.string().optional(),
  hospital: z.string().optional(),
  phone: z.string().optional(),
  isPrimary: z.boolean().default(false),
  doctorUserId: z.string().optional(),
});

router.get("/:patientId/doctors", (req, res) => {
  const { patientId } = req.params;
  if (!canAccessPatient(req.user!, patientId, "reports")) {
    return res.status(403).json({ error: "No consent to view this patient's doctors" });
  }
  res.json(db.prepare(`SELECT * FROM patient_doctors WHERE patient_id = ? ORDER BY is_primary DESC, created_at DESC`).all(patientId));
});

router.post("/:patientId/doctors", (req, res) => {
  const { patientId } = req.params;
  if (req.user!.id !== patientId) return res.status(403).json({ error: "Only the patient can manage their doctor list" });
  const parsed = doctorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d = parsed.data;
  const id = genId("doc_ref");
  db.prepare(
    `INSERT INTO patient_doctors (id, patient_id, doctor_user_id, name, specialization, hospital, phone, is_primary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, patientId, d.doctorUserId || null, d.name, d.specialization || null, d.hospital || null, d.phone || null, d.isPrimary ? 1 : 0, nowIso());
  logAudit(req.user!, patientId, "created", "patient_doctor", id);
  res.status(201).json(db.prepare(`SELECT * FROM patient_doctors WHERE id = ?`).get(id));
});

router.delete("/:patientId/doctors/:id", (req, res) => {
  const { patientId, id } = req.params;
  if (req.user!.id !== patientId) return res.status(403).json({ error: "Only the patient can manage their doctor list" });
  db.prepare(`DELETE FROM patient_doctors WHERE id = ? AND patient_id = ?`).run(id, patientId);
  logAudit(req.user!, patientId, "deleted", "patient_doctor", id);
  res.status(204).send();
});

// Doctor's own patient list, derived from appointment links
router.get("/my-patients", (req, res) => {
  if (req.user!.role !== "doctor") return res.status(403).json({ error: "Doctors only" });
  const rows = db
    .prepare(
      `SELECT DISTINCT u.id, u.full_name, u.email, pp.health_locker_id, pp.blood_group
       FROM appointments a
       JOIN users u ON u.id = a.patient_id
       LEFT JOIN patient_profiles pp ON pp.user_id = u.id
       WHERE a.doctor_user_id = ?
       ORDER BY u.full_name ASC`
    )
    .all(req.user!.id);
  res.json(rows);
});

// Lets a patient search registered doctors on the platform to link/book with
router.get("/search/registered", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.full_name, dp.specialization, dp.hospital FROM users u
       JOIN doctor_profiles dp ON dp.user_id = u.id WHERE u.role = 'doctor'`
    )
    .all();
  res.json(rows);
});

export default router;

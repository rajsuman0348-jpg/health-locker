import { Router } from "express";
import { z } from "zod";
import { db, genId, nowIso } from "../db";
import { requireAuth } from "../middleware/auth";
import { canAccessPatient, logAudit } from "../access";

const router = Router();
router.use(requireAuth);

const appointmentSchema = z.object({
  doctorUserId: z.string().optional(),
  patientDoctorId: z.string().optional(),
  dateTime: z.string().min(1),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

router.get("/:patientId/appointments", (req, res) => {
  const { patientId } = req.params;
  if (!canAccessPatient(req.user!, patientId, "appointments")) {
    return res.status(403).json({ error: "No consent to view appointments" });
  }
  const rows = db
    .prepare(`SELECT * FROM appointments WHERE patient_id = ? ORDER BY date_time DESC`)
    .all(patientId);
  logAudit(req.user!, patientId, "viewed", "appointments");
  res.json(rows);
});

router.post("/:patientId/appointments", (req, res) => {
  const { patientId } = req.params;
  const isOwner = req.user!.id === patientId;
  const isDoctor = req.user!.role === "doctor" && canAccessPatient(req.user!, patientId, "appointments");
  if (!isOwner && !isDoctor) {
    return res.status(403).json({ error: "Not permitted to book appointments for this patient" });
  }
  const parsed = appointmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const a = parsed.data;
  const id = genId("appt");
  db.prepare(
    `INSERT INTO appointments (id, patient_id, doctor_user_id, patient_doctor_id, date_time, status, reason, notes, created_at)
     VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)`
  ).run(id, patientId, a.doctorUserId || (req.user!.role === "doctor" ? req.user!.id : null), a.patientDoctorId || null, a.dateTime, a.reason || null, a.notes || null, nowIso());
  logAudit(req.user!, patientId, "created", "appointment", id);
  res.status(201).json(db.prepare(`SELECT * FROM appointments WHERE id = ?`).get(id));
});

const statusSchema = z.object({
  status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "rescheduled", "missed"]).optional(),
  dateTime: z.string().optional(),
  notes: z.string().optional(),
});

router.put("/:patientId/appointments/:id", (req, res) => {
  const { patientId, id } = req.params;
  const isOwner = req.user!.id === patientId;
  const isDoctor = req.user!.role === "doctor" && canAccessPatient(req.user!, patientId, "appointments");
  if (!isOwner && !isDoctor) {
    return res.status(403).json({ error: "Not permitted to update this appointment" });
  }
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const existing = db.prepare(`SELECT * FROM appointments WHERE id = ? AND patient_id = ?`).get(id, patientId) as any;
  if (!existing) return res.status(404).json({ error: "Appointment not found" });
  const a = parsed.data;
  db.prepare(`UPDATE appointments SET status = ?, date_time = ?, notes = ? WHERE id = ?`).run(
    a.status ?? existing.status,
    a.dateTime ?? existing.date_time,
    a.notes ?? existing.notes,
    id
  );
  logAudit(req.user!, patientId, "updated", "appointment", id);
  res.json(db.prepare(`SELECT * FROM appointments WHERE id = ?`).get(id));
});

// ---- Follow-ups ----

const followUpSchema = z.object({
  appointmentId: z.string().optional(),
  dueDate: z.string().min(1),
  notes: z.string().optional(),
});

router.get("/:patientId/follow-ups", (req, res) => {
  const { patientId } = req.params;
  if (!canAccessPatient(req.user!, patientId, "appointments")) {
    return res.status(403).json({ error: "No consent to view follow-ups" });
  }
  res.json(db.prepare(`SELECT * FROM follow_ups WHERE patient_id = ? ORDER BY due_date ASC`).all(patientId));
});

router.post("/:patientId/follow-ups", (req, res) => {
  const { patientId } = req.params;
  const isDoctor = req.user!.role === "doctor" && canAccessPatient(req.user!, patientId, "appointments");
  if (!isDoctor) return res.status(403).json({ error: "Only a treating doctor can schedule a follow-up" });
  const parsed = followUpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const f = parsed.data;
  const id = genId("fu");
  db.prepare(
    `INSERT INTO follow_ups (id, appointment_id, patient_id, due_date, notes, completed, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).run(id, f.appointmentId || null, patientId, f.dueDate, f.notes || null, nowIso());
  logAudit(req.user!, patientId, "created", "follow_up", id);
  res.status(201).json(db.prepare(`SELECT * FROM follow_ups WHERE id = ?`).get(id));
});

router.put("/:patientId/follow-ups/:id/complete", (req, res) => {
  const { patientId, id } = req.params;
  const isOwner = req.user!.id === patientId;
  const isDoctor = req.user!.role === "doctor" && canAccessPatient(req.user!, patientId, "appointments");
  if (!isOwner && !isDoctor) return res.status(403).json({ error: "Not permitted to update this follow-up" });
  db.prepare(`UPDATE follow_ups SET completed = 1 WHERE id = ? AND patient_id = ?`).run(id, patientId);
  logAudit(req.user!, patientId, "updated", "follow_up", id);
  res.json(db.prepare(`SELECT * FROM follow_ups WHERE id = ?`).get(id));
});

export default router;

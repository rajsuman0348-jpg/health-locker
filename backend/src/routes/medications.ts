import { Router } from "express";
import { z } from "zod";
import { db, genId, nowIso } from "../db";
import { requireAuth } from "../middleware/auth";
import { canAccessPatient, logAudit } from "../access";

const router = Router();
router.use(requireAuth);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const medicationSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().optional(),
  scheduleTimes: z.array(z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)).min(1),
  startDate: z.string().min(1),
  durationDays: z.number().int().positive().default(7),
  prescriptionId: z.string().optional(),
});

router.get("/:patientId/medications", (req, res) => {
  const { patientId } = req.params;
  if (!canAccessPatient(req.user!, patientId, "medicines")) {
    return res.status(403).json({ error: "No consent to view medications" });
  }
  const rows = db
    .prepare(`SELECT * FROM medications WHERE patient_id = ? ORDER BY active DESC, created_at DESC`)
    .all(patientId) as any[];
  logAudit(req.user!, patientId, "viewed", "medications");
  res.json(rows.map((m) => ({ ...m, scheduleTimes: JSON.parse(m.schedule_times) })));
});

router.post("/:patientId/medications", (req, res) => {
  const { patientId } = req.params;
  const isOwner = req.user!.id === patientId;
  const isDoctor = req.user!.role === "doctor" && canAccessPatient(req.user!, patientId, "medicines");
  if (!isOwner && !isDoctor) {
    return res.status(403).json({ error: "Not permitted to add medications for this patient" });
  }
  const parsed = medicationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const m = parsed.data;
  const id = genId("med");
  db.prepare(
    `INSERT INTO medications (id, patient_id, prescription_id, name, dosage, schedule_times, start_date, duration_days, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(id, patientId, m.prescriptionId || null, m.name, m.dosage || null, JSON.stringify(m.scheduleTimes), m.startDate, m.durationDays, nowIso());
  logAudit(req.user!, patientId, "created", "medication", id);
  const row = db.prepare(`SELECT * FROM medications WHERE id = ?`).get(id) as any;
  res.status(201).json({ ...row, scheduleTimes: JSON.parse(row.schedule_times) });
});

router.put("/:patientId/medications/:id", (req, res) => {
  const { patientId, id } = req.params;
  const isOwner = req.user!.id === patientId;
  const isDoctor = req.user!.role === "doctor" && canAccessPatient(req.user!, patientId, "medicines");
  if (!isOwner && !isDoctor) {
    return res.status(403).json({ error: "Not permitted to modify medications for this patient" });
  }
  const active = typeof req.body.active === "boolean" ? (req.body.active ? 1 : 0) : undefined;
  const existing = db.prepare(`SELECT * FROM medications WHERE id = ? AND patient_id = ?`).get(id, patientId) as any;
  if (!existing) return res.status(404).json({ error: "Medication not found" });
  db.prepare(`UPDATE medications SET active = ? WHERE id = ?`).run(active === undefined ? existing.active : active, id);
  logAudit(req.user!, patientId, "updated", "medication", id);
  const row = db.prepare(`SELECT * FROM medications WHERE id = ?`).get(id) as any;
  res.json({ ...row, scheduleTimes: JSON.parse(row.schedule_times) });
});

// Today's dose checklist across all active medications, with taken/skipped/pending status
router.get("/:patientId/medications/today", (req, res) => {
  const { patientId } = req.params;
  if (!canAccessPatient(req.user!, patientId, "medicines")) {
    return res.status(403).json({ error: "No consent to view medications" });
  }
  const today = todayStr();
  const meds = db
    .prepare(`SELECT * FROM medications WHERE patient_id = ? AND active = 1`)
    .all(patientId) as any[];

  const doses: any[] = [];
  for (const med of meds) {
    const start = med.start_date;
    const end = addDays(start, med.duration_days);
    if (today < start || today >= end) continue;
    const times: string[] = JSON.parse(med.schedule_times);
    for (const time of times) {
      const log = db
        .prepare(`SELECT status FROM medication_logs WHERE medication_id = ? AND scheduled_date = ? AND scheduled_time = ?`)
        .get(med.id, today, time) as any;
      doses.push({
        medicationId: med.id,
        name: med.name,
        dosage: med.dosage,
        scheduledDate: today,
        scheduledTime: time,
        status: log ? log.status : "pending",
      });
    }
  }
  doses.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  res.json(doses);
});

const logSchema = z.object({
  scheduledDate: z.string().min(1),
  scheduledTime: z.string().min(1),
  status: z.enum(["taken", "skipped", "pending"]),
});

router.post("/:patientId/medications/:id/log", (req, res) => {
  const { patientId, id } = req.params;
  if (req.user!.id !== patientId) {
    return res.status(403).json({ error: "Only the patient can log their own doses" });
  }
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { scheduledDate, scheduledTime, status } = parsed.data;
  const existing = db
    .prepare(`SELECT id FROM medication_logs WHERE medication_id = ? AND scheduled_date = ? AND scheduled_time = ?`)
    .get(id, scheduledDate, scheduledTime) as any;
  if (existing) {
    db.prepare(`UPDATE medication_logs SET status = ?, logged_at = ? WHERE id = ?`).run(status, nowIso(), existing.id);
  } else {
    db.prepare(
      `INSERT INTO medication_logs (id, medication_id, scheduled_date, scheduled_time, status, logged_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(genId("mlog"), id, scheduledDate, scheduledTime, status, nowIso());
  }
  logAudit(req.user!, patientId, "logged", "medication_dose", id);
  res.json({ medicationId: id, scheduledDate, scheduledTime, status });
});

// Adherence: doses in the last 2 days that were skipped or never confirmed (still pending) -
// this backs the "caregiver alert on repeated missed confirmations" feature from the spec.
router.get("/:patientId/medications/adherence-alerts", (req, res) => {
  const { patientId } = req.params;
  if (!canAccessPatient(req.user!, patientId, "medicines")) {
    return res.status(403).json({ error: "No consent to view medications" });
  }
  const meds = db.prepare(`SELECT * FROM medications WHERE patient_id = ? AND active = 1`).all(patientId) as any[];
  const alerts: any[] = [];
  for (const med of meds) {
    const times: string[] = JSON.parse(med.schedule_times);
    let missed = 0;
    for (const dayOffset of [1, 0]) {
      const date = addDays(todayStr(), -dayOffset);
      if (date < med.start_date) continue;
      for (const time of times) {
        const log = db
          .prepare(`SELECT status FROM medication_logs WHERE medication_id = ? AND scheduled_date = ? AND scheduled_time = ?`)
          .get(med.id, date, time) as any;
        const isPast = new Date(`${date}T${time}:00`) < new Date();
        if (isPast && (!log || log.status !== "taken")) missed += 1;
      }
    }
    if (missed >= 2) {
      alerts.push({ medicationId: med.id, name: med.name, missedConfirmations: missed });
    }
  }
  res.json(alerts);
});

export default router;

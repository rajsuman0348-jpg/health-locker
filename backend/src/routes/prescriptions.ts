import { Router } from "express";
import { z } from "zod";
import { db, genId, nowIso } from "../db";
import { requireAuth } from "../middleware/auth";
import { canAccessPatient, logAudit } from "../access";

const router = Router();
router.use(requireAuth);

const itemSchema = z.object({
  medicineName: z.string().min(1),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  instructions: z.string().optional(),
});

const prescriptionSchema = z.object({
  date: z.string().min(1),
  diagnosis: z.string().optional(),
  doctorName: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).default([]),
});

router.get("/:patientId/prescriptions", (req, res) => {
  const { patientId } = req.params;
  if (!canAccessPatient(req.user!, patientId, "prescriptions")) {
    return res.status(403).json({ error: "No consent to view prescriptions" });
  }
  const prescriptions = db
    .prepare(`SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY date DESC`)
    .all(patientId) as any[];
  const withItems = prescriptions.map((p) => ({
    ...p,
    items: db.prepare(`SELECT * FROM prescription_items WHERE prescription_id = ?`).all(p.id),
  }));
  logAudit(req.user!, patientId, "viewed", "prescriptions");
  res.json(withItems);
});

router.post("/:patientId/prescriptions", (req, res) => {
  const { patientId } = req.params;
  const isOwner = req.user!.id === patientId;
  const isDoctor = req.user!.role === "doctor" && canAccessPatient(req.user!, patientId, "prescriptions");
  if (!isOwner && !isDoctor) {
    return res.status(403).json({ error: "Not permitted to add prescriptions for this patient" });
  }
  const parsed = prescriptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const p = parsed.data;
  const id = genId("rx");
  db.prepare(
    `INSERT INTO prescriptions (id, patient_id, doctor_user_id, doctor_name, date, diagnosis, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    patientId,
    req.user!.role === "doctor" ? req.user!.id : null,
    p.doctorName || (req.user!.role === "doctor" ? req.user!.email : null),
    p.date,
    p.diagnosis || null,
    p.notes || null,
    nowIso()
  );
  const insertItem = db.prepare(
    `INSERT INTO prescription_items (id, prescription_id, medicine_name, dosage, frequency, duration, instructions)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const item of p.items) {
    insertItem.run(genId("item"), id, item.medicineName, item.dosage || null, item.frequency || null, item.duration || null, item.instructions || null);
  }
  logAudit(req.user!, patientId, "created", "prescription", id);
  const items = db.prepare(`SELECT * FROM prescription_items WHERE prescription_id = ?`).all(id);
  res.status(201).json({ ...db.prepare(`SELECT * FROM prescriptions WHERE id = ?`).get(id) as object, items });
});

router.delete("/:patientId/prescriptions/:id", (req, res) => {
  const { patientId, id } = req.params;
  if (req.user!.id !== patientId) {
    return res.status(403).json({ error: "Only the patient can remove a prescription record" });
  }
  db.prepare(`DELETE FROM prescriptions WHERE id = ? AND patient_id = ?`).run(id, patientId);
  logAudit(req.user!, patientId, "deleted", "prescription", id);
  res.status(204).send();
});

export default router;

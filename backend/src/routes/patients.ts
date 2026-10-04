import { Router } from "express";
import { z } from "zod";
import { db, genId, nowIso } from "../db";
import { requireAuth } from "../middleware/auth";
import { canAccessPatient, logAudit } from "../access";

const router = Router();
router.use(requireAuth);

function ownerOrClinicalWriteAllowed(actor: any, patientId: string) {
  if (actor.id === patientId) return true;
  if (actor.role === "doctor") return canAccessPatient(actor, patientId, "reports");
  return false;
}

// ---- Profile ----

router.get("/me", (req, res) => {
  if (req.user!.role !== "patient") return res.status(403).json({ error: "Patients only" });
  const profile = db.prepare(`SELECT * FROM patient_profiles WHERE user_id = ?`).get(req.user!.id);
  res.json(profile);
});

const profileSchema = z.object({
  dob: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  bloodGroup: z.string().optional(),
  insuranceInfo: z.string().optional(),
  elderlyMode: z.boolean().optional(),
});

router.put("/me", (req, res) => {
  if (req.user!.role !== "patient") return res.status(403).json({ error: "Patients only" });
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const p = parsed.data;
  const existing = db.prepare(`SELECT * FROM patient_profiles WHERE user_id = ?`).get(req.user!.id) as any;
  db.prepare(
    `UPDATE patient_profiles SET dob = ?, gender = ?, phone = ?, address = ?, blood_group = ?, insurance_info = ?, elderly_mode = ? WHERE user_id = ?`
  ).run(
    p.dob ?? existing.dob,
    p.gender ?? existing.gender,
    p.phone ?? existing.phone,
    p.address ?? existing.address,
    p.bloodGroup ?? existing.blood_group,
    p.insuranceInfo ?? existing.insurance_info,
    p.elderlyMode === undefined ? existing.elderly_mode : p.elderlyMode ? 1 : 0,
    req.user!.id
  );
  res.json(db.prepare(`SELECT * FROM patient_profiles WHERE user_id = ?`).get(req.user!.id));
});

router.get("/:patientId/profile", (req, res) => {
  const { patientId } = req.params;
  if (!canAccessPatient(req.user!, patientId, "reports")) {
    return res.status(403).json({ error: "No consent to view this patient's profile" });
  }
  const user = db.prepare(`SELECT id, full_name, email FROM users WHERE id = ?`).get(patientId);
  const profile = db.prepare(`SELECT * FROM patient_profiles WHERE user_id = ?`).get(patientId);
  logAudit(req.user!, patientId, "viewed", "profile");
  res.json({ user, profile });
});

// ---- Medical conditions ----

const conditionSchema = z.object({
  name: z.string().min(1),
  dateDiagnosed: z.string().optional(),
  doctor: z.string().optional(),
  hospital: z.string().optional(),
  status: z.enum(["active", "resolved", "under_observation", "historical"]).default("active"),
  notes: z.string().optional(),
});

router.get("/:patientId/conditions", (req, res) => {
  const { patientId } = req.params;
  if (!canAccessPatient(req.user!, patientId, "reports")) {
    return res.status(403).json({ error: "No consent to view medical history" });
  }
  const rows = db
    .prepare(`SELECT * FROM medical_conditions WHERE patient_id = ? ORDER BY date_diagnosed DESC, created_at DESC`)
    .all(patientId);
  logAudit(req.user!, patientId, "viewed", "conditions");
  res.json(rows);
});

router.post("/:patientId/conditions", (req, res) => {
  const { patientId } = req.params;
  if (!ownerOrClinicalWriteAllowed(req.user!, patientId)) {
    return res.status(403).json({ error: "Not permitted to add medical history for this patient" });
  }
  const parsed = conditionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const c = parsed.data;
  const id = genId("cond");
  db.prepare(
    `INSERT INTO medical_conditions (id, patient_id, name, date_diagnosed, doctor, hospital, status, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, patientId, c.name, c.dateDiagnosed || null, c.doctor || null, c.hospital || null, c.status, c.notes || null, nowIso());
  logAudit(req.user!, patientId, "created", "condition", id);
  res.status(201).json(db.prepare(`SELECT * FROM medical_conditions WHERE id = ?`).get(id));
});

router.put("/:patientId/conditions/:id", (req, res) => {
  const { patientId, id } = req.params;
  if (!ownerOrClinicalWriteAllowed(req.user!, patientId)) {
    return res.status(403).json({ error: "Not permitted to edit medical history for this patient" });
  }
  const parsed = conditionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const existing = db.prepare(`SELECT * FROM medical_conditions WHERE id = ? AND patient_id = ?`).get(id, patientId) as any;
  if (!existing) return res.status(404).json({ error: "Condition not found" });
  const c = { ...existing, ...parsed.data };
  db.prepare(
    `UPDATE medical_conditions SET name=?, date_diagnosed=?, doctor=?, hospital=?, status=?, notes=? WHERE id = ?`
  ).run(c.name, c.dateDiagnosed ?? c.date_diagnosed, c.doctor, c.hospital, c.status, c.notes, id);
  logAudit(req.user!, patientId, "updated", "condition", id);
  res.json(db.prepare(`SELECT * FROM medical_conditions WHERE id = ?`).get(id));
});

router.delete("/:patientId/conditions/:id", (req, res) => {
  const { patientId, id } = req.params;
  if (!ownerOrClinicalWriteAllowed(req.user!, patientId)) {
    return res.status(403).json({ error: "Not permitted to remove medical history for this patient" });
  }
  db.prepare(`DELETE FROM medical_conditions WHERE id = ? AND patient_id = ?`).run(id, patientId);
  logAudit(req.user!, patientId, "deleted", "condition", id);
  res.status(204).send();
});

// ---- Allergies ----

const allergySchema = z.object({
  type: z.enum(["medicine", "food", "environmental", "other"]),
  name: z.string().min(1),
  severity: z.string().optional(),
  notes: z.string().optional(),
});

router.get("/:patientId/allergies", (req, res) => {
  const { patientId } = req.params;
  if (!canAccessPatient(req.user!, patientId, "reports")) {
    return res.status(403).json({ error: "No consent to view allergies" });
  }
  const rows = db.prepare(`SELECT * FROM allergies WHERE patient_id = ? ORDER BY created_at DESC`).all(patientId);
  res.json(rows);
});

router.post("/:patientId/allergies", (req, res) => {
  const { patientId } = req.params;
  if (!ownerOrClinicalWriteAllowed(req.user!, patientId)) {
    return res.status(403).json({ error: "Not permitted to add allergies for this patient" });
  }
  const parsed = allergySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const a = parsed.data;
  const id = genId("alg");
  db.prepare(
    `INSERT INTO allergies (id, patient_id, type, name, severity, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, patientId, a.type, a.name, a.severity || null, a.notes || null, nowIso());
  logAudit(req.user!, patientId, "created", "allergy", id);
  res.status(201).json(db.prepare(`SELECT * FROM allergies WHERE id = ?`).get(id));
});

router.delete("/:patientId/allergies/:id", (req, res) => {
  const { patientId, id } = req.params;
  if (!ownerOrClinicalWriteAllowed(req.user!, patientId)) {
    return res.status(403).json({ error: "Not permitted to remove allergies for this patient" });
  }
  db.prepare(`DELETE FROM allergies WHERE id = ? AND patient_id = ?`).run(id, patientId);
  logAudit(req.user!, patientId, "deleted", "allergy", id);
  res.status(204).send();
});

export default router;

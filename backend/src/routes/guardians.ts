import { Router } from "express";
import { z } from "zod";
import { db, genId, nowIso } from "../db";
import { requireAuth } from "../middleware/auth";
import { logAudit, Resource } from "../access";

const router = Router();
router.use(requireAuth);

const RESOURCES: Resource[] = ["medicines", "appointments", "prescriptions", "reports", "notes"];

function guardianWithPermissions(guardianId: string) {
  const g = db.prepare(`SELECT * FROM guardians WHERE id = ?`).get(guardianId) as any;
  if (!g) return null;
  const perms = db.prepare(`SELECT resource, allowed FROM guardian_permissions WHERE guardian_id = ?`).all(guardianId) as any[];
  const permissions: Record<string, boolean> = {};
  for (const r of RESOURCES) permissions[r] = false;
  for (const p of perms) permissions[p.resource] = !!p.allowed;
  return { ...g, permissions };
}

// ---- Patient side: manage who has guardian access to my record ----

router.get("/patients/:patientId/guardians", (req, res) => {
  const { patientId } = req.params;
  if (req.user!.id !== patientId) return res.status(403).json({ error: "Only the patient can view their guardian list" });
  const rows = db.prepare(`SELECT * FROM guardians WHERE patient_id = ? ORDER BY created_at DESC`).all(patientId) as any[];
  const withUser = rows.map((g) => {
    const u = db.prepare(`SELECT id, full_name, email FROM users WHERE id = ?`).get(g.guardian_user_id);
    return { ...guardianWithPermissions(g.id), guardian: u };
  });
  res.json(withUser);
});

const inviteSchema = z.object({
  guardianEmail: z.string().email(),
  relationship: z.string().optional(),
});

router.post("/patients/:patientId/guardians", (req, res) => {
  const { patientId } = req.params;
  if (req.user!.id !== patientId) return res.status(403).json({ error: "Only the patient can invite a guardian" });
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { guardianEmail, relationship } = parsed.data;

  const guardianUser = db.prepare(`SELECT * FROM users WHERE email = ? AND role = 'guardian'`).get(guardianEmail) as any;
  if (!guardianUser) {
    return res.status(404).json({ error: "No guardian account found with that email. They need to register as a guardian first." });
  }
  const existing = db.prepare(`SELECT id FROM guardians WHERE patient_id = ? AND guardian_user_id = ?`).get(patientId, guardianUser.id);
  if (existing) return res.status(409).json({ error: "This guardian is already invited or connected" });

  const id = genId("grd");
  db.prepare(
    `INSERT INTO guardians (id, patient_id, guardian_user_id, relationship, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`
  ).run(id, patientId, guardianUser.id, relationship || null, nowIso());
  const insertPerm = db.prepare(`INSERT INTO guardian_permissions (guardian_id, resource, allowed) VALUES (?, ?, 0)`);
  for (const r of RESOURCES) insertPerm.run(id, r);

  logAudit(req.user!, patientId, "invited", "guardian", id);
  res.status(201).json(guardianWithPermissions(id));
});

const permissionsSchema = z.object({
  permissions: z.record(z.string(), z.boolean()),
});

router.put("/patients/:patientId/guardians/:id/permissions", (req, res) => {
  const { patientId, id } = req.params;
  if (req.user!.id !== patientId) return res.status(403).json({ error: "Only the patient can change guardian permissions" });
  const guardian = db.prepare(`SELECT * FROM guardians WHERE id = ? AND patient_id = ?`).get(id, patientId) as any;
  if (!guardian) return res.status(404).json({ error: "Guardian link not found" });
  const parsed = permissionsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const update = db.prepare(`UPDATE guardian_permissions SET allowed = ? WHERE guardian_id = ? AND resource = ?`);
  for (const [resource, allowed] of Object.entries(parsed.data.permissions)) {
    if (RESOURCES.includes(resource as Resource)) update.run(allowed ? 1 : 0, id, resource);
  }
  logAudit(req.user!, patientId, "updated", "guardian_permissions", id);
  res.json(guardianWithPermissions(id));
});

router.delete("/patients/:patientId/guardians/:id", (req, res) => {
  const { patientId, id } = req.params;
  if (req.user!.id !== patientId) return res.status(403).json({ error: "Only the patient can revoke guardian access" });
  const guardian = db.prepare(`SELECT * FROM guardians WHERE id = ? AND patient_id = ?`).get(id, patientId) as any;
  if (!guardian) return res.status(404).json({ error: "Guardian link not found" });
  db.prepare(`UPDATE guardians SET status = 'revoked' WHERE id = ?`).run(id);
  logAudit(req.user!, patientId, "revoked", "guardian", id);
  res.json(guardianWithPermissions(id));
});

// "Who has access to my information?" consolidated consent view
router.get("/patients/:patientId/consent", (req, res) => {
  const { patientId } = req.params;
  if (req.user!.id !== patientId) return res.status(403).json({ error: "Only the patient can view their consent overview" });
  const guardians = db.prepare(`SELECT * FROM guardians WHERE patient_id = ? AND status != 'revoked'`).all(patientId) as any[];
  const guardianAccess = guardians.map((g) => {
    const u = db.prepare(`SELECT id, full_name, email FROM users WHERE id = ?`).get(g.guardian_user_id);
    return { type: "guardian", status: g.status, ...guardianWithPermissions(g.id), guardian: u };
  });
  const doctorLinks = db
    .prepare(
      `SELECT DISTINCT doctor_user_id FROM appointments WHERE patient_id = ? AND doctor_user_id IS NOT NULL`
    )
    .all(patientId) as any[];
  const doctorAccess = doctorLinks.map((row) => {
    const u = db.prepare(`SELECT id, full_name, email FROM users WHERE id = ?`).get(row.doctor_user_id);
    const dp = db.prepare(`SELECT specialization, hospital FROM doctor_profiles WHERE user_id = ?`).get(row.doctor_user_id);
    return {
      type: "doctor",
      doctor: u,
      profile: dp,
      permissions: { medicines: true, appointments: true, prescriptions: true, reports: true, notes: false },
    };
  });
  res.json({ guardians: guardianAccess, doctors: doctorAccess });
});

// ---- Guardian side ----

router.get("/guardians/my-patients", (req, res) => {
  if (req.user!.role !== "guardian") return res.status(403).json({ error: "Guardians only" });
  const rows = db
    .prepare(`SELECT * FROM guardians WHERE guardian_user_id = ? ORDER BY created_at DESC`)
    .all(req.user!.id) as any[];
  const withPatient = rows.map((g) => {
    const u = db.prepare(`SELECT id, full_name, email FROM users WHERE id = ?`).get(g.patient_id);
    const profile = db.prepare(`SELECT health_locker_id FROM patient_profiles WHERE user_id = ?`).get(g.patient_id);
    return { ...guardianWithPermissions(g.id), patient: u, patientProfile: profile };
  });
  res.json(withPatient);
});

router.put("/guardians/:id/accept", (req, res) => {
  if (req.user!.role !== "guardian") return res.status(403).json({ error: "Guardians only" });
  const guardian = db.prepare(`SELECT * FROM guardians WHERE id = ? AND guardian_user_id = ?`).get(req.params.id, req.user!.id) as any;
  if (!guardian) return res.status(404).json({ error: "Invitation not found" });
  db.prepare(`UPDATE guardians SET status = 'active' WHERE id = ?`).run(guardian.id);
  logAudit(req.user!, guardian.patient_id, "accepted", "guardian_invite", guardian.id);
  res.json(guardianWithPermissions(guardian.id));
});

router.put("/guardians/:id/decline", (req, res) => {
  if (req.user!.role !== "guardian") return res.status(403).json({ error: "Guardians only" });
  const guardian = db.prepare(`SELECT * FROM guardians WHERE id = ? AND guardian_user_id = ?`).get(req.params.id, req.user!.id) as any;
  if (!guardian) return res.status(404).json({ error: "Invitation not found" });
  db.prepare(`UPDATE guardians SET status = 'revoked' WHERE id = ?`).run(guardian.id);
  res.json(guardianWithPermissions(guardian.id));
});

export default router;

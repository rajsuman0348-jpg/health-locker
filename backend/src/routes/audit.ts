import { Router } from "express";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/:patientId/audit-log", (req, res) => {
  const { patientId } = req.params;
  if (req.user!.id !== patientId) {
    return res.status(403).json({ error: "Only the patient can view their own access history" });
  }
  const rows = db
    .prepare(`SELECT * FROM audit_logs WHERE patient_id = ? ORDER BY created_at DESC LIMIT 200`)
    .all(patientId) as any[];
  const withActor = rows.map((r) => {
    const actor = db.prepare(`SELECT full_name, email FROM users WHERE id = ?`).get(r.actor_user_id) as any;
    return {
      id: r.id,
      action: r.action,
      resource: r.resource,
      resourceId: r.resource_id,
      actorName: r.actor_user_id === patientId ? "You" : actor?.full_name || "Unknown user",
      actorRole: r.actor_role,
      createdAt: r.created_at,
    };
  });
  res.json(withActor);
});

export default router;

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, genId, nowIso } from "../db";
import { requireAuth } from "../middleware/auth";
import { canAccessPatient, logAudit } from "../access";

const router = Router();
router.use(requireAuth);

const uploadsDir = process.env.UPLOADS_DIR || "./uploads";
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${genId("doc")}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.get("/:patientId/documents", (req, res) => {
  const { patientId } = req.params;
  if (!canAccessPatient(req.user!, patientId, "reports")) {
    return res.status(403).json({ error: "No consent to view documents" });
  }
  const rows = db
    .prepare(`SELECT id, patient_id, doc_type, doc_date, hospital, doctor, description, original_filename, uploaded_at
               FROM documents WHERE patient_id = ? ORDER BY uploaded_at DESC`)
    .all(patientId);
  logAudit(req.user!, patientId, "viewed", "documents");
  res.json(rows);
});

router.post("/:patientId/documents", upload.single("file"), (req, res) => {
  const { patientId } = req.params;
  const isOwner = req.user!.id === patientId;
  const isClinical = req.user!.role === "doctor" && canAccessPatient(req.user!, patientId, "reports");
  if (!isOwner && !isClinical) {
    return res.status(403).json({ error: "Not permitted to upload documents for this patient" });
  }
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const { docType, docDate, hospital, doctor, description } = req.body;
  const id = genId("doc");
  db.prepare(
    `INSERT INTO documents (id, patient_id, doc_type, doc_date, hospital, doctor, description, file_path, original_filename, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    patientId,
    docType || "other",
    docDate || null,
    hospital || null,
    doctor || null,
    description || null,
    req.file.path,
    req.file.originalname,
    nowIso()
  );
  logAudit(req.user!, patientId, "uploaded", "document", id);
  res.status(201).json(db.prepare(`SELECT id, patient_id, doc_type, doc_date, hospital, doctor, description, original_filename, uploaded_at FROM documents WHERE id = ?`).get(id));
});

router.get("/:patientId/documents/:id/download", (req, res) => {
  const { patientId, id } = req.params;
  if (!canAccessPatient(req.user!, patientId, "reports")) {
    return res.status(403).json({ error: "No consent to view this document" });
  }
  const doc = db.prepare(`SELECT * FROM documents WHERE id = ? AND patient_id = ?`).get(id, patientId) as any;
  if (!doc) return res.status(404).json({ error: "Document not found" });
  logAudit(req.user!, patientId, "downloaded", "document", id);
  res.download(doc.file_path, doc.original_filename);
});

router.delete("/:patientId/documents/:id", (req, res) => {
  const { patientId, id } = req.params;
  if (req.user!.id !== patientId) {
    return res.status(403).json({ error: "Only the patient can delete their documents" });
  }
  const doc = db.prepare(`SELECT * FROM documents WHERE id = ? AND patient_id = ?`).get(id, patientId) as any;
  if (!doc) return res.status(404).json({ error: "Document not found" });
  fs.existsSync(doc.file_path) && fs.unlinkSync(doc.file_path);
  db.prepare(`DELETE FROM documents WHERE id = ?`).run(id);
  logAudit(req.user!, patientId, "deleted", "document", id);
  res.status(204).send();
});

export default router;

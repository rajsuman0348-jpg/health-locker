import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db, genId, nowIso, generateHealthLockerId } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1),
  role: z.enum(["patient", "doctor", "guardian"]),
  specialization: z.string().optional(),
  hospital: z.string().optional(),
});

router.post("/register", (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password, fullName, role, specialization, hospital } = parsed.data;

  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (existing) return res.status(409).json({ error: "An account with this email already exists" });

  const id = genId("usr");
  const passwordHash = bcrypt.hashSync(password, 10);
  const createdAt = nowIso();

  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, email, passwordHash, fullName, role, createdAt);

  if (role === "patient") {
    db.prepare(
      `INSERT INTO patient_profiles (user_id, health_locker_id) VALUES (?, ?)`
    ).run(id, generateHealthLockerId());
  } else if (role === "doctor") {
    db.prepare(
      `INSERT INTO doctor_profiles (user_id, specialization, hospital) VALUES (?, ?, ?)`
    ).run(id, specialization || null, hospital || null);
  }

  const token = jwt.sign(
    { id, role, email } as object,
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );
  res.status(201).json({ token, user: { id, email, fullName, role } });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Email and password are required" });
  const { email, password } = parsed.data;

  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, email: user.email } as object,
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );
  res.json({ token, user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role } });
});

router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare(`SELECT id, email, full_name, role, created_at FROM users WHERE id = ?`).get(
    req.user!.id
  ) as any;
  if (!user) return res.status(404).json({ error: "User not found" });

  let profile: any = null;
  if (user.role === "patient") {
    profile = db.prepare(`SELECT * FROM patient_profiles WHERE user_id = ?`).get(user.id);
  } else if (user.role === "doctor") {
    profile = db.prepare(`SELECT * FROM doctor_profiles WHERE user_id = ?`).get(user.id);
  }

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    createdAt: user.created_at,
    profile,
  });
});

export default router;

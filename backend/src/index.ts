import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import patientRoutes from "./routes/patients";
import doctorRoutes from "./routes/doctors";
import documentRoutes from "./routes/documents";
import prescriptionRoutes from "./routes/prescriptions";
import medicationRoutes from "./routes/medications";
import appointmentRoutes from "./routes/appointments";
import guardianRoutes from "./routes/guardians";
import emergencyRoutes from "./routes/emergency";
import auditRoutes from "./routes/audit";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "health-locker-api" }));

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/patients", documentRoutes); // /api/patients/:patientId/documents
app.use("/api/patients", prescriptionRoutes); // /api/patients/:patientId/prescriptions
app.use("/api/patients", medicationRoutes); // /api/patients/:patientId/medications
app.use("/api/patients", appointmentRoutes); // /api/patients/:patientId/appointments
app.use("/api", guardianRoutes); // /api/patients/:patientId/guardians, /api/guardians/*
app.use("/api/patients", emergencyRoutes); // /api/patients/:patientId/emergency-contacts
app.use("/api/patients", auditRoutes); // /api/patients/:patientId/audit-log

// 404 + error handling
app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Health Locker API listening on http://localhost:${port}`);
});
